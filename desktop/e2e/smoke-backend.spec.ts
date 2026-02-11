/**
 * Smoke test backend-only: verifica que el backend funciona.
 * NO requiere navegador ni frontend corriendo.
 */
import { test, expect } from '@playwright/test'
import { resetPlayground, type PlaygroundContext } from './helpers/reset-playground'

let ctx: PlaygroundContext

test.beforeAll(async ({ request }) => {
  ctx = await resetPlayground(request)
})

test.describe('Backend Smoke Test', () => {
  test('crea proyecto y renderiza página', async ({ request }) => {
    // Verificar que el proyecto existe
    const res = await request.get(`http://127.0.0.1:8000/projects/${ctx.projectId}`)
    expect(res.ok()).toBe(true)
    const project = await res.json()
    expect(project.id).toBe(ctx.projectId)
  })

  test('crea regiones de texto manuales', async ({ request }) => {
    // Listar regiones
    const res = await request.get(
      `http://127.0.0.1:8000/projects/${ctx.projectId}/pages/0/text-regions`,
    )
    expect(res.ok()).toBe(true)
    const regions = await res.json()
    expect(regions.length).toBe(3) // 3 regiones creadas en resetPlayground
  })

  test('puede actualizar una región', async ({ request }) => {
    // Obtener primera región
    const listRes = await request.get(
      `http://127.0.0.1:8000/projects/${ctx.projectId}/pages/0/text-regions`,
    )
    const regions = await listRes.json()
    const firstRegion = regions[0]

    // Actualizar tgt_text
    const updateRes = await request.patch(
      `http://127.0.0.1:8000/projects/${ctx.projectId}/pages/text-regions/${firstRegion.id}`,
      { data: { tgt_text: 'Texto actualizado' } },
    )
    expect(updateRes.ok()).toBe(true)

    // Verificar actualización (el PATCH devuelve la región actualizada)
    const updated = await updateRes.json()
    expect(updated.tgt_text).toBe('Texto actualizado')

    // Verificar persistencia re-listando
    const listRes2 = await request.get(
      `http://127.0.0.1:8000/projects/${ctx.projectId}/pages/0/text-regions`,
    )
    expect(listRes2.ok()).toBe(true)
    const regions2 = await listRes2.json()
    const found = regions2.find((r: any) => r.id === firstRegion.id)
    expect(found?.tgt_text).toBe('Texto actualizado')
  })
})
