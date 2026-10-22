// Builds a test installer (APK) of one of the phone apps, ready to install:
//   node scripts/build-apk.mjs <mesero|domiciliario> [--local]
//   (npm run apk:mesero, npm run apk:domiciliario, and their :local versions)
//
// - Without --local: the app with its screens inside, talking to staging (or
//   to VITE_API_BASE_URL when it is set). Works anywhere with internet.
// - With --local: the app loads this computer instead (`npm run dev:<app>`
//   must be running, and the phone on the same Wi-Fi): changes to the screens
//   show by closing and opening the app, without building again.
//
// Each build raises the app's version, so it installs over the previous one
// (keeping the session). The APK lands in GB/apks/.
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir, networkInterfaces } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const APPS = {
  mesero: { androidDir: 'android', devPort: 5176, label: 'Mesero' },
  domiciliario: { androidDir: 'android-domiciliario', devPort: 5177, label: 'Domicilios' },
};

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [appName, ...flags] = process.argv.slice(2);
const app = APPS[appName];
if (!app) {
  console.error(`Usage: node scripts/build-apk.mjs <${Object.keys(APPS).join('|')}> [--local]`);
  process.exit(1);
}
const local = flags.includes('--local');
const windows = process.platform === 'win32';

function run(command, args, options = {}) {
  const line = [command, ...args].join(' ');
  console.log(`\n> ${line}`);
  // One command line (no separate args): Windows runs npm and gradlew through its shell.
  const result = spawnSync(line, { stdio: 'inherit', shell: true, cwd: root, ...options });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

/** This computer's address on the Wi-Fi, for a phone on the same network. */
function lanAddress() {
  const candidates = Object.values(networkInterfaces())
    .flat()
    .filter((net) => net && net.family === 'IPv4' && !net.internal);
  const preferred = candidates.find((net) => /^(192\.168|10\.|172\.(1[6-9]|2\d|3[01]))\./.test(net.address));
  return (preferred ?? candidates[0])?.address;
}

/**
 * A Java Gradle can run with. Android Studio's own may be too new for this
 * Gradle (Java 25), so a Java 21 downloaded by Android Studio comes first.
 */
function javaHome() {
  const jdks = join(homedir(), '.jdks');
  if (existsSync(jdks)) {
    const java21 = readdirSync(jdks).find(
      (name) => /21\./.test(name) && existsSync(join(jdks, name, 'bin', windows ? 'java.exe' : 'java')),
    );
    if (java21) return join(jdks, java21);
  }
  if (process.env.JAVA_HOME) return process.env.JAVA_HOME;
  const studio = windows ? 'C:/Program Files/Android/Android Studio/jbr' : '/Applications/Android Studio.app/Contents/jbr/Contents/Home';
  return existsSync(studio) ? studio : undefined;
}

function androidHome() {
  if (process.env.ANDROID_HOME) return process.env.ANDROID_HOME;
  const sdk = windows ? join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk') : join(homedir(), 'Library', 'Android', 'sdk');
  return existsSync(sdk) ? sdk : undefined;
}

/** Raises versionCode by one; versionName follows it (1.0.<code>). */
function bumpVersion() {
  const gradleFile = join(root, app.androidDir, 'app', 'build.gradle');
  const gradle = readFileSync(gradleFile, 'utf8');
  const code = Number(/versionCode (\d+)/.exec(gradle)?.[1] ?? '0') + 1;
  const name = `1.0.${code}`;
  writeFileSync(
    gradleFile,
    gradle.replace(/versionCode \d+/, `versionCode ${code}`).replace(/versionName "[^"]*"/, `versionName "${name}"`),
  );
  return name;
}

let serverUrl;
if (local) {
  const address = lanAddress();
  if (!address) {
    console.error('No Wi-Fi/LAN address found on this computer for the phone to reach.');
    process.exit(1);
  }
  serverUrl = `http://${address}:${app.devPort}`;
}

const version = bumpVersion();
run('npm', ['run', `build:${appName}`]);
run('node', ['scripts/cap-app.mjs', appName, 'sync', 'android'], {
  env: { ...process.env, ...(serverUrl ? { CAP_SERVER_URL: serverUrl } : {}) },
});
const androidDir = join(root, app.androidDir);
run(windows ? `"${join(androidDir, 'gradlew.bat')}"` : './gradlew', ['assembleDebug', '--console=plain'], {
  cwd: androidDir,
  env: { ...process.env, JAVA_HOME: javaHome(), ANDROID_HOME: androidHome() },
});

const target = local ? 'local' : 'staging';
mkdirSync(join(root, 'apks'), { recursive: true });
const apk = join(root, 'apks', `GB-${app.label}-${target}-v${version}.apk`);
copyFileSync(join(root, app.androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk'), apk);

console.log(`\nListo: ${apk}`);
if (local) {
  console.log(`Esta app carga ${serverUrl}: deja corriendo "npm run dev:${appName}" y el celular en el mismo Wi-Fi.`);
}
