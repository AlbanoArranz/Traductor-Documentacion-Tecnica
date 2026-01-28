import { Outlet, Link, useLocation } from 'react-router-dom'
import { Home, Settings, FileText } from 'lucide-react'

export default function Layout() {
  const location = useLocation()

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-16 bg-white border-r border-gray-200 flex flex-col items-center py-4 gap-4">
        <Link
          to="/"
          className={`p-3 rounded-lg transition-colors ${
            location.pathname === '/' ? 'bg-primary-100 text-primary-600' : 'text-gray-500 hover:bg-gray-100'
          }`}
          title="Inicio"
        >
          <Home size={24} />
        </Link>
        <Link
          to="/settings"
          className={`p-3 rounded-lg transition-colors ${
            location.pathname === '/settings' ? 'bg-primary-100 text-primary-600' : 'text-gray-500 hover:bg-gray-100'
          }`}
          title="Configuración"
        >
          <Settings size={24} />
        </Link>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
