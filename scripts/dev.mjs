import { spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';

const npmLaunch = resolveNpmLaunch();

const renderer = spawnNpm(['run', 'dev:renderer']);

let electronProcess = null;
let exiting = false;

const cleanup = () => {
  if (exiting) return;
  exiting = true;
  renderer.kill();
  if (electronProcess) {
    electronProcess.kill();
  }
  process.exit();
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
renderer.on('exit', cleanup);

await waitForRenderer('http://127.0.0.1:5173');

electronProcess = spawn(
  npmLaunch.command,
  [...npmLaunch.prefixArgs, 'exec', 'electron', 'electron/main.cjs'],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      VITE_DEV_SERVER_URL: 'http://127.0.0.1:5173'
    },
    shell: false
  }
);

electronProcess.on('exit', cleanup);

function waitForRenderer(url) {
  return new Promise((resolve) => {
    const timer = setInterval(() => {
      const req = http.get(url, () => {
        clearInterval(timer);
        req.destroy();
        resolve();
      });
      req.on('error', () => {
        req.destroy();
      });
    }, 450);
  });
}

function spawnNpm(args, extraEnv = {}) {
  return spawn(
    npmLaunch.command,
    [...npmLaunch.prefixArgs, ...args],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        ...extraEnv
      },
      shell: false
    }
  );
}

function resolveNpmLaunch() {
  const npmExecPath = process.env.npm_execpath;
  if (npmExecPath) {
    return {
      command: process.execPath,
      prefixArgs: [npmExecPath]
    };
  }

  if (process.platform === 'win32') {
    const npmCliPath = path.join(
      path.dirname(process.execPath),
      'node_modules',
      'npm',
      'bin',
      'npm-cli.js'
    );

    return {
      command: process.execPath,
      prefixArgs: [npmCliPath]
    };
  }

  return {
    command: 'npm',
    prefixArgs: []
  };
}
