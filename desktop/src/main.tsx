import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import './index.css'
import { setApiBaseUrl } from './lib/api'

const queryClient = new (QueryClient as any)({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
)

// Inicializar baseURL dinámico para producción (Electron o Web)
;(async () => {
  try {
    const webApiUrl = import.meta.env.VITE_API_URL
    
    if (webApiUrl) {
      // Modo Web: usar URL desde variable de entorno
      setApiBaseUrl(webApiUrl)
    } else if (window.electronAPI?.getBackendUrl) {
      // Modo Desktop (Electron): usar API de Electron
      const url = await window.electronAPI.getBackendUrl()
      if (url) setApiBaseUrl(url)
    }
  } catch (e) {
    console.error('Could not initialize backend URL:', e)
  }
})()
