/**
 * Test exhaustivo de todas las herramientas de dibujo:
 * - Crear: line, rect, circle, polyline
 * - Seleccionar dibujos
 * - Arrastrar (mover) dibujos
 * - Resize rect (handle SE)
 * - Resize circle (handle SE)
 * - Resize line (endpoints)
 * - Eliminar dibujo (Delete key)
 * - Deseleccionar al hacer click en zona vacía
 */
import { test, expect, type Page } from '@playwright/test'
import { resetPlayground, type PlaygroundContext } from './helpers/reset-playground'
import { SEL } from './helpers/selectors'

const API = 'http://127.0.0.1:8000'

let ctx: PlaygroundContext
let preLineId = ''
let preRectId = ''
let preCircleId = ''

test.beforeAll(async ({ request }) => {
  ctx = await resetPlayground(request)

  // Crear dibujos pre-existentes via API para tests de select/drag/resize/delete
  const drawingsToCreate = [
    { element_type: 'line', points: [500, 500, 700, 500], stroke_color: '#FF0000', stroke_width: 3 },
    { element_type: 'rect', points: [500, 300, 660, 400], stroke_color: '#00FF00', stroke_width: 2, fill_color: null },
    { element_type: 'circle', points: [500, 150, 620, 250], stroke_color: '#0000FF', stroke_width: 2, fill_color: null },
  ]
  for (const d of drawingsToCreate) {
    const res = await request.post(`${API}/projects/${ctx.projectId}/pages/0/drawings`, { data: d })
    expect(res.ok()).toBe(true)
    const body = await res.json()
    if (d.element_type === 'line') preLineId = body.id
    if (d.element_type === 'rect') preRectId = body.id
    if (d.element_type === 'circle') preCircleId = body.id
  }
})

test.setTimeout(120_000)

// ─── Helpers ───────────────────────────────────────────────────

async function gotoProject(page: Page) {
  await page.goto(`/#/project/${ctx.projectId}`)
  await expect(page.locator(SEL.renderBtn)).toBeVisible({ timeout: 30_000 })
}

async function ensureImage(page: Page) {
  if ((await page.locator(SEL.pageImage).count()) === 0) {
    await page.locator(SEL.renderBtn).click()
  }
  await expect(page.locator(SEL.pageImage)).toBeVisible({ timeout: 60_000 })
}

async function enterDrawMode(page: Page) {
  const btn = page.locator(SEL.drawModeBtn)
  await expect(btn).toBeVisible()
  await btn.click()
  await expect(page.locator(SEL.drawingCanvas)).toBeVisible({ timeout: 5_000 })
}

async function selectTool(page: Page, toolTitle: string) {
  const btn = page.locator(`button[title="${toolTitle}"]`)
  await expect(btn).toBeVisible({ timeout: 3_000 })
  await btn.click()
}

async function getCanvasBox(page: Page) {
  const box = await page.locator(SEL.drawingCanvas).boundingBox()
  expect(box).toBeTruthy()
  return box!
}

async function drawOnCanvas(page: Page, x1: number, y1: number, x2: number, y2: number) {
  await page.mouse.move(x1, y1)
  await page.mouse.down()
  await page.mouse.move(x2, y2, { steps: 8 })
  await page.mouse.up()
}

// ─── Tests ─────────────────────────────────────────────────────

