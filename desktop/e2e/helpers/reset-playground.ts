/**
 * Playground reset: crea un proyecto de prueba limpio para cada test E2E.
 * Usa la API REST del backend directamente (no el frontend).
 *
 * Diseñado para ser RÁPIDO: render a 150 DPI, sin OCR real,
 * crea regiones de texto manualmente via API.
 */
import { APIRequestContext } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const API_BASE = 'http://127.0.0.1:8000'
const TEST_PROJECT_NAME_PREFIX = '__e2e_test_project__'

// PDF de prueba (1 página) en la raíz del repo
const TEST_PDF_PATH = path.resolve(__dirname, '../../../test.pdf')

export interface PlaygroundContext {
  projectId: string
  pageUrl: string
}

/**
 * Limpia proyectos de test anteriores.
 */
async function cleanupTestProjects(request: APIRequestContext): Promise<void> {
  const res = await request.get(`${API_BASE}/projects`)
  if (!res.ok()) return
  const projects: Array<{ id: string; name: string }> = await res.json()
  for (const p of projects) {
    if (typeof p.name === 'string' && p.name.startsWith(TEST_PROJECT_NAME_PREFIX)) {
      await request.delete(`${API_BASE}/projects/${p.id}`)
    }
  }
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Crea un proyecto de prueba con render rápido (150 DPI) y regiones manuales.
 * NO ejecuta OCR (demasiado lento para tests).
 */
export async function resetPlayground(
  request: APIRequestContext,
): Promise<PlaygroundContext> {
  // 1. Limpiar proyectos de test anteriores
  await cleanupTestProjects(request)

  const testProjectName = `${TEST_PROJECT_NAME_PREFIX}_${Date.now()}`

  // 2. Crear proyecto nuevo con el PDF de prueba
  const pdfBuffer = fs.readFileSync(TEST_PDF_PATH)
  const createRes = await request.post(
    `${API_BASE}/projects?name=${encodeURIComponent(testProjectName)}&document_type=schematic&rotation=0`,
    {
      multipart: {
        file: {
          name: 'test.pdf',
          mimeType: 'application/pdf',
          buffer: pdfBuffer,
        },
      },
    },
  )
  if (!createRes.ok()) {
    throw new Error(`Failed to create test project: ${createRes.status()} ${await createRes.text()}`)
  }
  const project: { id: string } = await createRes.json()

  // 3. Renderizar página 0 (450 DPI — lo que espera el frontend)
  const renderRes = await request.post(
    `${API_BASE}/projects/${project.id}/pages/0/render-original?dpi=450`,
  )
  if (!renderRes.ok()) {
    throw new Error(`Failed to render page: ${renderRes.status()}`)
  }

  // 4. Crear regiones de texto manuales (sin OCR — mucho más rápido)
  const testRegions = [
    { bbox: [100, 100, 300, 140], src_text: '测试文本一', tgt_text: 'Texto de prueba 1' },
    { bbox: [100, 200, 350, 240], src_text: '测试文本二', tgt_text: 'Texto de prueba 2' },
    { bbox: [100, 300, 400, 340], src_text: '测试文本三', tgt_text: 'Texto de prueba 3' },
  ]
  for (const region of testRegions) {
    let lastErr: any = null
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const r = await request.post(
          `${API_BASE}/projects/${project.id}/pages/0/text-regions`,
          { data: region },
        )
        if (!r.ok()) {
          lastErr = new Error(`createTextRegion failed: ${r.status()} ${await r.text()}`)
          await sleep(250 * attempt)
          continue
        }
        lastErr = null
        break
      } catch (e) {
        lastErr = e
        await sleep(250 * attempt)
      }
    }
    if (lastErr) throw lastErr
  }

  return {
    projectId: project.id,
    pageUrl: `/#/project/${project.id}`,
  }
}
