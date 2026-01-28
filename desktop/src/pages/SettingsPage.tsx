import { useState, useEffect } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { settingsApi } from '../lib/api'

export default function SettingsPage() {
  const [deeplApiKey, setDeeplApiKey] = useState('')
  const [defaultDpi, setDefaultDpi] = useState('450')
  const [minHanRatio, setMinHanRatio] = useState('100')

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsApi.get().then((r) => r.data),
  })

  useEffect(() => {
    if (!settings) return
    setDefaultDpi(String(settings.default_dpi ?? 450))
    setMinHanRatio(String(Math.round(((settings.min_han_ratio ?? 1.0) * 100) as number)))
  }, [settings])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: { deepl_api_key?: string; default_dpi: number; min_han_ratio: number } = {
        default_dpi: parseInt(defaultDpi) || 450,
        min_han_ratio: Math.max(0, Math.min(1, (parseInt(minHanRatio) || 100) / 100)),
      }
      if (deeplApiKey.trim()) {
        payload.deepl_api_key = deeplApiKey.trim()
      }
      return settingsApi.update(payload)
    },
    onSuccess: () => {
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
                  <option value="100">100% (estricto: solo chino)</option>
                  <option value="90">90% (muy estricto)</option>
                  <option value="80">80% (permite mixto)</option>
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
