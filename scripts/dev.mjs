// Starts the development servers of one product together, in this terminal:
//
//   npm run POS    the POS: its API (GB-BE) and its web app (GB)
//   npm run tura   TURA: its service (TURA/api) and its app (TURA/app)
//
// Each line of output is prefixed with the server it comes from, and Ctrl+C
// stops them all. No dependencies: it only needs Node.

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const GROUPS = {
  pos: [
    { name: 'api', dir: 'GB-BE', script: 'start:dev', url: 'http://localhost:3000' },
    { name: 'web', dir: 'GB', script: 'dev', url: 'http://localhost:5173' },
  ],
  tura: [
    { name: 'api', dir: 'TURA/api', script: 'dev', url: 'http://localhost:3100' },
    { name: 'app', dir: 'TURA/app', script: 'dev', url: 'http://localhost:5174' },
  ],
};

const group = GROUPS[(process.argv[2] ?? '').toLowerCase()];
if (!group) {
  console.error(`Usage: node scripts/dev.mjs <${Object.keys(GROUPS).join('|')}>`);
  process.exit(1);
}

const missing = group.filter((server) => !existsSync(join(root, server.dir, 'node_modules')));
if (missing.length > 0) {
  for (const server of missing) {
    console.error(`${server.dir} has no dependencies installed. Run: cd ${server.dir} && npm install`);
  }
  process.exit(1);
}

const COLORS = ['\x1b[36m', '\x1b[35m'];
const RESET = '\x1b[0m';
const windows = process.platform === 'win32';
const running = new Set();

for (const [index, server] of group.entries()) {
  const label = `${COLORS[index % COLORS.length]}[${server.name}]${RESET} `;
  console.log(`${label}${server.dir}: npm run ${server.script}  (${server.url})`);

  // Through the shell, which is how npm is found on Windows.
  const child = spawn(`npm run ${server.script}`, {
    cwd: join(root, server.dir),
    shell: true,
    // Keeps the colours the servers print when they think they are on a terminal.
    env: { ...process.env, FORCE_COLOR: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  running.add(child);

  for (const stream of [child.stdout, child.stderr]) {
    let pending = '';
    stream.setEncoding('utf8');
    stream.on('data', (chunk) => {
      const lines = (pending + chunk).split('\n');
      pending = lines.pop();
      for (const line of lines) {
        process.stdout.write(`${label}${line}\n`);
      }
    });
    stream.on('end', () => {
      if (pending) {
        process.stdout.write(`${label}${pending}\n`);
      }
    });
  }

  child.on('exit', (code) => {
    running.delete(child);
    console.log(`${label}stopped${code ? ` (exit code ${code})` : ''}`);
    if (running.size === 0) {
      process.exit(code ?? 0);
    }
  });
}

let stopping = false;
function stopAll() {
  if (stopping) {
    return;
  }
  stopping = true;
  for (const child of running) {
    if (windows) {
      // Each server is a tree (shell, npm, node); killing only its root would leave the rest running.
      spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      child.kill('SIGTERM');
    }
  }
}
process.on('SIGINT', stopAll);
process.on('SIGTERM', stopAll);
