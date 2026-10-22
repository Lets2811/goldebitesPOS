// Runs the Capacitor CLI for one of the phone apps (see capacitor.config.ts):
//   node scripts/cap-app.mjs <mesero|domiciliario> <cap arguments...>
// e.g. `node scripts/cap-app.mjs domiciliario sync android`.
// The app goes in CAP_APP, which npm scripts cannot set the same way on
// Windows and elsewhere.
import { spawnSync } from 'node:child_process';

const [app, ...args] = process.argv.slice(2);
if (!app || args.length === 0) {
  console.error('Usage: node scripts/cap-app.mjs <mesero|domiciliario> <cap arguments...>');
  process.exit(1);
}

const result = spawnSync('npx', ['cap', ...args], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, CAP_APP: app },
});
process.exit(result.status ?? 1);
