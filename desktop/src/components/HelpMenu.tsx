import React, { useState } from 'react';
import { HelpCircle, X } from 'lucide-react';

export const HelpMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

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
          <div className="min-h-screen px-4 py-8">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl mx-auto">
              <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white rounded-t-lg">
                <h2 className="text-2xl font-semibold">Guía Completa de Usuario</h2>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded"
                >
                  <X size={24} />
                </button>
              </div>
              
              <div className="p-6 space-y-8">
                {/* Introducción */}
                <section>
                  <h3 className="text-xl font-bold text-blue-600 mb-3">📖 ¿Qué es esta aplicación?</h3>
                  <p className="text-gray-700 leading-relaxed">
                    Esta herramienta traduce documentos PDF (especialmente esquemas eléctricos técnicos) 
                    del chino al español. No traduce el PDF completo como texto, sino que detecta 
                    las zonas con texto chino y las sustituye por el texto en español manteniendo 
                    el diseño visual original del documento.
                  </p>
                </section>

                {/* Flujo paso a paso */}
                <section>
                  <h3 className="text-xl font-bold text-blue-600 mb-3">🔄 Flujo de trabajo paso a paso</h3>
                  <div className="space-y-4">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-bold text-lg">PASO 1: Crear un proyecto</h4>
                      <p className="text-gray-700 mt-2">
                        Desde la pantalla de inicio, pulsa "Nuevo proyecto", ponle un nombre 
                        descriptivo y selecciona tu archivo PDF. El sistema creará automáticamente 
                        la estructura del proyecto.
                      </p>
                    </div>
                    
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-bold text-lg">PASO 2: Renderizar las páginas</h4>
                      <p className="text-gray-700 mt-2">
                        Una vez dentro del proyecto, verás un botón <strong>"Renderizar"</strong>. 
                        Pulsa este botón para convertir cada página del PDF en una imagen. 
                        Esto es necesario para poder trabajar visualmente con el documento. 
                        Verás las miniaturas de las páginas en el panel izquierdo.
                      </p>
                    </div>
                    
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-bold text-lg">PASO 3: Ejecutar OCR (reconocimiento de texto)</h4>
                      <p className="text-gray-700 mt-2">
                        Pulsa el botón <strong>"OCR"</strong> para que el sistema detecte 
                        automáticamente todas las zonas de texto chino en la página actual. 
                        Aparecerán cajas verdes sobre el texto detectado. Cada caja representa 
                        una región de texto que se traducirá.
                      </p>
                    </div>
                    
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-bold text-lg">PASO 4: Revisar y corregir traducciones</h4>
                      <p className="text-gray-700 mt-2">
                        Haz doble click en cualquier caja para editar el texto. En el panel derecho 
                        puedes ajustar la fuente, tamaño, color y posición de cada caja. 
                        Usa las flechas del teclado para mover cajas pequeñas ajustes de posición.
                      </p>
                    </div>
                    
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-bold text-lg">PASO 5: Componer la página traducida</h4>
                      <p className="text-gray-700 mt-2">
                        Cuando estés satisfecho con las traducciones, pulsa <strong>"Componer"</strong> 
                        para generar la imagen traducida. Puedes alternar entre ver la original 
                        y la traducida con el selector "Ver: Original/Traducida".
                      </p>
                    </div>
                    
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-bold text-lg">PASO 6: Exportar el PDF final</h4>
                      <p className="text-gray-700 mt-2">
                        Cuando todas las páginas estén traducidas, pulsa <strong>"Exportar PDF"</strong> 
                        en la barra superior para generar el documento final.
                      </p>
                    </div>
                  </div>
                </section>

                {/* Botones explicados */}
                <section>
                  <h3 className="text-xl font-bold text-blue-600 mb-3">🔘 Descripción de cada botón</h3>
                  <div className="space-y-3">
                    <div className="border-l-4 border-blue-500 pl-4">
                      <h4 className="font-bold">Renderizar</h4>
                      <p className="text-gray-700">Convierte la página actual del PDF en imagen. Necesario antes de poder trabajar con OCR.</p>
                    </div>
                    <div className="border-l-4 border-green-500 pl-4">
                      <h4 className="font-bold">OCR</h4>
                      <p className="text-gray-700">Detecta automáticamente el texto chino en la página y crea cajas de traducción.</p>
                    </div>
                    <div className="border-l-4 border-purple-500 pl-4">
                      <h4 className="font-bold">+ Añadir caja</h4>
                      <p className="text-gray-700">Crea manualmente una caja de texto en el centro de la página. Útil si el OCR no detectó algo.</p>
                    </div>
                    <div className="border-l-4 border-orange-500 pl-4">
                      <h4 className="font-bold">Componer</h4>
                      <p className="text-gray-700">Genera la imagen traducida de la página actual aplicando todas las traducciones.</p>
                    </div>
                    <div className="border-l-4 border-red-500 pl-4">
                      <h4 className="font-bold">Componer todas</h4>
                      <p className="text-gray-700">Composición masiva de todas las páginas del documento.</p>
                    </div>
                    <div className="border-l-4 border-gray-500 pl-4">
                      <h4 className="font-bold">Ver: Original/Traducida</h4>
                      <p className="text-gray-700">Alterna entre ver la imagen original del PDF o la versión traducida.</p>
                    </div>
                  </div>
                </section>

                {/* Trabajar con cajas */}
                <section>
                  <h3 className="text-xl font-bold text-blue-600 mb-3">📦 Trabajando con cajas de texto</h3>
                  <div className="space-y-2 text-gray-700">
                    <p><strong>Seleccionar:</strong> Click simple en la caja</p>
                    <p><strong>Mover:</strong> Arrastrar con el ratón o usar flechas del teclado</p>
                    <p><strong>Redimensionar:</strong> Arrastrar las esquinas azules de la caja</p>
                    <p><strong>Editar texto:</strong> Doble click dentro de la caja</p>
                    <p><strong>Borrar:</strong> Pulsar tecla Supr (Delete) con la caja seleccionada</p>
                    <p><strong>Deseleccionar:</strong> Pulsar tecla ESC</p>
                  </div>
                </section>

                {/* Atajos */}
                <section>
                  <h3 className="text-xl font-bold text-blue-600 mb-3">⌨️ Atajos de teclado</h3>
                  <ul className="list-disc list-inside space-y-1 text-gray-700">
                    <li><strong>Flechas</strong> - Mover caja 1 píxel</li>
                    <li><strong>Shift + Flechas</strong> - Mover caja 10 píxeles</li>
                    <li><strong>ESC</strong> - Deseleccionar todo</li>
                    <li><strong>Supr</strong> - Borrar caja seleccionada</li>
                  </ul>
                </section>

                {/* Indicadores */}
                <section>
                  <h3 className="text-xl font-bold text-blue-600 mb-3">🔍 Indicadores visuales</h3>
                  <div className="space-y-2 text-gray-700">
                    <p>🔒 <strong>Candado</strong> - Caja bloqueada (no editable)</p>
                    <p>✏️ <strong>Lápiz</strong> - Caja creada manualmente (no por OCR)</p>
                    <p>🔵 <strong>Borde azul</strong> - Caja seleccionada actualmente</p>
                    <p>🟢 <strong>Borde verde</strong> - Caja detectada por OCR</p>
                  </div>
                </section>

                {/* Panel derecho */}
                <section>
                  <h3 className="text-xl font-bold text-blue-600 mb-3">📋 Panel derecho - Regiones de texto</h3>
                  <p className="text-gray-700 mb-2">
                    Muestra todas las cajas de texto de la página actual. Puedes:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-gray-700">
                    <li>Filtrar por texto original (ZH) o traducido (ES)</li>
                    <li>Bloquear/desbloquear cajas (icono del candado)</li>
                    <li>Eliminar cajas (icono de papelera)</li>
                    <li>Seleccionar cajas haciendo click en la lista</li>
                  </ul>
                </section>

                {/* Panel de propiedades */}
                <section>
                  <h3 className="text-xl font-bold text-blue-600 mb-3">⚙️ Panel de propiedades (caja seleccionada)</h3>
                  <p className="text-gray-700 mb-2">
                    Cuando seleccionas una caja, aparece un panel flotante donde puedes ajustar:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-gray-700">
                    <li><strong>Texto traducido</strong> - Lo que aparecerá en el documento final</li>
                    <li><strong>Fuente</strong> - Tipo de letra (Arial, Times, etc.)</li>
                    <li><strong>Tamaño de fuente</strong> - En puntos</li>
                    <li><strong>Color del texto</strong> - Color de las letras</li>
                    <li><strong>Color de fondo</strong> - Fondo de la caja (auto = detectado automáticamente)</li>
                    <li><strong>Alineación</strong> - Izquierda, centro o derecha</li>
                    <li><strong>Interlineado</strong> - Espacio entre líneas</li>
                    <li><strong>Rotación</strong> - Grados de inclinación</li>
                    <li><strong>Bloquear</strong> - Evita ediciones accidentales</li>
                  </ul>
                </section>

                {/* Glosario */}
                <section>
                  <h3 className="text-xl font-bold text-blue-600 mb-3">📚 Glosario</h3>
                  <p className="text-gray-700">
                    El glosario permite definir traducciones fijas para términos técnicos. 
                    Por ejemplo, si siempre traduces "电机" como "Motor", puedes añadirlo 
                    al glosario y se aplicará automáticamente en todas las páginas. 
                    Accede desde el botón "Glosario" en la barra superior.
                  </p>
                </section>

                {/* Procesar todo */}
                <section>
                  <h3 className="text-xl font-bold text-blue-600 mb-3">▶️ Procesar Todo</h3>
                  <p className="text-gray-700">
                    Este botón ejecuta automáticamente todo el flujo: Renderizar todas las páginas, 
                    ejecutar OCR en todas, traducir con DeepL y componer el resultado final. 
                    Es útil para documentos pequeños, pero para documentos grandes es mejor 
                    procesar página por página para poder revisar.
                  </p>
                </section>

                {/* Consejos */}
                <section>
                  <h3 className="text-xl font-bold text-blue-600 mb-3">💡 Consejos prácticos</h3>
                  <ul className="list-disc list-inside space-y-2 text-gray-700">
                    <li>Si el OCR no detecta un texto, usa "+ Añadir caja" para crearlo manualmente</li>
                    <li>Bloquea las cajas que ya estén correctas para evitar cambios accidentales</li>
                    <li>Usa el filtro de regiones para encontrar texto específico rápidamente</li>
                    <li>Guarda términos técnicos en el glosario para mantener consistencia</li>
                    <li>Revisa siempre antes de exportar, especialmente nombres propios y números</li>
                  </ul>
                </section>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default HelpMenu;