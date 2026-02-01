import React, { useState } from 'react';
import { HelpCircle, X } from 'lucide-react';

export const HelpMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'types' | 'workflow' | 'editing' | 'glossary' | 'export' | 'deepl' | 'shortcuts'>('types');

  const TabButton = ({ id, label }: { id: typeof activeTab; label: string }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
        activeTab === id 
          ? 'bg-blue-600 text-white' 
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      {label}
    </button>
  );

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="p-2 hover:bg-gray-100 rounded-lg"
        title="Ayuda"
      >
        <HelpCircle size={20} />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 overflow-y-auto">
          <div className="min-h-screen px-4 py-4">
            <div className="bg-white rounded-lg shadow-xl max-w-5xl mx-auto">
              <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white rounded-t-lg z-10">
                <h2 className="text-2xl font-semibold">Guia Completa de Usuario</h2>
                <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-gray-100 rounded">
                  <X size={24} />
                </button>
              </div>

              <div className="px-6 py-4 border-b bg-gray-50">
                <div className="flex flex-wrap gap-2">
                  <TabButton id="types" label="1. Tipos de Documento" />
                  <TabButton id="workflow" label="2. Procesar Todo" />
                  <TabButton id="editing" label="3. Editar Cajas" />
                  <TabButton id="glossary" label="4. Glosario" />
                  <TabButton id="export" label="5. Exportar" />
                  <TabButton id="deepl" label="6. API DeepL" />
                  <TabButton id="shortcuts" label="Atajos" />
                </div>
              </div>
              
              <div className="p-6">
                {activeTab === 'types' && (
                  <section className="space-y-6">
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <h3 className="text-xl font-bold text-blue-700 mb-3">Paso 1: Seleccionar Tipo de Documento</h3>
                      <p className="text-gray-700">Al crear un proyecto, lo primero es elegir el tipo de documento. Esto determina como se procesara el OCR:</p>
                    </div>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="bg-white border-2 border-blue-200 rounded-lg p-5">
                        <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-semibold">Esquema</span>
                        <p className="text-gray-700 text-sm mt-3">Para esquemas electricos y diagramas. Texto disperso en cajas individuales. OCR detecta cada elemento separado.</p>
                      </div>
                      <div className="bg-white border-2 border-green-200 rounded-lg p-5">
                        <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-semibold">Manual</span>
                        <p className="text-gray-700 text-sm mt-3">Para manuales tecnicos. Texto en parrafos. OCR agrupa lineas en bloques grandes.</p>
                      </div>
                    </div>
                    <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                      <p className="text-sm text-gray-700">El tipo de documento no se puede cambiar despues de crear el proyecto.</p>
                    </div>
                  </section>
                )}
                {activeTab === 'workflow' && (
                  <section className="space-y-6">
                    <h3 className="text-xl font-bold text-green-700">Boton "Procesar Todo"</h3>
                    <p>Ejecuta el flujo completo automaticamente:</p>
                    <ol className="list-decimal list-inside space-y-2">
                      <li>Renderizar todas las paginas a imagen (450 DPI)</li>
                      <li>OCR: detectar todo el texto chino segun el tipo elegido</li>
                      <li>Traducir automaticamente con DeepL</li>
                      <li>Generar imagenes traducidas listas para revisar</li>
                    </ol>
                  </section>
                )}
                {activeTab === 'editing' && (
                  <section className="space-y-6">
                    <h3 className="text-xl font-bold text-blue-600">Editar Cajas de Texto</h3>
                    <ul className="space-y-2">
                      <li><strong>Click</strong> - Seleccionar caja</li>
                      <li><strong>Doble click</strong> - Editar texto</li>
                      <li><strong>Arrastrar</strong> - Mover caja</li>
                      <li><strong>Esquinas azules</strong> - Redimensionar</li>
                      <li><strong>Supr</strong> - Borrar caja</li>
                      <li><strong>Icono candado</strong> - Bloquear/Desbloquear</li>
                    </ul>
                  </section>
                )}
                {activeTab === 'glossary' && (
                  <section className="space-y-6">
                    <h3 className="text-xl font-bold text-blue-600">Glosario</h3>
                    <p>Define traducciones fijas para terminos tecnicos. Global (todos los proyectos) o Local (solo este proyecto).</p>
                  </section>
                )}
                {activeTab === 'export' && (
                  <section className="space-y-6">
                    <h3 className="text-xl font-bold text-blue-600">Exportar PDF</h3>
                    <p>Antes de exportar, debes pulsar "Componer Todas" para aplicar los cambios a las imagenes.</p>
                    <ol className="list-decimal list-inside space-y-2">
                      <li>Revisa y corrige las paginas</li>
                      <li>Pulsa "Componer Todas"</li>
                      <li>Pulsa "Exportar PDF"</li>
                    </ol>
                  </section>
                )}
                {activeTab === 'deepl' && (
                  <section className="space-y-6">
                    <h3 className="text-xl font-bold text-blue-600">API de DeepL</h3>
                    <p>API gratuita: 500.000 caracteres/mes. Si ves rectangulos (▯▯▯), has agotado el limite.</p>
                    <p><strong>Solucion:</strong> Crea nueva cuenta en deepl.com con otro email y genera nueva API key.</p>
                  </section>
                )}
                {activeTab === 'shortcuts' && (
                  <section className="space-y-6">
                    <h3 className="text-xl font-bold text-blue-600">Atajos</h3>
                    <ul className="space-y-2">
                      <li>Flechas - Mover 1 pixel</li>
                      <li>Shift+Flechas - Mover 10 pixeles</li>
                      <li>ESC - Deseleccionar</li>
                      <li>Supr - Borrar</li>
                    </ul>
                  </section>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default HelpMenu;