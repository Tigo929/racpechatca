import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

/**
 * Поведение deploy/auto-update.sh (этап 13, FIX_01 от 22.09.2026).
 *
 * Скрипт запускается на сервере, а не в тестах, поэтому проверяем его так же,
 * как он там работает: сам файл подключается (AUTO_UPDATE_SOURCE_ONLY=1),
 * обращения к docker подменяются фальшивками, и проверяется логика ожидания
 * и замка — а не совпадение строк в исходнике.
 *
 * Что чинили:
 *   1) у photo-web нет healthcheck; скрипт считал контейнер готовым по факту
 *      запуска и спрашивал /api/health через пару секунд — приложение ещё не
 *      слушало порт, ответ был пустой, и Gate C получил ложное «работает не та
 *      сборка» при полностью верной сборке;
 *   2) ручной запуск и запуск по таймеру 22.09 в 14:44 наложились и
 *      продублировали прогрев холста и итог.
 */

const ROOT = resolve(__dirname, '..', '..');
const SCRIPT = join(ROOT, 'deploy', 'auto-update.sh');

/** В Git Bash bash лежит не в PATH: там его подменяет нерабочая заглушка WSL. */
function findBash(): string | null {
  const candidates =
    process.platform === 'win32'
      ? [
          'C:\\Program Files\\Git\\bin\\bash.exe',
          'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
        ]
      : ['/bin/bash', '/usr/bin/bash'];
  return candidates.find((p) => existsSync(p)) ?? null;
}

const BASH = findBash();
const REV = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';
const OTHER = '99887766554433221100ffeeddccbbaa99887766';
const body = (build: string) =>
  `{"status":"ok","build":"${build}","time":"2026-09-22T12:00:00Z"}`;

interface Run {
  rc: number;
  attempts: number;
  sleeps: number;
  log: string;
}

const d = BASH ? describe : describe.skip;

