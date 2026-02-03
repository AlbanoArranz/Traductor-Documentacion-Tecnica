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

// Inicializar baseURL dinámico para producción (Electron) sin bloquear el render
;(async () => {
  try {
    if (window.electronAPI?.getBackendUrl) {
      const url = await window.electronAPI.getBackendUrl()
      if (url) setApiBaseUrl(url)
    }
  } catch (e) {
    console.error('Could not initialize backend URL from Electron:', e)
  }
})()
