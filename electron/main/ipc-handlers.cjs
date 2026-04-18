const { dialog, ipcMain } = require('electron');
const { loadImagePayload } = require('./image-payload.cjs');
const {
  buildMaskFileName,
  buildProjectFileName,
  readProjectFile,
  serializeProject,
  writeProjectFile
} = require('./project-files.cjs');
const { runPythonWorker } = require('./python-worker.cjs');

function registerIpcHandlers() {
  registerDialogHandlers();
  registerProjectHandlers();
  registerWorkerHandlers();
}

function registerDialogHandlers() {
  ipcMain.handle('dialogs:open-image', openImageFromDialog);
  ipcMain.handle('dialogs:open-project', openProjectFromDialog);
}

function registerProjectHandlers() {
  ipcMain.handle('projects:save', saveProjectFromRenderer);
}

function registerWorkerHandlers() {
  ipcMain.handle('worker:detect-corners', detectCornersWithWorker);
  ipcMain.handle('worker:export-mask', exportMaskWithWorker);
}

async function openImageFromDialog() {
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

  return loadImagePayload(result.filePaths[0]);
}

async function openProjectFromDialog() {
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
  const project = await readProjectFile(projectPath);
  const image = await loadImagePayload(project.image.filePath);

  return {
    projectPath,
    project,
    image
  };
}

async function detectCornersWithWorker(_event, payload) {
  if (!payload?.filePath) {
    throw new Error('缺少图片路径');
  }

  return runPythonWorker([
    'detect-corners',
    '--image',
    payload.filePath,
    '--max-corners',
    String(payload.maxCorners ?? 800)
  ]);
}

async function saveProjectFromRenderer(_event, payload) {
  if (!payload?.project) {
    throw new Error('缺少项目内容');
  }

  let targetPath = payload.projectPath || null;
  if (!targetPath || payload.saveAs) {
    const saveResult = await dialog.showSaveDialog({
      title: '保存项目',
      defaultPath: buildProjectFileName(payload.project?.image),
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

  const project = await writeProjectFile(targetPath, payload.project);
  return {
    projectPath: targetPath,
    project
  };
}

async function exportMaskWithWorker(_event, payload) {
  if (!payload?.project) {
    throw new Error('缺少项目内容');
  }

  const saveResult = await dialog.showSaveDialog({
    title: '导出 Mask',
    defaultPath: buildMaskFileName(payload.project?.image),
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

  const workerResult = await runPythonWorker(
    ['export-mask', '--output', saveResult.filePath],
    JSON.stringify(serializeProject(payload.project, payload.projectPath || null))
  );

  return {
    outputPath: saveResult.filePath,
    ...workerResult
  };
}

module.exports = {
  registerIpcHandlers
};