d('auto-update.sh: сверка сборки ждёт готовности контейнера (FIX_01)', () => {
  const bash = BASH!;
  const dir = mkdtempSync(join(tmpdir(), 'auto-update-verify-'));
  const fixture = join(dir, 'verify.sh');

  // Фальшивки вместо docker: ревизия образа задаётся переменной, ответы
  // /health читаются по одной строке на попытку (строки кончились — контейнер
  // «ещё не отвечает»), sleep не спит, а считается.
  writeFileSync(
    fixture,
    [
      '#!/usr/bin/env bash',
      'set -uo pipefail',
      'export AUTO_UPDATE_SOURCE_ONLY=1',
      '. "$SCRIPT"',
      'echo 0 >"$COUNT_FILE"',
      'echo 0 >"$SLEEP_FILE"',
      'image_revision() { printf "%s" "$FAKE_REVISION"; }',
      'container_build() {',
      '  local n',
      '  n=$(( $(cat "$COUNT_FILE") + 1 ))',
      '  echo "$n" >"$COUNT_FILE"',
      '  sed -n "${n}p" "$BODIES_FILE" | parse_build',
      '}',
      'sleep_seconds() { echo $(( $(cat "$SLEEP_FILE") + 1 )) >"$SLEEP_FILE"; }',
      'log() { echo "$*"; }',
      'verify_build photo-web-1 fake-image http://127.0.0.1:3000/api/health',
      'echo "RC=$?"',
      '',
    ].join('\n'),
    'utf8',
  );

  const run = (bodies: string[], revision = REV, attempts = 4): Run => {
    const bodiesFile = join(dir, 'bodies.txt');
    const countFile = join(dir, 'count.txt');
    const sleepFile = join(dir, 'sleeps.txt');
    writeFileSync(bodiesFile, bodies.join('\n') + '\n', 'utf8');
    const out = execFileSync(bash, [fixture], {
      encoding: 'utf8',
      env: {
        ...process.env,
        SCRIPT: SCRIPT.replace(/\\/g, '/'),
        BODIES_FILE: bodiesFile.replace(/\\/g, '/'),
        COUNT_FILE: countFile.replace(/\\/g, '/'),
        SLEEP_FILE: sleepFile.replace(/\\/g, '/'),
        FAKE_REVISION: revision,
        VERIFY_BUILD_ATTEMPTS: String(attempts),
        VERIFY_BUILD_INTERVAL: '1',
      },
    });
    return {
      rc: Number(/RC=(\d+)/.exec(out)?.[1] ?? -1),
      attempts: Number(readFileSync(countFile, 'utf8').trim()),
      sleeps: Number(readFileSync(sleepFile, 'utf8').trim()),
      log: out,
    };
  };

  it('контейнер ответил сразу и той же сборкой — успех без ожидания', () => {
    const r = run([body(REV)]);
    expect(r.rc).toBe(0);
    expect(r.attempts).toBe(1);
    expect(r.sleeps).toBe(0);
    expect(r.log).toContain('Сборка подтверждена');
  });

  it('контейнер поднимается медленно (пустые ответы, потом верный) — успех', () => {
    const r = run(['', '', body(REV)]);
    expect(r.rc).toBe(0);
    expect(r.attempts).toBe(3);
    expect(r.sleeps).toBe(2);
    expect(r.log).toContain('Сборка подтверждена');
  });

  it('работает чужая сборка — провал сразу, без повторов', () => {
    const r = run([body(OTHER)]);
    expect(r.rc).toBe(1);
    expect(r.attempts).toBe(1);
    expect(r.sleeps).toBe(0);
    expect(r.log).toContain('работает не та сборка');
  });

  it('чужая сборка после медленного старта — тоже провал, а не бесконечное ожидание', () => {
    const r = run(['', body(OTHER), body(REV)]);
    expect(r.rc).toBe(1);
    expect(r.attempts).toBe(2);
    expect(r.log).toContain('работает не та сборка');
  });

  it('контейнер так и не ответил — провал после ограниченного числа попыток', () => {
    const r = run([], REV, 4);
    expect(r.rc).toBe(1);
    expect(r.attempts).toBe(4);
    expect(r.sleeps).toBe(3);
    expect(r.log).toContain('не отдал build за 4 попыток');
    expect(r.log).not.toContain('работает не та сборка');
  });

  it('мусор вместо ответа (502, обрезанный JSON, HTML) — это «ещё не готов», повторы и провал', () => {
    const r = run(
      [
        '<html><body>502 Bad Gateway</body></html>',
        '{"status":"ok"}',
        '{"build":',
        'Internal Server Error',
      ],
      REV,
      4,
    );
    expect(r.rc).toBe(1);
    expect(r.attempts).toBe(4);
    expect(r.sleeps).toBe(3);
    expect(r.log).toContain('не отдал build');
  });

  it('мусор, а следом верный ответ — успех', () => {
    const r = run(['<html>502</html>', '{"status":"ok"}', body(REV)]);
    expect(r.rc).toBe(0);
    expect(r.attempts).toBe(3);
  });

  it('у образа нет метки revision (сборка до этапа 13) — сверять нечего, успех', () => {
    const r = run([body(OTHER)], 'unknown');
    expect(r.rc).toBe(0);
    expect(r.attempts).toBe(0);
  });
});

