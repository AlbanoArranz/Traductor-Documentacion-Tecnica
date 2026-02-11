/**
 * Auto-compose: cuando hay cambios, debe componer automáticamente tras debounce.
 */
import { test, expect } from '@playwright/test'
import { resetPlayground, type PlaygroundContext } from './helpers/reset-playground'
import { SEL } from './helpers/selectors'

let ctx: PlaygroundContext

test.beforeAll(async ({ request }) => {
  ctx = await resetPlayground(request)
})

test.describe('Auto-compose', () => {
  test('editar texto dispara compose automáticamente', async ({ page }) => {
    let composeCount = 0

    page.on('request', (req) => {
      if (req.method() === 'POST' && req.url().includes('/render-translated')) {
        composeCount += 1
      }
    })

    await page.goto(`/#/project/${ctx.projectId}`)
    await expect(page.locator(SEL.renderBtn)).toBeVisible({ timeout: 30_000 })

    if ((await page.locator(SEL.pageImage).count()) === 0) await page.locator(SEL.renderBtn).click()
    await expect(page.locator(SEL.pageImage)).toBeVisible({ timeout: 60_000 })

    // Necesitamos regiones
    const boxEl = page.locator(SEL.textBox).first()
    await expect(boxEl).toBeVisible({ timeout: 15_000 })

    // Editar texto (Enter guarda)
    await boxEl.dblclick()
    const editor = page.locator('[data-testid="text-box-editor"]').first()
    await expect(editor).toBeVisible({ timeout: 5_000 })
    await editor.fill('AutoCompose Test')
    await editor.press('Enter')

    // Auto-compose debounce 1.5s + tiempo de request
    await page.waitForTimeout(2500)

    expect(composeCount).toBeGreaterThanOrEqual(1)
  })
})
