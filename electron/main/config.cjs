const path = require('node:path');

const APP_NAME = 'wall-labeler-desktop';
const PROJECT_EXTENSION = 'wall.json';
const APP_ROOT = path.resolve(__dirname, '..', '..');
const PROJECT_VENV_ROOT = path.join(APP_ROOT, '.venv');

function getBundledPythonRoot() {
  return path.join(process.resourcesPath, 'python-runtime');
}

function getBundledWorkerRoot() {
  return path.join(process.resourcesPath, 'python');
}

function getBundledWorkerBinary() {
  return path.join(
    process.resourcesPath,
    'worker',
    process.platform === 'win32' ? 'label_worker.exe' : 'label_worker'
  );
}

module.exports = {
  APP_NAME,
  PROJECT_EXTENSION,
  APP_ROOT,
  PROJECT_VENV_ROOT,
  getBundledPythonRoot,
  getBundledWorkerRoot,
  getBundledWorkerBinary
};
