const { app, BrowserWindow, dialog, ipcMain, nativeImage } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const fssync = require('node:fs');
const { spawn } = require('node:child_process');

const APP_NAME = 'wall-labeler-desktop';
const PROJECT_EXTENSION = 'wall.json';
const APP_ROOT = path.resolve(__dirname, '..');
const PROJECT_VENV_ROOT = path.join(APP_ROOT, '.venv');
const BUNDLED_PYTHON_ROOT = path.join(process.resourcesPath, 'python-runtime');
const BUNDLED_WORKER_ROOT = path.join(process.resourcesPath, 'python');

function createWindow() {
  const win = new BrowserWindow({
    width: 1520,
    height: 960,
    minWidth: 1200,
    minHeight: 760,
    title: APP_NAME,
    backgroundColor: '#eef2f7',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    win.loadURL(devServerUrl);
  } else {
    win.loadFile(path.join(APP_ROOT, 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

function registerIpcHandlers() {
  ipcMain.handle('dialog:open-image', async () => {
    const result = await dialog.showOpenDialog({
      title: '导入图片',
      properties: ['openFile'],
      filters: [
        {
          name: 'Image',
          extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp']
        }
      ]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const filePath = result.filePaths[0];
    return loadImagePayload(filePath);
  });

  ipcMain.handle('dialog:open-project', async () => {
    const result = await dialog.showOpenDialog({
      title: '打开项目',
      properties: ['openFile'],
      filters: [
        {
          name: 'wall-labeler-desktop Project',
          extensions: ['json']
        }
      ]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const projectPath = result.filePaths[0];
    const raw = await fs.readFile(projectPath, 'utf8');
    const project = JSON.parse(raw);
    const normalized = normalizeProject(project, projectPath);
    const image = await loadImagePayload(normalized.image.filePath);

    return {
      projectPath,
      project: normalized,
      image
    };
  });

  ipcMain.handle('corners:detect', async (_event, payload) => {
    if (!payload?.filePath) {
      throw new Error('缺少图片路径');
    }
    const workerResult = await runPythonWorker([
      'detect-corners',
      '--image',
      payload.filePath,
      '--max-corners',
      String(payload.maxCorners ?? 800)
    ]);
    return workerResult;
  });

  ipcMain.handle('project:save', async (_event, payload) => {
    if (!payload?.project) {
      throw new Error('缺少项目内容');
    }

    let targetPath = payload.projectPath || null;
    if (!targetPath || payload.saveAs) {
      const suggestedName = buildProjectFileName(payload.project?.image);
      const saveResult = await dialog.showSaveDialog({
        title: '保存项目',
        defaultPath: suggestedName,
        filters: [
          {
            name: 'wall-labeler-desktop Project',
            extensions: ['json']
          }
        ]
      });

      if (saveResult.canceled || !saveResult.filePath) {
        return null;
      }
      targetPath = saveResult.filePath;
    }

    const serialized = serializeProject(payload.project, targetPath);
    await fs.writeFile(targetPath, JSON.stringify(serialized, null, 2), 'utf8');

    return {
      projectPath: targetPath,
      project: normalizeProject(serialized, targetPath)
    };
  });

  ipcMain.handle('project:export-mask', async (_event, payload) => {
    if (!payload?.project) {
      throw new Error('缺少项目内容');
    }

    const defaultPath = buildMaskFileName(payload.project?.image);
    const saveResult = await dialog.showSaveDialog({
      title: '导出 Mask',
      defaultPath,
      filters: [
        {
          name: 'PNG',
          extensions: ['png']
        }
      ]
    });

    if (saveResult.canceled || !saveResult.filePath) {
      return null;
    }

    const normalized = serializeProject(payload.project, payload.projectPath || null);
    const workerResult = await runPythonWorker(
      ['export-mask', '--output', saveResult.filePath],
      JSON.stringify(normalized)
    );

    return {
      outputPath: saveResult.filePath,
      ...workerResult
    };
  });
}

function buildProjectFileName(imageMeta) {
  const fileName = imageMeta?.fileName || 'label';
  const base = path.parse(fileName).name || 'label';
  const dir = imageMeta?.filePath ? path.dirname(imageMeta.filePath) : undefined;
  const output = `${base}.${PROJECT_EXTENSION}`;
  return dir ? path.join(dir, output) : output;
}

function buildMaskFileName(imageMeta) {
  const fileName = imageMeta?.fileName || 'label';
  const base = path.parse(fileName).name || 'label';
  const dir = imageMeta?.filePath ? path.dirname(imageMeta.filePath) : undefined;
  const output = `${base}_mask.png`;
  return dir ? path.join(dir, output) : output;
}

function serializeProject(project, projectPath) {
  const clone = JSON.parse(JSON.stringify(project));
  clone.kind = clone.kind || 'wall-label-project';
  clone.version = clone.version || 1;
  clone.meta = clone.meta || {};
  clone.meta.updatedAt = new Date().toISOString();
  clone.meta.createdAt = clone.meta.createdAt || clone.meta.updatedAt;

  if (!clone.image?.filePath) {
    throw new Error('项目中缺少 image.filePath');
  }

  if (projectPath) {
    const imagePath = clone.image.filePath;
    const relative = path.relative(path.dirname(projectPath), imagePath);
    clone.image.filePath = relative;
  }

  return clone;
}

function normalizeProject(project, projectPath) {
  const clone = JSON.parse(JSON.stringify(project));
  if (!clone.image?.filePath) {
    throw new Error('项目文件缺少 image.filePath');
  }

  if (projectPath && !path.isAbsolute(clone.image.filePath)) {
    clone.image.filePath = path.resolve(path.dirname(projectPath), clone.image.filePath);
  }

  clone.kind = clone.kind || 'wall-label-project';
  clone.version = clone.version || 1;
  clone.settings = clone.settings || {};
  clone.settings.defaultWallWidthPx = Math.max(1, Number(clone.settings.defaultWallWidthPx ?? 4));
  clone.settings.snapRadiusPx = Number(clone.settings.snapRadiusPx ?? 10);
  clone.settings.snapToCorners = clone.settings.snapToCorners ?? true;
  clone.settings.theme = clone.settings.theme || 'light';
  clone.settings.showCorners = clone.settings.showCorners ?? true;
  clone.candidateCorners = Array.isArray(clone.candidateCorners) ? clone.candidateCorners : [];
  clone.walls = Array.isArray(clone.walls) ? clone.walls : [];
  clone.meta = clone.meta || {};
  return clone;
}

async function loadImagePayload(filePath) {
  const img = nativeImage.createFromPath(filePath);
  const size = img.getSize();
  if (!size.width || !size.height) {
    throw new Error(`无法读取图片：${filePath}`);
  }

  return {
    fileName: path.basename(filePath),
    filePath,
    width: size.width,
    height: size.height,
    dataUrl: img.toDataURL()
  };
}

async function runPythonWorker(args, stdinData = null) {
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

  if (errors.length > 0) {
    throw buildPythonWorkerError(errors);
  }

  throw new Error('没有找到可用的 Python 解释器');
}

function resolvePythonCandidates() {
  const candidates = [];

  pushValidatedPythonBin(candidates, process.env.PYTHON_BIN);

  if (app.isPackaged) {
    pushPythonRuntimeCandidates(candidates, BUNDLED_PYTHON_ROOT);
  } else {
    pushPythonRuntimeCandidates(candidates, PROJECT_VENV_ROOT);
  }

  return [...new Set(candidates)];
}

function resolvePythonWorkerScript() {
  const candidate = app.isPackaged
    ? path.join(BUNDLED_WORKER_ROOT, 'label_worker.py')
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
    if (isInsideDirectory(normalized, BUNDLED_PYTHON_ROOT)) {
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
      `当前发布包未包含 Python 运行时。\n需要随应用附带目录：${BUNDLED_PYTHON_ROOT}\n以及 worker 脚本目录：${BUNDLED_WORKER_ROOT}`
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
    ? `发布版只会尝试随应用附带的 Python 运行时：${BUNDLED_PYTHON_ROOT}`
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
      cwd: APP_ROOT,
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
