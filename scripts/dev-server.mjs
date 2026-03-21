import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const execFileAsync = promisify(execFile);
const PORT = 3000;
const HOST = '0.0.0.0';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const viteBin = path.resolve(rootDir, 'node_modules', 'vite', 'bin', 'vite.js');

const log = (message) => {
  process.stdout.write(`[dev-server] ${message}\n`);
};

const getListeningPids = async (port) => {
  if (process.platform === 'win32') {
    const command = [
      '-NoProfile',
      '-Command',
      `Get-NetTCPConnection -State Listen -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique`,
    ];

    try {
      const { stdout } = await execFileAsync('powershell.exe', command, { cwd: rootDir });
      return stdout
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean)
        .map(Number)
        .filter(Number.isFinite);
    } catch (error) {
      return [];
    }
  }

  try {
    const { stdout } = await execFileAsync('lsof', ['-ti', `tcp:${port}`], { cwd: rootDir });
    return stdout
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .map(Number)
      .filter(Number.isFinite);
  } catch (error) {
    return [];
  }
};

const killProcess = async (pid) => {
  if (!pid || pid === process.pid) return;

  if (process.platform === 'win32') {
    await execFileAsync('taskkill', ['/PID', String(pid), '/F', '/T'], { cwd: rootDir });
    return;
  }

  process.kill(pid, 'SIGKILL');
};

const freePort = async (port) => {
  const pids = await getListeningPids(port);
  if (pids.length === 0) {
    log(`port ${port} is free`);
    return;
  }

  log(`port ${port} is occupied by PID: ${pids.join(', ')}, stopping...`);
  await Promise.all(pids.map(killProcess));
  log(`port ${port} released`);
};

const startVite = () => {
  const child = spawn(
    process.execPath,
    [viteBin, '--host', HOST, '--port', String(PORT), '--strictPort', '--force'],
    {
      cwd: rootDir,
      stdio: 'inherit',
      env: process.env,
    },
  );

  const forwardSignal = (signal) => {
    if (!child.killed) {
      child.kill(signal);
    }
  };

  process.on('SIGINT', forwardSignal);
  process.on('SIGTERM', forwardSignal);

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });
};

await freePort(PORT);
startVite();
