import { createWriteStream } from 'node:fs';
import { access, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { format } from 'node:util';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SERVICE_LOG_DIRECTORY = path.join(SCRIPT_DIR, 'service-logs');
await mkdir(SERVICE_LOG_DIRECTORY, { recursive: true });
const serviceLog = createWriteStream(path.join(SERVICE_LOG_DIRECTORY, 'dispatcher.log'), { flags: 'a' });

function serviceMessage(target, ...args) {
  const message = `${new Date().toISOString()} ${format(...args)}\n`;
  serviceLog.write(message);
  target.write(message);
}

const log = (...args) => serviceMessage(process.stdout, ...args);
const logError = (...args) => serviceMessage(process.stderr, ...args);

const CONFIG_PATH = process.env.LOCAL_AGENT_CONFIG
  ? path.resolve(process.env.LOCAL_AGENT_CONFIG)
  : path.join(SCRIPT_DIR, 'config.local.json');

async function readConfig() {
  try {
    return JSON.parse(await readFile(CONFIG_PATH, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw new Error(`Cannot read ${CONFIG_PATH}: ${error.message}`);
  }
}

const config = await readConfig();
const BASE_URL = String(
  process.env.CRM_BASE_URL ??
    config.crmBaseUrl ??
    'https://195-2-75-249.sslip.io',
).replace(/\/$/, '');
const AGENT_TOKEN = process.env.CRM_AGENT_TOKEN ?? config.crmAgentToken;
const USERNAME = process.env.CRM_USERNAME ?? config.crmUsername;
const PASSWORD = process.env.CRM_PASSWORD ?? config.crmPassword;
const WORKING_DIRECTORY = path.resolve(process.env.LOCAL_AGENT_WORKDIR ?? config.workingDirectory ?? path.resolve(SCRIPT_DIR, '..'));
const INTERVAL_MS = Math.max(5_000, Number(process.env.LOCAL_AGENT_INTERVAL_MS ?? config.pollIntervalMs ?? 15_000));
const REQUEST_TIMEOUT_MS = Math.max(5_000, Number(process.env.LOCAL_AGENT_REQUEST_TIMEOUT_MS ?? config.requestTimeoutMs ?? 20_000));
const EXECUTION_TIMEOUT_MS = Math.max(
  60_000,
  Number(
    process.env.LOCAL_AGENT_EXECUTION_TIMEOUT_MS ??
      config.executionTimeoutMs ??
      2 * 60 * 60 * 1000,
  ),
);
const CLAUDE_ENABLED = process.env.CLAUDE_ENABLED === 'true' || config.claudeEnabled === true;
const ENABLED_AGENTS = new Set(
  String(process.env.CRM_AGENTS ?? config.agents ?? 'CODEX,CLOUD_CODE')
    .split(',')
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean),
);

if (!AGENT_TOKEN && (!USERNAME || !PASSWORD)) {
  throw new Error(`Set crmAgentToken in ${CONFIG_PATH}.`);
}

for (const agent of ENABLED_AGENTS) {
  if (!['CODEX', 'CLOUD_CODE'].includes(agent)) {
    throw new Error(`Unknown agent ${agent}. Use CODEX and/or CLOUD_CODE.`);
  }
}

let token = '';
let ticking = false;
const running = new Set();
const unavailableReported = new Set();
const recoveredAgents = new Set();

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function newestCodexExecutable() {
  if (process.platform !== 'win32' || !process.env.LOCALAPPDATA) return null;
  const root = path.join(process.env.LOCALAPPDATA, 'OpenAI', 'Codex', 'bin');
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return null;
  }

  const candidates = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const executable = path.join(root, entry.name, 'codex.exe');
    if (!(await exists(executable))) continue;
    candidates.push({ executable, modifiedAt: (await stat(executable)).mtimeMs });
  }
  candidates.sort((left, right) => right.modifiedAt - left.modifiedAt);
  return candidates[0]?.executable ?? null;
}

async function resolveExecutable(agent) {
  const configured =
    agent === 'CODEX'
      ? process.env.CODEX_EXECUTABLE ?? config.codexExecutable
      : process.env.CLAUDE_EXECUTABLE ?? config.claudeExecutable;

  if (configured && path.isAbsolute(configured) && (await exists(configured))) {
    return configured;
  }

  if (agent === 'CODEX') {
    return (await newestCodexExecutable()) ?? configured ?? 'codex';
  }
  if (process.platform === 'win32' && process.env.APPDATA) {
    const command = path.join(process.env.APPDATA, 'npm', 'claude.cmd');
    if (await exists(command)) return command;
  }
  return configured ?? 'claude';
}

