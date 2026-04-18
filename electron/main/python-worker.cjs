const fssync = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { app } = require('electron');
const {
  APP_ROOT,
  PROJECT_VENV_ROOT,
  getBundledPythonRoot,
  getBundledWorkerBinary,
  getBundledWorkerRoot
} = require('./config.cjs');

async function runPythonWorker(args, stdinData = null) {
  const workerBinary = resolveBundledWorkerBinary();
  if (workerBinary) {
    const result = await spawnWorkerProcess(workerBinary, args, stdinData);
    return JSON.parse(result);
  }

  const pythonCandidates = resolvePythonCandidates();
  const scriptPath = resolvePythonWorkerScript();
  const errors = [];

  if (pythonCandidates.length === 0) {
    throw buildMissingPythonRuntimeError();
  }

  for (const pythonBin of pythonCandidates) {
    try {
      const result = await spawnWorkerProcess(pythonBin, [scriptPath, ...args], stdinData);
      return JSON.parse(result);
    } catch (error) {
      errors.push({ pythonBin, error });
    }
  }

  throw buildPythonWorkerError(errors);
}

function resolveBundledWorkerBinary() {
  if (!app.isPackaged) {
    return null;
  }

  const bundledWorkerBinary = getBundledWorkerBinary();
  if (fssync.existsSync(bundledWorkerBinary)) {
    return bundledWorkerBinary;
  }

  return null;
}

function resolvePythonCandidates() {
  const candidates = [];

  pushValidatedPythonBin(candidates, process.env.PYTHON_BIN);

  if (app.isPackaged) {
    pushPythonRuntimeCandidates(candidates, getBundledPythonRoot());
  } else {
    pushPythonRuntimeCandidates(candidates, PROJECT_VENV_ROOT);
  }

  return [...new Set(candidates)];
}

function resolvePythonWorkerScript() {
  const candidate = app.isPackaged
    ? path.join(getBundledWorkerRoot(), 'label_worker.py')
    : path.join(APP_ROOT, 'python', 'label_worker.py');

  if (!fssync.existsSync(candidate)) {
    const locationHint = app.isPackaged
      ? `打包后应随应用附带：${candidate}`
      : `开发环境应存在：${candidate}`;
    throw new Error(`缺少 Python worker 脚本。\n${locationHint}`);
  }

  return candidate;
}

function pushValidatedPythonBin(candidates, pythonBin) {
  if (!pythonBin) {
    return;
  }

  const normalized = path.resolve(pythonBin);
  if (!fssync.existsSync(normalized)) {
    return;
  }

  if (app.isPackaged) {
    if (isInsideDirectory(normalized, getBundledPythonRoot())) {
      candidates.push(normalized);
    }
    return;
  }

  if (isInsideDirectory(normalized, PROJECT_VENV_ROOT)) {
    candidates.push(normalized);
  }
}

function pushPythonRuntimeCandidates(candidates, envRoot) {
  if (!envRoot) {
    return;
  }

  const runtimeCandidates = process.platform === 'win32'
    ? [
        path.join(envRoot, 'Scripts', 'python.exe'),
        path.join(envRoot, 'python.exe')
      ]
    : [
        path.join(envRoot, 'bin', 'python'),
        path.join(envRoot, 'python')
      ];

  for (const pythonPath of runtimeCandidates) {
    if (fssync.existsSync(pythonPath)) {
      candidates.push(pythonPath);
    }
  }
}

function isInsideDirectory(targetPath, parentDir) {
  const relative = path.relative(parentDir, targetPath);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function buildMissingPythonRuntimeError() {
  if (app.isPackaged) {
    return new Error(
      `当前发布包未包含可用的 worker。\n优先期望的 worker 可执行文件：${getBundledWorkerBinary()}\n或备选 Python 运行时目录：${getBundledPythonRoot()}\n以及 worker 脚本目录：${getBundledWorkerRoot()}`
    );
  }

  return new Error(
    `当前项目缺少可用的 Python 虚拟环境。\n请在项目根目录创建并安装 .venv，例如：uv venv && .\\.venv\\Scripts\\python.exe -m pip install -r python\\requirements.txt`
  );
}

function buildPythonWorkerError(errors) {
  const preferred = errors.find(({ error }) => error?.code !== 'ENOENT') ?? errors[0];
  const attemptDetails = errors
    .map(({ pythonBin, error }) => `${pythonBin}: ${error.message}`)
    .join('\n');

  const runtimeHint = app.isPackaged
    ? `发布版只会尝试随应用附带的 Python 运行时：${getBundledPythonRoot()}`
    : `开发环境只会尝试项目虚拟环境：${PROJECT_VENV_ROOT}`;

  const wrapped = new Error(
    `Python worker 启动失败。\n${runtimeHint}\n优先错误: ${preferred.error.message}\n已尝试:\n${attemptDetails}`
  );
  wrapped.cause = preferred.error;
  return wrapped;
}

function spawnWorkerProcess(command, args, stdinData = null) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: resolveWorkerCwd(),
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
        return;
      }

      reject(new Error(stderr.trim() || `Python worker 退出码 ${code}`));
    });

    if (stdinData) {
      child.stdin.write(stdinData);
    }
    child.stdin.end();
  });
}

function resolveWorkerCwd() {
  if (app.isPackaged) {
    return process.resourcesPath;
  }

  return APP_ROOT;
}

module.exports = {
  runPythonWorker
};
