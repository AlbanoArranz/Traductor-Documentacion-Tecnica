/**
 * Script para empaquetar el backend Python con PyInstaller
 * y copiarlo a resources/backend para electron-builder
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '../..');
const BACKEND_DIR = path.join(ROOT_DIR, 'backend');
const OUTPUT_DIR = path.join(__dirname, '../resources/backend');

console.log('=== Build Backend ===');
console.log(`Backend dir: ${BACKEND_DIR}`);
console.log(`Output dir: ${OUTPUT_DIR}`);

// Limpiar output anterior
if (fs.existsSync(OUTPUT_DIR)) {
  fs.rmSync(OUTPUT_DIR, { recursive: true });
}
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// Ejecutar PyInstaller
console.log('\nRunning PyInstaller...');
const pyinstallerCmd = [
  'pyinstaller',
  '--onedir',
  '--noconfirm',
  '--clean',
  '--name main',
  '--distpath', `"${OUTPUT_DIR}"`,
  '--workpath', `"${path.join(BACKEND_DIR, 'build')}"`,
  '--specpath', `"${BACKEND_DIR}"`,
  `"${path.join(BACKEND_DIR, 'app', 'main.py')}"`,
].join(' ');

try {
  execSync(pyinstallerCmd, {
    cwd: BACKEND_DIR,
    stdio: 'inherit',
  });
  console.log('\n✅ Backend built successfully!');
  console.log(`Output: ${OUTPUT_DIR}`);
} catch (error) {
  console.error('\n❌ Build failed:', error.message);
  process.exit(1);
}
