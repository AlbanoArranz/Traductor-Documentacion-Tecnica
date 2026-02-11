/**
 * Iteración 3 — Edición de texto estable
 * - Enter guarda
 * - Shift+Enter inserta nueva línea
 * - Esc cancela sin guardar
 */
import { test, expect } from '@playwright/test'
import { resetPlayground, type PlaygroundContext } from './helpers/reset-playground'
import { SEL } from './helpers/selectors'

let ctx: PlaygroundContext

test.beforeAll(async ({ request }) => {
  ctx = await resetPlayground(request)
})

test.describe('Edición de texto estable (EditableTextBox)', () => {
  test('Enter guarda (1 PATCH) y Esc cancela (0 PATCH extra)', async ({ page }) => {
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

    // Doble click abre editor
    await boxEl.dblclick()
    const editor = page.locator('[data-testid="text-box-editor"]').first()
    await expect(editor).toBeVisible({ timeout: 5_000 })

    // Escribir texto multilinea (Shift+Enter)
    await editor.fill('Linea1')
    await editor.press('Shift+Enter')
    await editor.type('Linea2')

    // Enter guarda
    await editor.press('Enter')

    // Esperar un poco a que se dispare el PATCH
    await page.waitForTimeout(300)
    expect(patchCount).toBeGreaterThanOrEqual(1)

    // Reabrir editor y cancelar con Esc sin sumar PATCH
    const beforeEscPatches = patchCount
    await boxEl.dblclick()
    await expect(editor).toBeVisible({ timeout: 5_000 })
    await editor.fill('NO DEBE GUARDARSE')
    await editor.press('Escape')

    await page.waitForTimeout(300)
    expect(patchCount).toBe(beforeEscPatches)
  })
})
