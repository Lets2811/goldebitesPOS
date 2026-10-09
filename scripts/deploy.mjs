// Runs deploy/deploy.sh with bash, wherever bash is.
//
// On Windows, `npm run` uses cmd.exe, where bash is usually not on the PATH
// even though Git for Windows ships one. This finds it, so `npm run deploy`
// works the same from cmd, PowerShell and Git Bash. No dependencies.

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function findBash() {
  if (process.platform !== 'win32') return 'bash';

  // Git's bash first: a `bash` on the Windows PATH may be WSL's, which sees
  // neither this repo's Windows paths nor the SSH key the deploy uses.
  const candidates = [
    process.env.GB_DEPLOY_BASH,
    ...[process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Programs')]
      .filter(Boolean)
      .map((dir) => join(dir, 'Git', 'bin', 'bash.exe')),
  ].filter(Boolean);

  // Wherever git itself is installed, its bash is next to it.
  const git = spawnSync('where', ['git'], { encoding: 'utf8' });
  for (const line of (git.stdout ?? '').split(/\r?\n/).filter(Boolean)) {
    candidates.push(join(dirname(line), '..', 'bin', 'bash.exe'));
  }

  return candidates.find((candidate) => existsSync(candidate));
}

const bash = findBash();
if (!bash) {
  console.error(
    'No se encontró bash. Instala Git for Windows (https://git-scm.com/download/win) ' +
      'o indica la ruta de bash.exe en la variable GB_DEPLOY_BASH.',
  );
  process.exit(1);
}

const result = spawnSync(bash, ['deploy/deploy.sh', ...process.argv.slice(2)], { cwd: root, stdio: 'inherit' });
if (result.error) {
  console.error(`No se pudo ejecutar bash (${bash}): ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