test.describe('Drawing Tools — Creación', () => {
  test('dibujar una línea', async ({ page }) => {
    await gotoProject(page)
    await ensureImage(page)
    await enterDrawMode(page)
    await selectTool(page, 'Línea')

    const canvas = await getCanvasBox(page)
    const x1 = canvas.x + 50, y1 = canvas.y + 50
    const x2 = canvas.x + 200, y2 = canvas.y + 50
    await drawOnCanvas(page, x1, y1, x2, y2)

    await page.waitForTimeout(500)
    const lines = page.locator('[data-testid="drawing"][data-drawing-id]')
    // Al menos las pre-creadas + la nueva
    const count = await lines.count()
    expect(count).toBeGreaterThanOrEqual(4) // 3 pre + 1 nueva
  })

  test('dibujar un rectángulo', async ({ page }) => {
    await gotoProject(page)
    await ensureImage(page)
    await enterDrawMode(page)
    await selectTool(page, 'Rectángulo')

    const canvas = await getCanvasBox(page)
    await drawOnCanvas(page, canvas.x + 50, canvas.y + 400, canvas.x + 150, canvas.y + 460)

    await page.waitForTimeout(500)
    const drawings = page.locator('[data-testid="drawing"]')
    const count = await drawings.count()
    expect(count).toBeGreaterThanOrEqual(4)
  })

  test('dibujar un círculo', async ({ page }) => {
    await gotoProject(page)
    await ensureImage(page)
    await enterDrawMode(page)
    await selectTool(page, 'Círculo')

    const canvas = await getCanvasBox(page)
    await drawOnCanvas(page, canvas.x + 250, canvas.y + 400, canvas.x + 330, canvas.y + 460)

    await page.waitForTimeout(500)
    const drawings = page.locator('[data-testid="drawing"]')
    const count = await drawings.count()
    expect(count).toBeGreaterThanOrEqual(4)
  })

  test('dibujar polilínea (click-click-dblclick)', async ({ page }) => {
    await gotoProject(page)
    await ensureImage(page)
    await enterDrawMode(page)
    await selectTool(page, 'Polilínea')

    const canvas = await getCanvasBox(page)
    const baseX = canvas.x + 60, baseY = canvas.y + 550

    // Click para cada punto
    await page.mouse.click(baseX, baseY)
    await page.waitForTimeout(100)
    await page.mouse.click(baseX + 80, baseY - 40)
    await page.waitForTimeout(100)
    await page.mouse.click(baseX + 160, baseY)
    await page.waitForTimeout(100)
    // Doble-click para terminar
    await page.mouse.dblclick(baseX + 240, baseY - 40)

    await page.waitForTimeout(500)
    const polylines = page.locator('polyline[data-testid="drawing"]')
    expect(await polylines.count()).toBeGreaterThanOrEqual(1)
  })
})

test.describe('Drawing Tools — Selección y Drag', () => {
  test('seleccionar rect con click', async ({ page }) => {
    await gotoProject(page)
    await ensureImage(page)
    await enterDrawMode(page)
    await selectTool(page, 'Seleccionar')

    const el = page.locator(`[data-testid="drawing"][data-drawing-id="${preRectId}"]`)
    await expect(el).toBeVisible({ timeout: 10_000 })

    const box = await el.boundingBox()
    expect(box).toBeTruthy()
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2)

    await expect(el).toHaveAttribute('data-selected', 'true', { timeout: 3_000 })
  })

  test('arrastrar rect cambia posición', async ({ page }) => {
    await gotoProject(page)
    await ensureImage(page)
    await enterDrawMode(page)
    await selectTool(page, 'Seleccionar')

    const el = page.locator(`[data-testid="drawing"][data-drawing-id="${preRectId}"]`)
    await expect(el).toBeVisible({ timeout: 10_000 })

    // Seleccionar primero
    const box1 = await el.boundingBox()
    expect(box1).toBeTruthy()
    await page.mouse.click(box1!.x + box1!.width / 2, box1!.y + box1!.height / 2)
    await expect(el).toHaveAttribute('data-selected', 'true', { timeout: 3_000 })

    // Arrastrar 40px a la derecha
    const cx = box1!.x + box1!.width / 2
    const cy = box1!.y + box1!.height / 2
    await page.mouse.move(cx, cy)
    await page.mouse.down()
    await page.mouse.move(cx + 40, cy, { steps: 8 })
    await page.mouse.up()

    await page.waitForTimeout(500)
    const box2 = await el.boundingBox()
    expect(box2).toBeTruthy()
    // La posición X debería haber aumentado
    expect(box2!.x).toBeGreaterThan(box1!.x + 10)
  })

  test('click en zona vacía deselecciona dibujo', async ({ page }) => {
    await gotoProject(page)
    await ensureImage(page)
    await enterDrawMode(page)
    await selectTool(page, 'Seleccionar')

    const el = page.locator(`[data-testid="drawing"][data-drawing-id="${preRectId}"]`)
    await expect(el).toBeVisible({ timeout: 10_000 })

    // Seleccionar
    const box = await el.boundingBox()
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2)
    await expect(el).toHaveAttribute('data-selected', 'true', { timeout: 3_000 })

    // Click en zona vacía (esquina superior izquierda del canvas)
    const canvas = await getCanvasBox(page)
    await page.mouse.click(canvas.x + 5, canvas.y + 5)

    await expect(el).toHaveAttribute('data-selected', 'false', { timeout: 3_000 })
  })
})

