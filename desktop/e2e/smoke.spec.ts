/**
 * Smoke test: verifica que la app carga un proyecto con imagen y regiones de texto.
 * Este test valida la infraestructura E2E (playground reset, selectors, navegación).
 */
import { test, expect } from '@playwright/test'
import { resetPlayground, type PlaygroundContext } from './helpers/reset-playground'
import { SEL } from './helpers/selectors'

let ctx: PlaygroundContext

test.beforeAll(async ({ request }) => {
  ctx = await resetPlayground(request)
})
test.setTimeout(120_000)

test.describe('Smoke Test', () => {
  const gotoProject = async (page: any) => {
    await page.goto(`/#/project/${ctx.projectId}`)
    // Señal de que estamos en ProjectPage (no en Home)
    await expect(page.locator(SEL.renderBtn)).toBeVisible({ timeout: 30_000 })
  }

  const ensurePageImage = async (page: any) => {
    const img = page.locator(SEL.pageImage)
    if (await img.count()) {
      await expect(img).toBeVisible({ timeout: 15_000 })
      return
    }

    const renderBtn = page.locator(SEL.renderBtn)
    if (await renderBtn.count()) {
      await renderBtn.click()
    }
    await expect(page.locator(SEL.pageImage)).toBeVisible({ timeout: 60_000 })
  }

  test('carga la página del proyecto con imagen', async ({ page }) => {
    await gotoProject(page)

    await ensurePageImage(page)
  })

  test('muestra al menos 1 región de texto (OCR)', async ({ page }) => {
    await gotoProject(page)

    await ensurePageImage(page)

    // Esperar a que carguen las regiones de texto
    const textBoxes = page.locator(SEL.textBox)
    await expect(textBoxes.first()).toBeVisible({ timeout: 15_000 })

    const count = await textBoxes.count()
    expect(count).toBeGreaterThan(0)
  })

  test('puede activar modo dibujo', async ({ page }) => {
    await gotoProject(page)

    await ensurePageImage(page)

    // Click en botón "Dibujar"
    const drawBtn = page.locator(SEL.drawModeBtn)
    await expect(drawBtn).toBeVisible()
    await drawBtn.click()

    // Verificar que aparece el canvas de dibujo
    const canvas = page.locator(SEL.drawingCanvas)
    await expect(canvas).toBeVisible({ timeout: 5_000 })
  })

  test('click en zona vacía deselecciona', async ({ page }) => {
    await gotoProject(page)

    await ensurePageImage(page)

    // Seleccionar primera región
    const firstBox = page.locator(SEL.textBox).first()
    await expect(firstBox).toBeVisible()
    await firstBox.click()

    // Verificar que está seleccionada
    await expect(firstBox).toHaveAttribute('data-selected', 'true')

    // Click en zona vacía (esquina superior izquierda de la imagen)
    const img = page.locator(SEL.pageImage)
    const box = await img.boundingBox()
    if (box) {
      await page.mouse.click(box.x + 5, box.y + 5)
    }

    // Verificar que ya no hay selección
    const selectedBoxes = page.locator(SEL.textBoxSelected)
    await expect(selectedBoxes).toHaveCount(0, { timeout: 2_000 })
  })
})
