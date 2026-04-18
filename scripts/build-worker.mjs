import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const pythonBin = process.platform === 'win32'
  ? path.join(projectRoot, '.venv', 'Scripts', 'python.exe')
  : path.join(projectRoot, '.venv', 'bin', 'python');

const workerEntrypoint = path.join(projectRoot, 'python', 'label_worker.py');
const workerDistDir = path.join(projectRoot, 'build', 'worker');
const pyinstallerRoot = path.join(projectRoot, 'build', 'pyinstaller');

await ensureProjectPython();
await fs.rm(workerDistDir, { recursive: true, force: true });
await fs.rm(pyinstallerRoot, { recursive: true, force: true });

await runCommand(pythonBin, ['-m', 'PyInstaller', '--version']);
await runCommand(pythonBin, [
  '-m',
  'PyInstaller',
  '--noconfirm',
  '--clean',
  '--onefile',
  '--name',
  'label_worker',
  '--distpath',
  workerDistDir,
  '--workpath',
  path.join(pyinstallerRoot, 'build'),
  '--specpath',
  path.join(pyinstallerRoot, 'spec'),
  workerEntrypoint
], { stdio: 'inherit' });

const workerBinary = process.platform === 'win32'
  ? path.join(workerDistDir, 'label_worker.exe')
  : path.join(workerDistDir, 'label_worker');

await fs.access(workerBinary);
console.log(`Built worker: ${workerBinary}`);

async function ensureProjectPython() {
  try {
    await fs.access(pythonBin);
  } catch {
    throw new Error(
      `Project Python not found: ${pythonBin}\nCreate the local venv first with "uv venv".`
    );
  }
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      stdio: options.stdio ?? 'pipe',
      shell: false
    });

    let stderr = '';

    if (child.stderr) {
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });
    }

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr.trim() || `${command} exited with code ${code}`));
    });
  });
}
