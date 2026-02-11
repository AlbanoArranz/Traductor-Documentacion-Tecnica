/**
 * Iteración 1 — Selección fiable (dibujos)
 */
import { test, expect } from '@playwright/test'
import { resetPlayground, type PlaygroundContext } from './helpers/reset-playground'
import { SEL } from './helpers/selectors'

let ctx: PlaygroundContext
let rectBottomId = ''
let rectTopId = ''

test.beforeAll(async ({ request }) => {
  ctx = await resetPlayground(request)

  // Crear dos rectángulos solapados (top debe ganar)
  const bottom = await request.post(
    `http://127.0.0.1:8000/projects/${ctx.projectId}/pages/0/drawings`,
    {
      data: {
        element_type: 'rect',
        points: [200, 200, 500, 400],
        stroke_color: '#ff0000',
        stroke_width: 2,
        fill_color: null,
      },
    },
  )
  expect(bottom.ok()).toBe(true)
  rectBottomId = (await bottom.json()).id

  const top = await request.post(
    `http://127.0.0.1:8000/projects/${ctx.projectId}/pages/0/drawings`,
    {
      data: {
        element_type: 'rect',
        points: [300, 250, 600, 450],
        stroke_color: '#0000ff',
        stroke_width: 2,
        fill_color: null,
      },
    },
  )
  expect(top.ok()).toBe(true)
  rectTopId = (await top.json()).id
})

test.describe('Selección fiable', () => {
  test('en solape selecciona el de arriba (top-first)', async ({ page }) => {
    await page.goto(`/#/project/${ctx.projectId}`)

    // Asegurar que estamos en ProjectPage
    await expect(page.locator(SEL.renderBtn)).toBeVisible({ timeout: 30_000 })

    // Renderizar si hace falta
    const img = page.locator(SEL.pageImage)
    if ((await img.count()) === 0) {
      await page.locator(SEL.renderBtn).click()
    }
    await expect(page.locator(SEL.pageImage)).toBeVisible({ timeout: 60_000 })

    // Activar modo dibujo
    await page.locator(SEL.drawModeBtn).click()
    await expect(page.locator(SEL.drawingCanvas)).toBeVisible({ timeout: 5_000 })

    const topEl = page.locator(`[data-testid="drawing"][data-drawing-id="${rectTopId}"]`)
    const bottomEl = page.locator(`[data-testid="drawing"][data-drawing-id="${rectBottomId}"]`)
    await expect(topEl).toBeVisible({ timeout: 15_000 })
    await expect(bottomEl).toBeVisible({ timeout: 15_000 })

    // Click en la intersección real de ambos elementos (en coordenadas pantalla)
    const topBox = await topEl.boundingBox()
    const bottomBox = await bottomEl.boundingBox()
    expect(topBox).toBeTruthy()
    expect(bottomBox).toBeTruthy()

    const ix1 = Math.max(topBox!.x, bottomBox!.x)
    const iy1 = Math.max(topBox!.y, bottomBox!.y)
    const ix2 = Math.min(topBox!.x + topBox!.width, bottomBox!.x + bottomBox!.width)
    const iy2 = Math.min(topBox!.y + topBox!.height, bottomBox!.y + bottomBox!.height)

    // Si por cualquier motivo no hay intersección, click en el centro del top
    const cx = ix2 > ix1 ? (ix1 + ix2) / 2 : (topBox!.x + topBox!.width / 2)
    const cy = iy2 > iy1 ? (iy1 + iy2) / 2 : (topBox!.y + topBox!.height / 2)
    await page.mouse.click(cx, cy)

    await expect(topEl).toHaveAttribute('data-selected', 'true')
    await expect(bottomEl).toHaveAttribute('data-selected', 'false')
  })

  test('click vacío deselecciona', async ({ page }) => {
    await page.goto(`/#/project/${ctx.projectId}`)
    await expect(page.locator(SEL.renderBtn)).toBeVisible({ timeout: 30_000 })

    // Renderizar si hace falta
    const img = page.locator(SEL.pageImage)
    if ((await img.count()) === 0) {
      await page.locator(SEL.renderBtn).click()
    }
    await expect(page.locator(SEL.pageImage)).toBeVisible({ timeout: 60_000 })

    // Activar modo dibujo
    await page.locator(SEL.drawModeBtn).click()
    await expect(page.locator(SEL.drawingCanvas)).toBeVisible({ timeout: 5_000 })

    const canvas = page.locator(SEL.drawingCanvas)
    const canvasBox = await canvas.boundingBox()
    expect(canvasBox).toBeTruthy()

    // Seleccionar el top clickando en su propio bbox
    const topEl = page.locator(`[data-testid="drawing"][data-drawing-id="${rectTopId}"]`)
    await expect(topEl).toBeVisible({ timeout: 15_000 })
    const topBox = await topEl.boundingBox()
    expect(topBox).toBeTruthy()
    await page.mouse.click(topBox!.x + topBox!.width / 2, topBox!.y + topBox!.height / 2)
    await expect(topEl).toHaveAttribute('data-selected', 'true')

    // Click en un área vacía del canvas (esquina superior izquierda)
    await page.mouse.click(canvasBox!.x + 5, canvasBox!.y + 5)
    await expect(topEl).toHaveAttribute('data-selected', 'false')
  })
})
