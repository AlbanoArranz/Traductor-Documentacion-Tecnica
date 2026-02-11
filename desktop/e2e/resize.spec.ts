/**
 * Iteración 4 — Resize consistente (cajas + dibujos)
 */
import { test, expect } from '@playwright/test'
import { resetPlayground, type PlaygroundContext } from './helpers/reset-playground'
import { SEL } from './helpers/selectors'

let ctx: PlaygroundContext
let rectId = ''

test.beforeAll(async ({ request }) => {
  ctx = await resetPlayground(request)

  // Crear un rectángulo para test de resize en dibujos
  const res = await request.post(
    `http://127.0.0.1:8000/projects/${ctx.projectId}/pages/0/drawings`,
    {
      data: {
        element_type: 'rect',
        points: [200, 200, 360, 280],
        stroke_color: '#111111',
        stroke_width: 2,
        fill_color: null,
      },
    },
  )
  expect(res.ok()).toBe(true)
  rectId = (await res.json()).id
})

test.describe('Resize consistente', () => {
  test('TextRegion: resize respeta tamaño mínimo', async ({ page }) => {
    let patchCount = 0
    page.on('request', (req) => {
      if (req.method() === 'PATCH' && req.url().includes('/pages/text-regions/')) patchCount += 1
    })

    await page.goto(`/#/project/${ctx.projectId}`)
    await expect(page.locator(SEL.renderBtn)).toBeVisible({ timeout: 30_000 })

    if ((await page.locator(SEL.pageImage).count()) === 0) await page.locator(SEL.renderBtn).click()
    await expect(page.locator(SEL.pageImage)).toBeVisible({ timeout: 60_000 })

    const boxEl = page.locator(SEL.textBox).first()
    await expect(boxEl).toBeVisible({ timeout: 15_000 })
    await boxEl.click()

    const before = await boxEl.boundingBox()
    expect(before).toBeTruthy()

    const handle = boxEl.locator('[data-testid="text-handle-se"]')
    await expect(handle).toBeVisible({ timeout: 5_000 })
    const h = await handle.boundingBox()
    expect(h).toBeTruthy()

    // Intentar encoger mucho
    await page.mouse.move(h!.x + h!.width / 2, h!.y + h!.height / 2)
    await page.mouse.down()
    await page.mouse.move(h!.x - 500, h!.y - 500, { steps: 10 })
    await page.mouse.up()

    await page.waitForTimeout(300)

    const after = await boxEl.boundingBox()
    expect(after).toBeTruthy()

    // Mínimo en coords originales: 20x10. En pantalla dependerá del zoom,
    // así que solo verificamos que no colapsa por debajo de ~0.5x (10x5px).
    expect(after!.width).toBeGreaterThanOrEqual(9)
    expect(after!.height).toBeGreaterThanOrEqual(5)
    expect(patchCount).toBeLessThanOrEqual(1)
  })

  test('Drawing: resize respeta tamaño mínimo', async ({ page }) => {
    await page.goto(`/#/project/${ctx.projectId}`)
    await expect(page.locator(SEL.renderBtn)).toBeVisible({ timeout: 30_000 })

    if ((await page.locator(SEL.pageImage).count()) === 0) await page.locator(SEL.renderBtn).click()
    await expect(page.locator(SEL.pageImage)).toBeVisible({ timeout: 60_000 })

    // Activar modo dibujo
    await page.locator(SEL.drawModeBtn).click()
    await expect(page.locator(SEL.drawingCanvas)).toBeVisible({ timeout: 5_000 })

    const rectEl = page.locator(`[data-testid="drawing"][data-drawing-id="${rectId}"]`)
    await expect(rectEl).toBeVisible({ timeout: 15_000 })

    const rbox = await rectEl.boundingBox()
    expect(rbox).toBeTruthy()

    // Seleccionar con click en el centro
    await page.mouse.click(rbox!.x + rbox!.width / 2, rbox!.y + rbox!.height / 2)
    await expect(rectEl).toHaveAttribute('data-selected', 'true')

    // Handle SE
    const handle = page.locator('[data-testid="drawing-handle-se"]')
    await expect(handle).toBeVisible({ timeout: 5_000 })
    const h = await handle.boundingBox()
    expect(h).toBeTruthy()

    // Intentar encoger mucho
    await page.mouse.move(h!.x + h!.width / 2, h!.y + h!.height / 2)
    await page.mouse.down()
    await page.mouse.move(h!.x - 800, h!.y - 800, { steps: 10 })
    await page.mouse.up()

    await page.waitForTimeout(300)

    const rbox2 = await rectEl.boundingBox()
    expect(rbox2).toBeTruthy()

    expect(rbox2!.width).toBeGreaterThanOrEqual(10)
    expect(rbox2!.height).toBeGreaterThanOrEqual(6)
  })
})
