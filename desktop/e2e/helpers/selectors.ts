/**
 * Selectores reutilizables para tests E2E.
 * Usa data-testid en componentes clave para desacoplar tests del markup.
 */

export const SEL = {
  // Página principal
  projectList: '[data-testid="project-list"]',
  newProjectBtn: '[data-testid="new-project-btn"]',

  // Página de proyecto
  pageImage: '[data-testid="page-image"]',
  drawingCanvas: '[data-testid="drawing-canvas"]',
  drawingCanvasSvg: '[data-testid="drawing-canvas"] svg',
  textBox: '[data-testid="text-box"]',
  textBoxSelected: '[data-testid="text-box"][data-selected="true"]',

  // Toolbar
  drawModeBtn: '[data-testid="draw-mode-btn"]',
  toolbarSelect: '[data-testid="tool-select"]',
  toolbarLine: '[data-testid="tool-line"]',
  toolbarRect: '[data-testid="tool-rect"]',
  toolbarCircle: '[data-testid="tool-circle"]',

  // Acciones
  renderBtn: '[data-testid="render-btn"]',
  ocrBtn: '[data-testid="ocr-btn"]',
  composeBtn: '[data-testid="compose-btn"]',
} as const
