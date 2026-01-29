import { useState, useEffect } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { settingsApi, OcrRegionFilter } from '../lib/api'

export default function SettingsPage() {
  const queryClient = useQueryClient()
  const [deeplApiKey, setDeeplApiKey] = useState('')
  const [defaultDpi, setDefaultDpi] = useState('450')
  const [minHanRatio, setMinHanRatio] = useState('100')
  const [ocrFilters, setOcrFilters] = useState<OcrRegionFilter[]>([])

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsApi.get().then((r) => r.data),
  })

  useEffect(() => {
    if (!settings) return
    setDefaultDpi(String(settings.default_dpi ?? 450))
    setMinHanRatio(String(Math.round(((settings.min_han_ratio ?? 1.0) * 100) as number)))
    setOcrFilters((settings.ocr_region_filters as OcrRegionFilter[]) || [])
  }, [settings])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const parsedMinHanRatio = Number(minHanRatio)
      const minHanRatioPct = Number.isFinite(parsedMinHanRatio) ? parsedMinHanRatio : 100
      const payload: {
        deepl_api_key?: string
        default_dpi: number
        min_han_ratio: number
        ocr_region_filters: OcrRegionFilter[]
      } = {
        default_dpi: parseInt(defaultDpi) || 450,
        min_han_ratio: Math.max(0, Math.min(1, minHanRatioPct / 100)),
        ocr_region_filters: ocrFilters,
      }
      if (deeplApiKey.trim()) {
        payload.deepl_api_key = deeplApiKey.trim()
      }
      return settingsApi.update(payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      alert('Configuración guardada')
    },
    onError: () => {
      alert('Error al guardar configuración')
    },
  })

  const handleSave = () => {
    saveMutation.mutate()
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-4 px-6 py-4 border-b bg-white">
        <Link to="/" className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl font-semibold">Configuración</h1>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-xl mx-auto space-y-6">
          {/* DeepL API Key */}
          <div className="bg-white p-6 rounded-lg border">
            <h2 className="font-medium mb-4">API de traducción</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  DeepL API Key
                </label>
                <input
                  type="password"
                  value={deeplApiKey}
                  onChange={(e) => setDeeplApiKey(e.target.value)}
                  placeholder="Dejar vacío para mantener la guardada"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Actual: <span className="font-mono">{settings?.deepl_api_key || '(no configurada)'}</span>
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  Obtén tu API key en{' '}
                  <a
                    href="https://www.deepl.com/pro-api"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 hover:underline"
                  >
                    deepl.com/pro-api
                  </a>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Filtros OCR persistentes (no crear región si coincide)
                </label>
                <div className="space-y-2">
                  {ocrFilters.map((f, idx) => (
                    <div key={idx} className="grid grid-cols-[110px_1fr_90px_40px] gap-2 items-center">
                      <select
                        value={f.mode}
                        onChange={(e) => {
                          const next = [...ocrFilters]
                          next[idx] = { ...next[idx], mode: e.target.value as OcrRegionFilter['mode'] }
                          setOcrFilters(next)
                        }}
                        className="px-2 py-1 border rounded"
                      >
                        <option value="contains">Contiene</option>
                        <option value="starts">Empieza</option>
                        <option value="ends">Termina</option>
                        <option value="regex">Regex</option>
                      </select>
                      <input
                        type="text"
                        value={f.pattern}
                        onChange={(e) => {
                          const next = [...ocrFilters]
                          next[idx] = { ...next[idx], pattern: e.target.value }
                          setOcrFilters(next)
                        }}
                        className="px-2 py-1 border rounded"
                        placeholder="Patrón"
                      />
                      <label className="flex items-center gap-2 text-sm text-gray-600">
                        <input
                          type="checkbox"
                          checked={!!f.case_sensitive}
                          onChange={(e) => {
                            const next = [...ocrFilters]
                            next[idx] = { ...next[idx], case_sensitive: e.target.checked }
                            setOcrFilters(next)
                          }}
                        />
                        Mayús.
                      </label>
                      <button
                        onClick={() => setOcrFilters(ocrFilters.filter((_, i) => i !== idx))}
                        className="px-2 py-1 border rounded hover:bg-gray-50"
                        title="Eliminar"
                      >
                        ×
                      </button>
                    </div>
                  ))}

                  <button
                    onClick={() =>
                      setOcrFilters([
                        ...ocrFilters,
                        { mode: 'contains', pattern: '', case_sensitive: false },
                      ])
                    }
                    className="px-3 py-2 border rounded-lg hover:bg-gray-50"
                  >
                    Añadir filtro
                  </button>
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  Útil para ignorar abreviaturas o rótulos que no quieras traducir.
                </p>
              </div>
            </div>
          </div>

          {/* OCR settings */}
          <div className="bg-white p-6 rounded-lg border">
            <h2 className="font-medium mb-4">OCR</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  % mínimo de caracteres chinos (Han)
                </label>
                <select
                  value={minHanRatio}
                  onChange={(e) => setMinHanRatio(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="100">100% (solo chino)</option>
                  <option value="90">90%</option>
                  <option value="80">80%</option>
                  <option value="70">70%</option>
                  <option value="60">60%</option>
                  <option value="50">50%</option>
                  <option value="40">40%</option>
                  <option value="30">30%</option>
                  <option value="20">20%</option>
                  <option value="10">10%</option>
                  <option value="0">0% (sin filtro)</option>
                </select>
                <p className="mt-1 text-sm text-gray-500">
                  Evita detectar abreviaturas (BK, GN, PE, N7) como texto a traducir.
                </p>
              </div>
            </div>
          </div>

          {/* Rendering settings */}
          <div className="bg-white p-6 rounded-lg border">
            <h2 className="font-medium mb-4">Renderizado</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  DPI por defecto
                </label>
                <select
                  value={defaultDpi}
                  onChange={(e) => setDefaultDpi(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="300">300 DPI (rápido)</option>
                  <option value="450">450 DPI (recomendado)</option>
                  <option value="600">600 DPI (alta calidad)</option>
                </select>
                <p className="mt-1 text-sm text-gray-500">
                  Mayor DPI = mejor calidad pero más lento
                </p>
              </div>
            </div>
          </div>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="w-full py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Guardar configuración
          </button>

          {/* Info */}
          <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-600">
            <p className="font-medium mb-2">Acerca de NB7X Translator</p>
            <p>Versión 0.1.0</p>
            <p>Traductor de PDFs de imagen (esquemas eléctricos) de chino a español.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
