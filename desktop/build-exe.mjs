import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const desktopDir = import.meta.dirname;
const rootDir = path.resolve(desktopDir, '..');
const rootDist = path.join(rootDir, 'dist');
const rootBuild = path.join(rootDir, 'build');
const desktopDist = path.join(desktopDir, 'dist');
const desktopBuild = path.join(desktopDir, 'build');

if (!fs.existsSync(rootDist)) {
  throw new Error('Root dist/ not found. Run "npm run build" in the root directory first.');
}

fs.rmSync(desktopDist, { recursive: true, force: true });
fs.cpSync(rootDist, desktopDist, { recursive: true, force: true });

if (fs.existsSync(rootBuild)) {
  fs.rmSync(desktopBuild, { recursive: true, force: true });
  fs.cpSync(rootBuild, desktopBuild, { recursive: true, force: true });
}

if (!fs.existsSync(path.join(desktopDir, 'node_modules'))) {
  execSync('npm install', { cwd: desktopDir, stdio: 'inherit' });
}

execSync('npx electron-builder --win portable', { cwd: desktopDir, stdio: 'inherit' });