async function request(pathname, options = {}, retry = true) {
  const { signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS), ...requestOptions } = options;
  const res = await fetch(`${BASE_URL}${pathname}`, {
    ...requestOptions,
    signal,
    headers: {
      'content-type': 'application/json',
      ...(AGENT_TOKEN || token ? { authorization: `Bearer ${AGENT_TOKEN || token}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  if (res.status === 401 && retry && !AGENT_TOKEN) {
    token = '';
    await login();
    return request(pathname, options, false);
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${options.method ?? 'GET'} ${pathname} -> ${res.status}: ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

async function login() {
  const res = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  }, false);
  token = res.access_token;
}

function taskPrompt(task) {
  return [
    `# ${task.title}`,
    '',
    'Ты работаешь по задаче, созданной с телефона в CRM.',
    `ID задачи: ${task.id}`,
    `Агент: ${task.assigneeKind}`,
    task.deadline ? `Срок: ${task.deadline}` : null,
    '',
    '## Техническое задание',
    '',
    task.description?.trim() || '(подробности не указаны)',
    '',
    '## Требования к работе',
    '',
    '- Изучи существующий проект и сохрани совместимость с его архитектурой.',
    '- Реализуй задачу полностью, запусти подходящие проверки и не публикуй изменения без явного требования в ТЗ.',
    '- Не отменяй и не перезаписывай чужие незакоммиченные изменения.',
    '- В финальном ответе кратко укажи: что сделано, какие файлы/части проекта изменены, какие проверки прошли и есть ли блокеры.',
  ].filter(Boolean).join('\n');
}

async function prepareRun(task) {
  const directory = path.join(SCRIPT_DIR, 'runs', task.id);
  await mkdir(directory, { recursive: true });
  const promptFile = path.join(directory, 'prompt.md');
  const resultFile = path.join(directory, 'result.md');
  const logFile = path.join(directory, 'execution.log');
  const prompt = taskPrompt(task);
  await writeFile(promptFile, prompt, 'utf8');
  return { directory, prompt, promptFile, resultFile, logFile };
}

async function commandFor(agent, run) {
  if (agent === 'CODEX') {
    return {
      executable: await resolveExecutable(agent),
      args: [
        'exec', '--cd', WORKING_DIRECTORY, '--sandbox', 'workspace-write',
        '--approve-for-me', '--color', 'never',
        '--output-last-message', run.resultFile, '-',
      ],
    };
  }

  return {
    executable: await resolveExecutable(agent),
    args: [
      '-p', '--permission-mode', 'auto', '--output-format', 'text',
      '--no-session-persistence',
    ],
  };
}

function execute(command, run) {
  return new Promise((resolve, reject) => {
    const log = createWriteStream(run.logFile, { flags: 'a' });
    const child = spawn(command.executable, command.args, {
      cwd: WORKING_DIRECTORY,
      windowsHide: true,
      shell: process.platform === 'win32' && !command.executable.toLowerCase().endsWith('.exe'),
      env: {
        ...process.env,
        FORCE_COLOR: '0',
        NO_COLOR: '1',
        PYTHONUTF8: '1',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let output = '';
    let settled = false;

    const stop = () => {
      if (child.exitCode !== null) return;
      if (process.platform === 'win32') {
        spawn('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], {
          windowsHide: true,
          stdio: 'ignore',
        });
      } else {
        child.kill('SIGTERM');
      }
    };
    const timeout = setTimeout(stop, EXECUTION_TIMEOUT_MS);

    const record = (chunk, target) => {
      const text = chunk.toString();
      output += text;
      if (output.length > 20_000) output = output.slice(-20_000);
      log.write(text);
      target.write(text);
    };

    child.stdout.on('data', (chunk) => record(chunk, process.stdout));
    child.stderr.on('data', (chunk) => record(chunk, process.stderr));
    child.stdin.on('error', (error) => {
      if (error.code !== 'EPIPE') logError('agent stdin:', error.message);
    });
    child.once('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      log.end();
      reject(error);
    });
    child.once('exit', (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      log.end();
      resolve({ code, signal, output });
    });
    child.stdin.end(run.prompt);
  });
}

async function updateTask(id, body) {
  return request(`/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

async function setStatus(id, status) {
  return request(`/tasks/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

async function agentAction(id, action, assigneeKind, summary) {
  return request(`/tasks-agent/${id}/${action}`, {
    method: action === 'claim' ? 'POST' : 'PATCH',
    body: JSON.stringify({
      assigneeKind,
      ...(summary === undefined ? {} : { summary }),
    }),
  });
}

async function recoverAgentTasks(assigneeKind) {
  if (!AGENT_TOKEN || recoveredAgents.has(assigneeKind)) return;
  try {
    const result = await request('/tasks-agent/recover', {
      method: 'POST',
      body: JSON.stringify({ assigneeKind }),
    });
    recoveredAgents.add(assigneeKind);
    if (result.recovered > 0) {
      log(`[${assigneeKind}] returned ${result.recovered} stale task(s) to the queue`);
    }
  } catch (error) {
    // Совместимость на время выкладки: старый backend ещё не знает endpoint,
    // но очередь новых задач должна продолжать работать.
    if (String(error.message).includes('-> 404:')) {
      recoveredAgents.add(assigneeKind);
      log(`[${assigneeKind}] stale-task recovery is not deployed yet`);
      return;
    }
    throw error;
  }
}

async function resultSummary(task, run, execution) {
  let result = '';
  try {
    result = (await readFile(run.resultFile, 'utf8')).trim();
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (!result) result = execution.output.trim();
  if (!result) result = 'Команда завершилась без текстового отчета.';

  const agentName = task.assigneeKind === 'CODEX' ? 'Codex' : 'Claude Code';
  const prefix = execution.code === 0
    ? `${agentName} завершил задачу.`
    : `${agentName} завершился с кодом ${execution.code ?? 'unknown'}${execution.signal ? ` (${execution.signal})` : ''}.`;
  return `${prefix}\n\n${result}`.slice(0, 4_000);
}

async function handleTask(task) {
  if (running.has(task.id)) return;
  running.add(task.id);
  let heartbeat;

  try {
    const run = await prepareRun(task);
    const command = await commandFor(task.assigneeKind, run);
    const agentName = task.assigneeKind === 'CODEX' ? 'Codex' : 'Claude Code';
    if (AGENT_TOKEN) {
      await agentAction(task.id, 'claim', task.assigneeKind);
    } else {
      await setStatus(task.id, 'IN_PROGRESS');
      await updateTask(task.id, { agentSummary: `${agentName} получил задачу и начал работу.` });
    }

    heartbeat = setInterval(() => {
      const summary = `${agentName} выполняет задачу...`;
      const heartbeatRequest = AGENT_TOKEN
        ? agentAction(task.id, 'heartbeat', task.assigneeKind, summary)
        : updateTask(task.id, { agentSummary: summary });
      heartbeatRequest.catch((error) =>
        logError(`[${task.id}] heartbeat:`, error.message),
      );
    }, 30_000);

    log(`[${task.id}] starting ${command.executable} in ${WORKING_DIRECTORY}`);
    const execution = await execute(command, run);
    const summary = await resultSummary(task, run, execution);
    if (AGENT_TOKEN) {
      await agentAction(
        task.id,
        execution.code === 0 ? 'complete' : 'fail',
        task.assigneeKind,
        summary,
      );
    } else {
      await updateTask(task.id, { agentSummary: summary });
      if (execution.code === 0) await setStatus(task.id, 'DONE');
    }
    log(`[${task.id}] finished with code ${execution.code}`);
  } catch (error) {
    const missing = error.code === 'ENOENT';
    const agentName = task.assigneeKind === 'CODEX' ? 'Codex' : 'Claude Code';
    const message = missing
      ? `${agentName} не установлен или не найден в PATH ноутбука.`
      : `Ошибка локального агента: ${error.message}`;
    logError(`[${task.id}]`, error);
    try {
      const summary = message.slice(0, 4_000);
      if (AGENT_TOKEN) {
        await agentAction(task.id, 'fail', task.assigneeKind, summary);
      } else {
        await updateTask(task.id, { agentSummary: summary });
      }
    } catch (reportError) {
      logError(`[${task.id}] cannot report error:`, reportError.message);
    }
  } finally {
    if (heartbeat) clearInterval(heartbeat);
    running.delete(task.id);
  }
}

async function reportUnavailableTask(task) {
  if (unavailableReported.has(task.id)) return;
  unavailableReported.add(task.id);
  const summary = 'Claude Code пока не авторизован на ноутбуке. Задача останется новой и запустится после входа в Claude Code.';
  if (AGENT_TOKEN) {
    await agentAction(task.id, 'note', task.assigneeKind, summary);
  } else {
    await updateTask(task.id, { agentSummary: summary });
  }
}

async function tick() {
  if (ticking) return;
  ticking = true;
  try {
    if (!AGENT_TOKEN && !token) await login();
    for (const agent of ENABLED_AGENTS) {
      await recoverAgentTasks(agent);
      const tasks = await request(
        AGENT_TOKEN
          ? `/tasks-agent?assigneeKind=${agent}`
          : `/tasks?assigneeKind=${agent}`,
      );
      for (const task of tasks.filter((item) => item.status === 'OPEN')) {
        if (agent === 'CLOUD_CODE' && !CLAUDE_ENABLED) {
          await reportUnavailableTask(task);
          continue;
        }
        await handleTask(task);
      }
    }
  } finally {
    ticking = false;
  }
}

log(`CRM local dispatcher -> ${BASE_URL}`);
log(`Agents: ${[...ENABLED_AGENTS].join(', ')}; workspace: ${WORKING_DIRECTORY}`);

async function runTick() {
  try {
    await tick();
  } catch (error) {
    logError('dispatcher tick failed:', error);
    token = '';
  }
}

await runTick();
const runOnce = process.argv.includes('--once');
const timer = runOnce ? null : setInterval(runTick, INTERVAL_MS);

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (timer) clearInterval(timer);
    process.exitCode = 0;
  });
}