d('auto-update.sh: единый замок ручного запуска и таймера (FIX_01)', () => {
  const bash = BASH!;
  const dir = mkdtempSync(join(tmpdir(), 'auto-update-lock-'));
  const child = join(dir, 'child.sh');
  const posix = (p: string) => p.replace(/\\/g, '/');

  writeFileSync(
    child,
    [
      '#!/usr/bin/env bash',
      'set -uo pipefail',
      'export AUTO_UPDATE_SOURCE_ONLY=1',
      '. "$SCRIPT"',
      'if acquire_lock; then echo "CHILD=acquired"; release_lock; exit 0; fi',
      'echo "CHILD=skipped"',
      'exit 3',
      '',
    ].join('\n'),
    'utf8',
  );

  const modes = ['mkdir'];
  if (
    spawnSync(bash, ['-lc', 'command -v flock >/dev/null 2>&1'], {
      encoding: 'utf8',
    }).status === 0
  ) {
    modes.push('flock');
  }

  describe.each(modes)('режим %s', (mode) => {
    const lockFile = join(dir, `lock-${mode}`);
    const env = {
      ...process.env,
      SCRIPT: posix(SCRIPT),
      AUTO_UPDATE_LOCK: posix(lockFile),
      AUTO_UPDATE_LOCK_MODE: mode,
    };
    const tryChild = () => spawnSync(bash, [child], { encoding: 'utf8', env });

    it('пока замок занят, второй запуск не ждёт, а выходит', () => {
      const parent = join(dir, `parent-${mode}.sh`);
      writeFileSync(
        parent,
        [
          '#!/usr/bin/env bash',
          'set -uo pipefail',
          'export AUTO_UPDATE_SOURCE_ONLY=1',
          '. "$SCRIPT"',
          'acquire_lock || { echo "FIRST=busy"; exit 1; }',
          'echo "FIRST=acquired:$LOCK_HELD"',
          'start=$(date +%s)',
          '"$BASH_BIN" "$CHILD"; echo "WHILE_HELD_RC=$?"',
          'echo "ELAPSED=$(( $(date +%s) - start ))"',
          'release_lock',
          '"$BASH_BIN" "$CHILD"; echo "AFTER_RELEASE_RC=$?"',
          '',
        ].join('\n'),
        'utf8',
      );
      const out = execFileSync(bash, [parent], {
        encoding: 'utf8',
        env: { ...env, BASH_BIN: posix(bash), CHILD: posix(child) },
      });

      expect(out).toContain(`FIRST=acquired:${mode}`);
      expect(out).toContain('CHILD=skipped');
      expect(out).toContain('WHILE_HELD_RC=3');
      // именно «сразу вышел», а не «встал в очередь»
      expect(Number(/ELAPSED=(\d+)/.exec(out)?.[1] ?? 99)).toBeLessThan(5);
      expect(out).toContain('CHILD=acquired');
      expect(out).toContain('AFTER_RELEASE_RC=0');
    });

    it('замок свободен — следующий запуск его берёт', () => {
      const r = tryChild();
      expect(r.stdout).toContain('CHILD=acquired');
      expect(r.status).toBe(0);
    });
  });

  it('замок от убитого процесса не блокирует навсегда (режим mkdir)', () => {
    const lockFile = join(dir, 'lock-stale');
    execFileSync(
      bash,
      [
        '-c',
        `mkdir -p "${posix(lockFile)}.d" && echo 4000000 >"${posix(lockFile)}.d/pid"`,
      ],
      { encoding: 'utf8' },
    );
    const r = spawnSync(bash, [child], {
      encoding: 'utf8',
      env: {
        ...process.env,
        SCRIPT: posix(SCRIPT),
        AUTO_UPDATE_LOCK: posix(lockFile),
        AUTO_UPDATE_LOCK_MODE: 'mkdir',
      },
    });
    expect(r.stdout).toContain('CHILD=acquired');
    expect(r.status).toBe(0);
  });

  it('весь проход целиком: занятый замок → запись «Пропуск» в журнал и выход 0, docker не трогается', () => {
    const lockFile = join(dir, 'lock-main');
    const logFile = join(dir, 'auto-update.log');
    const parent = join(dir, 'parent-main.sh');
    writeFileSync(
      parent,
      [
        '#!/usr/bin/env bash',
        'set -uo pipefail',
        'export AUTO_UPDATE_SOURCE_ONLY=1',
        '. "$SCRIPT"',
        'acquire_lock || { echo "FIRST=busy"; exit 1; }',
        // полноценный второй запуск — как systemd-таймер поверх ручного
        'AUTO_UPDATE_SOURCE_ONLY=0 "$BASH_BIN" "$SCRIPT"; echo "MAIN_RC=$?"',
        'release_lock',
        '',
      ].join('\n'),
      'utf8',
    );
    const out = execFileSync(bash, [parent], {
      encoding: 'utf8',
      env: {
        ...process.env,
        SCRIPT: posix(SCRIPT),
        BASH_BIN: posix(bash),
        AUTO_UPDATE_LOCK: posix(lockFile),
        AUTO_UPDATE_LOCK_MODE: 'mkdir',
        AUTO_UPDATE_LOG: posix(logFile),
        PATH: process.env.PATH ?? '',
      },
    });

    expect(out).toContain('MAIN_RC=0');
    const journal = readFileSync(logFile, 'utf8');
    expect(journal).toContain('Пропуск: обновление уже идёт');
    expect(journal).not.toContain('Обновляю');
    expect(journal).not.toContain('Итог:');
  });
});
