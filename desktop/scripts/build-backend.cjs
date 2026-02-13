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

const VENV_PYINSTALLER = path.join(BACKEND_DIR, 'venv', 'Scripts', 'pyinstaller.exe');
const VENV_PYTHON = path.join(BACKEND_DIR, 'venv', 'Scripts', 'python.exe');

console.log('=== Build Backend ===');
console.log(`Backend dir: ${BACKEND_DIR}`);
console.log(`Output dir: ${OUTPUT_DIR}`);

// Limpiar output anterior (manejar locks EBUSY en Windows)
if (fs.existsSync(OUTPUT_DIR)) {
  fs.rmSync(OUTPUT_DIR, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 300,
  });
}
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// Eliminar spec cacheado para forzar regeneración completa
const SPEC_FILE = path.join(BACKEND_DIR, 'main.spec');
if (fs.existsSync(SPEC_FILE)) {
  fs.rmSync(SPEC_FILE);
  console.log('Removed cached main.spec');
}

// Ejecutar PyInstaller con run.py como entry point
console.log('\nRunning PyInstaller...');

const pyinstallerRunner = (() => {
  if (fs.existsSync(VENV_PYINSTALLER)) return `"${VENV_PYINSTALLER}"`;
  if (fs.existsSync(VENV_PYTHON)) return `"${VENV_PYTHON}" -m PyInstaller`;
  return null;
})();

if (!pyinstallerRunner) {
  console.error(`\n❌ No se encontró el venv del backend.`);
  console.error(`Esperaba encontrar: ${VENV_PYTHON}`);
  console.error('Crea/activa el venv en backend\\venv y vuelve a intentar.');
  process.exit(1);
}

const pyinstallerCmd = [
  pyinstallerRunner,
  '--onedir',
  '--noconfirm',
  '--clean',
  '--name main',
  '--distpath', `"${OUTPUT_DIR}"`,
  '--workpath', `"${path.join(BACKEND_DIR, 'build')}"`,
  '--specpath', `"${BACKEND_DIR}"`,
  // uvicorn - collect ALL submodules
  '--collect-all=uvicorn',
  // fastapi/starlette
  '--collect-all=fastapi',
  '--collect-all=starlette',
  // pydantic
  '--collect-all=pydantic',
  '--collect-all=pydantic_core',
  // PyMuPDF
  '--collect-all=fitz',
  '--collect-all=pymupdf',
  // easyocr y dependencias
  '--collect-all=easyocr',
  // paddleocr y dependencias
  '--collect-all=paddleocr',
  '--collect-all=paddle',
  '--collect-all=paddlepaddle',
  // rapidocr (import dinámico en ocr_service_rapid.py)
  '--collect-all=rapidocr_onnxruntime',
  '--hidden-import=rapidocr_onnxruntime',
  // onnxruntime (dependencia de rapidocr)
  '--collect-all=onnxruntime',
  // deepl (import dinámico en translate_service.py)
  '--hidden-import=deepl',
  // app modules
  '--collect-submodules=app',
  // data files: defaults/ seeds para primera ejecución
  `--add-data="${path.join(BACKEND_DIR, 'app', 'defaults')}${path.delimiter}app/defaults"`,
  // paths
  `--paths="${BACKEND_DIR}"`,
  `"${path.join(BACKEND_DIR, 'run.py')}"`,
].join(' ');

try {
  execSync(pyinstallerCmd, {
    cwd: BACKEND_DIR,
    stdio: 'inherit',
  });
  // Verificación post-build: paquetes críticos en _internal/
  const internalDir = path.join(OUTPUT_DIR, 'main', '_internal');
  const criticalPaths = [
    { name: 'rapidocr_onnxruntime', p: path.join(internalDir, 'rapidocr_onnxruntime') },
    { name: 'onnxruntime', p: path.join(internalDir, 'onnxruntime') },
    { name: 'app/defaults', p: path.join(internalDir, 'app', 'defaults') },
  ];
  const missing = criticalPaths.filter(c => !fs.existsSync(c.p));
  if (missing.length > 0) {
    console.error('\n❌ Post-build check failed! Missing critical packages:');
    missing.forEach(m => console.error(`   - ${m.name} (expected: ${m.p})`));
    process.exit(1);
  }
  console.log('\n✅ Backend built successfully!');
  console.log(`Output: ${OUTPUT_DIR}`);
  console.log('Post-build check: all critical packages present.');
} catch (error) {
  console.error('\n❌ Build failed:', error.message);
  process.exit(1);
}
