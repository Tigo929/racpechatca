import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

/**
 * Инварианты безопасности выкладки CRM (этап 13, разделы 18–20;
 * DEPLOYMENT_SAFETY.md). Файлы читаются как есть — тест ломается, если кто-то
 * вернёт плавающий `latest` в compose, уберёт `--no-deps` из auto-update или
 * позволит не-master сборке выпустить production-образ.
 *
 * Почему это тесты, а не «помнить»: 14.09.2026 устаревшая ветка сайта
 * пересобрала боевой `latest`; 17.09.2026 обновление frontend пересоздало
 * backend старым образом. Оба раза код был «правильным» по отдельности.
 */
const ROOT = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const yaml = createRequire(__filename)('js-yaml') as {
  load(src: string): unknown;
};

interface Workflow {
  on: { push?: { branches?: string[] }; workflow_dispatch?: unknown };
  jobs: Record<
    string,
    {
      steps: {
        name?: string;
        id?: string;
        uses?: string;
        run?: string;
        env?: Record<string, string>;
        with?: Record<string, string>;
      }[];
    }
  >;
}

describe('CI: production-образы только с master (раздел 18)', () => {
  const wf = yaml.load(read('.github/workflows/build-images.yml')) as Workflow;
  const build = wf.jobs.build;
  const tagsStep = build.steps.find((s) => s.id === 'tags')!;
  const push = build.steps.find((s) =>
    s.uses?.startsWith('docker/build-push-action'),
  )!;

  it('триггер — только master (и ручной запуск)', () => {
    expect(wf.on.push?.branches).toEqual(['master']);
  });

  it('метки: :<sha> всегда; :production и :latest — только под условием github.ref == refs/heads/master', () => {
    expect(tagsStep.run).toMatch(/tags="\$IMAGE:\$\{\{ github\.sha \}\}"/);
    expect(tagsStep.run).toMatch(
      /if \[ "\$\{\{ github\.ref \}\}" = "refs\/heads\/master" \]; then\s+tags="\$tags,\$IMAGE:production,\$IMAGE:latest"/,
    );
    expect(push.with?.tags).toBe('${{ steps.tags.outputs.value }}');
  });

  it('модель угрозы: копия workflow в чужой ветке получает только :<sha>', () => {
    const simulate = (ref: string) => {
      const tags = ['<image>:<sha>'];
      if (ref === 'refs/heads/master')
        tags.push('<image>:production', '<image>:latest');
      return tags;
    };
    expect(simulate('refs/heads/feature/analytics-foundation')).toEqual([
      '<image>:<sha>',
    ]);
    expect(simulate('refs/heads/master')).toContain('<image>:production');
    // и сам shell-скрипт содержит ровно эту логику, а не другой источник правды
    expect((tagsStep.run!.match(/production/g) ?? []).length).toBe(1);
  });

  it('идентификатор сборки: BUILD_SHA и метка revision передаются в образ', () => {
    expect(push.with?.['build-args']).toMatch(
      /BUILD_SHA=\$\{\{ github\.sha \}\}/,
    );
    expect(push.with?.labels).toMatch(
      /org\.opencontainers\.image\.revision=\$\{\{ github\.sha \}\}/,
    );
    const dockerfile = read('crm-new/Dockerfile.prebuilt');
    expect(dockerfile).toMatch(/ARG BUILD_SHA=unknown/);
    expect(dockerfile).toMatch(/ENV BUILD_SHA=\$BUILD_SHA/);
    expect(dockerfile).toMatch(
      /LABEL org\.opencontainers\.image\.revision=\$BUILD_SHA/,
    );
  });

  it('тесты идут до сборки образов', () => {
    expect(Object.keys(wf.jobs)).toEqual(['test', 'build']);
    expect((build as unknown as { needs: string }).needs).toBe('test');
  });
});

describe('auto-update и compose: детерминированная выкладка (раздел 19)', () => {
  const script = read('deploy/auto-update.sh');
  const compose = read('docker-compose.prod.yml');

  it('пересоздаётся только целевой сервис: --force-recreate всегда вместе с --no-deps', () => {
    // только исполняемые строки — комментарии с историей не считаются
    const ups = script
      .split('\n')
      .filter((l) => !/^\s*#/.test(l) && /docker compose .*up -d/.test(l));
    expect(ups.length).toBeGreaterThan(0);
    for (const line of ups) {
      expect(line).toMatch(/--force-recreate/);
      expect(line).toMatch(/--no-deps/);
    }
  });

  it('сервер потребляет метку production (не latest); тег переопределяется только явно через IMAGE_TAG', () => {
    expect(script).toMatch(/IMAGE_TAG="\$\{IMAGE_TAG:-production\}"/);
    const targets = script.match(/^\s+"\/opt\/[^"]+"$/gm) ?? [];
    expect(targets.length).toBe(4);
    for (const t of targets) {
      expect(t).toMatch(/:\$IMAGE_TAG\|/);
      expect(t).not.toMatch(/:latest/);
    }
    expect(compose).toMatch(/racpechatca-backend:production/);
    expect(compose).toMatch(/racpechatca-frontend:production/);
    expect(compose).not.toMatch(/racpechatca-(backend|frontend):latest/);
  });

  it('порядок обновления фиксирован: api → web, backend → frontend', () => {
    const lines: string[] =
      script.match(/^\s+"\/opt\/[^|]+\|[^|]+\|([a-z]+)\|/gm) ?? [];
    const order = lines.map((l) => l.split('|')[2]);
    expect(order).toEqual(['api', 'web', 'backend', 'frontend']);
  });

  it('после обновления сверяется сборка: метка revision образа против build из /health', () => {
    expect(script).toMatch(/verify_build\(\)/);
    expect(script).toMatch(/org\.opencontainers\.image\.revision/);
    expect(script).toMatch(/"build":"/);
    expect(script).toMatch(
      /verify_build "\$container" "\$image" "\$health_url" \|\| failed=\$\(\(failed \+ 1\)\)/,
    );
    // health-адреса заданы там, где ответ содержит build: CRM backend и web сайта
    expect(script).toMatch(
      /raspechatka-backend-1\|[^|]+\|http:\/\/127\.0\.0\.1:3000\/health/,
    );
    expect(script).toMatch(
      /photo-web-1\|[^|]+\|http:\/\/127\.0\.0\.1:3000\/api\/health/,
    );
  });

  it('compose: миграции применяются на старте контейнера штатным migrate deploy, без migrate dev', () => {
    expect(compose).toMatch(
      /npx prisma migrate deploy && node dist\/src\/main/,
    );
    expect(compose).not.toMatch(/migrate dev|migrate reset|migrate resolve/);
  });

  it('nginx перечитывается после любого обновления (пересозданный контейнер меняет адрес)', () => {
    expect(script).toMatch(/nginx -s reload/);
  });
});
