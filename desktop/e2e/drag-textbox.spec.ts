/**
 * Iteración 2 — Drag fluido (text regions)
 * Verifica que durante el drag no hay spam de PATCH y que el elemento se mueve.
 */
import { test, expect } from '@playwright/test'
import { resetPlayground, type PlaygroundContext } from './helpers/reset-playground'
import { SEL } from './helpers/selectors'

let ctx: PlaygroundContext

test.beforeAll(async ({ request }) => {
  ctx = await resetPlayground(request)
})

test.describe('Drag fluido (EditableTextBox)', () => {
  test('drag hace <=1 PATCH y mueve la caja', async ({ page }) => {
    let patchCount = 0

    page.on('request', (req) => {
      const url = req.url()
      if (req.method() === 'PATCH' && url.includes('/pages/text-regions/')) {
        patchCount += 1
      }
    })

    await page.goto(`/#/project/${ctx.projectId}`)
    await expect(page.locator(SEL.renderBtn)).toBeVisible({ timeout: 30_000 })

    // Asegurar imagen
    if ((await page.locator(SEL.pageImage).count()) === 0) {
      await page.locator(SEL.renderBtn).click()
    }
    await expect(page.locator(SEL.pageImage)).toBeVisible({ timeout: 60_000 })

    const boxEl = page.locator(SEL.textBox).first()
    await expect(boxEl).toBeVisible({ timeout: 15_000 })

    const before = await boxEl.boundingBox()
    expect(before).toBeTruthy()

    const startX = before!.x + before!.width / 2
    const startY = before!.y + before!.height / 2

    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(startX + 200, startY + 120, { steps: 20 })
    await page.mouse.up()

    // Esperar a que el UI termine de reflejar el cambio
    await page.waitForTimeout(300)

    const after = await boxEl.boundingBox()
    expect(after).toBeTruthy()

    expect(Math.abs(after!.x - before!.x)).toBeGreaterThan(30)
    expect(Math.abs(after!.y - before!.y)).toBeGreaterThan(20)

    // 0 o 1 PATCH es aceptable (según si el bbox final cambia realmente)
    expect(patchCount).toBeLessThanOrEqual(1)
  })
})