test.describe('Drawing Tools — Resize', () => {
  test('resize rect: handle SE agranda el rectángulo', async ({ page }) => {
    await gotoProject(page)
    await ensureImage(page)
    await enterDrawMode(page)
    await selectTool(page, 'Seleccionar')

    const el = page.locator(`[data-testid="drawing"][data-drawing-id="${preRectId}"]`)
    await expect(el).toBeVisible({ timeout: 10_000 })

    // Seleccionar
    const box1 = await el.boundingBox()
    expect(box1).toBeTruthy()
    await page.mouse.click(box1!.x + box1!.width / 2, box1!.y + box1!.height / 2)
    await expect(el).toHaveAttribute('data-selected', 'true', { timeout: 3_000 })

    // Encontrar handle SE
    const handle = page.locator(`[data-testid="drawing-handle-se"][data-drawing-id="${preRectId}"]`)
    await expect(handle).toBeVisible({ timeout: 5_000 })
    const h = await handle.boundingBox()
    expect(h).toBeTruthy()

    // Arrastrar handle 50px abajo-derecha
    const hx = h!.x + h!.width / 2
    const hy = h!.y + h!.height / 2
    await page.mouse.move(hx, hy)
    await page.mouse.down()
    await page.mouse.move(hx + 50, hy + 50, { steps: 8 })
    await page.mouse.up()

    await page.waitForTimeout(500)

    const box2 = await el.boundingBox()
    expect(box2).toBeTruthy()
    // El rectángulo debería ser más grande
    expect(box2!.width).toBeGreaterThan(box1!.width + 20)
    expect(box2!.height).toBeGreaterThan(box1!.height + 20)
  })

  test('resize circle: handle SE agranda el círculo', async ({ page }) => {
    await gotoProject(page)
    await ensureImage(page)
    await enterDrawMode(page)
    await selectTool(page, 'Seleccionar')

    const el = page.locator(`[data-testid="drawing"][data-drawing-id="${preCircleId}"]`)
    await expect(el).toBeVisible({ timeout: 10_000 })

    // Seleccionar
    const box1 = await el.boundingBox()
    expect(box1).toBeTruthy()
    await page.mouse.click(box1!.x + box1!.width / 2, box1!.y + box1!.height / 2)
    await expect(el).toHaveAttribute('data-selected', 'true', { timeout: 3_000 })

    // Encontrar handle SE
    const handle = page.locator(`[data-testid="drawing-handle-se"][data-drawing-id="${preCircleId}"]`)
    await expect(handle).toBeVisible({ timeout: 5_000 })
    const h = await handle.boundingBox()
    expect(h).toBeTruthy()

    // Arrastrar 40px abajo-derecha
    const hx = h!.x + h!.width / 2
    const hy = h!.y + h!.height / 2
    await page.mouse.move(hx, hy)
    await page.mouse.down()
    await page.mouse.move(hx + 40, hy + 40, { steps: 8 })
    await page.mouse.up()

    await page.waitForTimeout(500)

    const box2 = await el.boundingBox()
    expect(box2).toBeTruthy()
    expect(box2!.width).toBeGreaterThan(box1!.width + 15)
    expect(box2!.height).toBeGreaterThan(box1!.height + 15)
  })

  test('resize line: arrastrar endpoint SE alarga la línea', async ({ page }) => {
    await gotoProject(page)
    await ensureImage(page)
    await enterDrawMode(page)
    await selectTool(page, 'Seleccionar')

    const el = page.locator(`[data-testid="drawing"][data-drawing-id="${preLineId}"]`)
    await expect(el).toBeVisible({ timeout: 10_000 })

    // Seleccionar la línea (click en su centro aproximado)
    const box1 = await el.boundingBox()
    expect(box1).toBeTruthy()
    await page.mouse.click(box1!.x + box1!.width / 2, box1!.y + box1!.height / 2)
    await expect(el).toHaveAttribute('data-selected', 'true', { timeout: 3_000 })

    // Handle SE (punto final de la línea)
    const handle = page.locator(`[data-testid="drawing-handle-se"][data-drawing-id="${preLineId}"]`)
    await expect(handle).toBeVisible({ timeout: 5_000 })
    const h = await handle.boundingBox()
    expect(h).toBeTruthy()

    // Arrastrar endpoint 60px a la derecha
    const hx = h!.x + h!.width / 2
    const hy = h!.y + h!.height / 2
    await page.mouse.move(hx, hy)
    await page.mouse.down()
    await page.mouse.move(hx + 60, hy, { steps: 8 })
    await page.mouse.up()

    await page.waitForTimeout(500)

    const box2 = await el.boundingBox()
    expect(box2).toBeTruthy()
    // La línea debería ser más larga (ancho mayor)
    expect(box2!.width).toBeGreaterThan(box1!.width + 20)
  })

  test('resize rect: handle NW reduce el rectángulo', async ({ page }) => {
    await gotoProject(page)
    await ensureImage(page)
    await enterDrawMode(page)
    await selectTool(page, 'Seleccionar')

    const el = page.locator(`[data-testid="drawing"][data-drawing-id="${preRectId}"]`)
    await expect(el).toBeVisible({ timeout: 10_000 })

    const box1 = await el.boundingBox()
    expect(box1).toBeTruthy()
    await page.mouse.click(box1!.x + box1!.width / 2, box1!.y + box1!.height / 2)
    await expect(el).toHaveAttribute('data-selected', 'true', { timeout: 3_000 })

    const handle = page.locator(`[data-testid="drawing-handle-nw"][data-drawing-id="${preRectId}"]`)
    await expect(handle).toBeVisible({ timeout: 5_000 })
    const h = await handle.boundingBox()
    expect(h).toBeTruthy()

    // Arrastrar NW 30px abajo-derecha para encoger
    const hx = h!.x + h!.width / 2
    const hy = h!.y + h!.height / 2
    await page.mouse.move(hx, hy)
    await page.mouse.down()
    await page.mouse.move(hx + 30, hy + 20, { steps: 8 })
    await page.mouse.up()

    await page.waitForTimeout(500)

    const box2 = await el.boundingBox()
    expect(box2).toBeTruthy()
    expect(box2!.width).toBeLessThan(box1!.width)
    expect(box2!.height).toBeLessThan(box1!.height)
  })

  test('resize respeta tamaño mínimo (no colapsa)', async ({ page }) => {
    await gotoProject(page)
    await ensureImage(page)
    await enterDrawMode(page)
    await selectTool(page, 'Seleccionar')

    const el = page.locator(`[data-testid="drawing"][data-drawing-id="${preRectId}"]`)
    await expect(el).toBeVisible({ timeout: 10_000 })

    const box1 = await el.boundingBox()
    expect(box1).toBeTruthy()
    await page.mouse.click(box1!.x + box1!.width / 2, box1!.y + box1!.height / 2)
    await expect(el).toHaveAttribute('data-selected', 'true', { timeout: 3_000 })

    const handle = page.locator(`[data-testid="drawing-handle-se"][data-drawing-id="${preRectId}"]`)
    await expect(handle).toBeVisible({ timeout: 5_000 })
    const h = await handle.boundingBox()
    expect(h).toBeTruthy()

    // Intentar colapsar completamente (arrastrar mucho hacia arriba-izquierda)
    const hx = h!.x + h!.width / 2
    const hy = h!.y + h!.height / 2
    await page.mouse.move(hx, hy)
    await page.mouse.down()
    await page.mouse.move(hx - 800, hy - 800, { steps: 10 })
    await page.mouse.up()

    await page.waitForTimeout(500)

    const box2 = await el.boundingBox()
    expect(box2).toBeTruthy()
    // Tamaño mínimo: 20x10 en coords originales, en pantalla depende del zoom
    expect(box2!.width).toBeGreaterThanOrEqual(5)
    expect(box2!.height).toBeGreaterThanOrEqual(3)
  })
})

test.describe('Drawing Tools — Eliminar', () => {
  test('eliminar dibujo con tecla Delete', async ({ page }) => {
    await gotoProject(page)
    await ensureImage(page)
    await enterDrawMode(page)
    await selectTool(page, 'Seleccionar')

    // Contar dibujos antes
    const target = page.locator(`[data-testid="drawing"][data-drawing-id="${preRectId}"]`)
    await expect(target).toBeVisible({ timeout: 10_000 })

    const box = await target.boundingBox()
    expect(box).toBeTruthy()
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2)
    await expect(target).toHaveAttribute('data-selected', 'true', { timeout: 3_000 })

    // Pulsar Delete y verificar que el elemento desaparece
    await page.locator(SEL.drawingCanvas).press('Delete')
    await expect(target).toHaveCount(0, { timeout: 5_000 })
  })
})
