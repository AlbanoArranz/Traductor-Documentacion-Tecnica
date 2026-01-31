import React from 'react';
import type { TextRegion } from '../lib/api';

interface RegionPropertiesPanelProps {
  region: TextRegion;
  onUpdate: (updates: Partial<TextRegion>) => void;
  onDelete: () => void;
  onClose: () => void;
  onDuplicate?: () => void;
}

const FONT_OPTIONS = [
  'Arial',
  'Times New Roman',
  'Courier New',
  'Georgia',
  'Verdana',
  'Tahoma',
  'Trebuchet MS',
  'Comic Sans MS',
];

export const RegionPropertiesPanel: React.FC<RegionPropertiesPanelProps> = ({
  region,
  onUpdate,
  onDelete,
  onClose,
  onDuplicate,
}) => {
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onUpdate({ tgt_text: e.target.value });
  };

  const handleFontFamilyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onUpdate({ font_family: e.target.value });
  };

  const handleFontSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value ? parseInt(e.target.value) : null;
    onUpdate({ font_size: value });
  };

  const handleTextColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate({ text_color: e.target.value });
  };

  const handleBgColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    onUpdate({ bg_color: value === '' ? null : value });
  };

  const handleTextAlignChange = (align: string) => {
    onUpdate({ text_align: align });
  };

  const handleRotationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value) || 0;
    onUpdate({ rotation: Math.max(0, Math.min(360, value)) });
  };

  const handleRenderOrderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || 0;
    onUpdate({ render_order: value });
  };

  const handleLockedToggle = () => {
    onUpdate({ locked: !region.locked });
  };

  const [x1, y1, x2, y2] = region.bbox;
  const width = Math.round(x2 - x1);
  const height = Math.round(y2 - y1);

  return (
    <div className="bg-white border rounded-lg shadow-sm p-4 space-y-4 max-h-[80vh] overflow-y-auto">
      <div className="flex items-center justify-between border-b pb-2">
        <h3 className="font-medium text-gray-900">Propiedades de caja</h3>
        <div className="flex gap-1">
          <button
            onClick={handleLockedToggle}
            className={`p-1.5 rounded ${region.locked ? 'text-red-600 bg-red-50' : 'text-gray-400 hover:bg-gray-100'}`}
            title={region.locked ? 'Desbloquear' : 'Bloquear'}
          >
            {region.locked ? '🔒' : '🔓'}
          </button>
          {onDuplicate && (
            <button
              onClick={onDuplicate}
              className="p-1.5 rounded text-gray-500 hover:bg-gray-100"
              title="Duplicar"
            >
              📋
            </button>
          )}
          <button
            onClick={onDelete}
            className="p-1.5 rounded text-red-500 hover:bg-red-50"
            title="Eliminar"
          >
            🗑️
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded text-gray-400 hover:bg-gray-100"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Texto */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Texto (ES)
        </label>
        <textarea
          value={region.tgt_text || ''}
          onChange={handleTextChange}
          className="w-full px-2 py-1.5 border rounded text-sm focus:ring-2 focus:ring-primary-500"
          rows={2}
          placeholder="Texto traducido..."
        />
      </div>

      {/* Geometría */}
      <div className="border-t pt-3">
        <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Geometría</h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="bg-gray-50 px-2 py-1 rounded">
            <span className="text-gray-500">X:</span> {Math.round(x1)}
          </div>
          <div className="bg-gray-50 px-2 py-1 rounded">
            <span className="text-gray-500">Y:</span> {Math.round(y1)}
          </div>
          <div className="bg-gray-50 px-2 py-1 rounded">
            <span className="text-gray-500">Ancho:</span> {width}
          </div>
          <div className="bg-gray-50 px-2 py-1 rounded">
            <span className="text-gray-500">Alto:</span> {height}
          </div>
        </div>
      </div>

      {/* Rotación y Z-Index */}
      <div className="border-t pt-3 space-y-3">
        <h4 className="text-xs font-medium text-gray-500 uppercase">Posicionamiento</h4>
        <div>
          <div className="flex justify-between mb-1">
            <label className="text-sm text-gray-700">Rotación</label>
            <span className="text-sm text-gray-500">{Math.round(region.rotation || 0)}°</span>
          </div>
          <input
            type="range"
            min="0"
            max="360"
            value={region.rotation || 0}
            onChange={handleRotationChange}
            className="w-full"
          />
        </div>
        <div>
          <div className="flex justify-between mb-1">
            <label className="text-sm text-gray-700">Orden (Z-index)</label>
            <span className="text-sm text-gray-500">{region.render_order || 0}</span>
          </div>
          <input
            type="number"
            min="0"
            max="100"
            value={region.render_order || 0}
            onChange={handleRenderOrderChange}
            className="w-full px-2 py-1 border rounded text-sm"
          />
          <p className="text-xs text-gray-400 mt-1">Menor = debajo, Mayor = encima</p>
        </div>
      </div>

      {/* Tipografía */}
      <div className="border-t pt-3 space-y-3">
        <h4 className="text-xs font-medium text-gray-500 uppercase">Tipografía</h4>
        <div>
          <label className="block text-sm text-gray-700 mb-1">Fuente</label>
          <select
            value={region.font_family || 'Arial'}
            onChange={handleFontFamilyChange}
            className="w-full px-2 py-1.5 border rounded text-sm"
          >
            {FONT_OPTIONS.map((font) => (
              <option key={font} value={font}>
                {font}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-700 mb-1">Tamaño (px)</label>
          <input
            type="number"
            min="8"
            max="72"
            value={region.font_size || ''}
            onChange={handleFontSizeChange}
            placeholder="Auto"
            className="w-full px-2 py-1.5 border rounded text-sm"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-700 mb-2">Alineación</label>
          <div className="flex gap-1">
            {['left', 'center', 'right'].map((align) => (
              <button
                key={align}
                onClick={() => handleTextAlignChange(align)}
                className={`flex-1 py-1.5 px-2 rounded text-sm border ${
                  region.text_align === align
                    ? 'bg-primary-50 border-primary-500 text-primary-700'
                    : 'bg-white hover:bg-gray-50'
                }`}
              >
                {align === 'left' && '←'}
                {align === 'center' && '↔'}
                {align === 'right' && '→'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Colores */}
      <div className="border-t pt-3 space-y-3">
        <h4 className="text-xs font-medium text-gray-500 uppercase">Colores</h4>
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-700 w-20">Texto</label>
          <input
            type="color"
            value={region.text_color || '#000000'}
            onChange={handleTextColorChange}
            className="w-10 h-8 rounded cursor-pointer"
          />
          <input
            type="text"
            value={region.text_color || '#000000'}
            onChange={handleTextColorChange}
            className="flex-1 px-2 py-1 border rounded text-sm font-mono"
          />
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-700 w-20">Fondo</label>
          <input
            type="color"
            value={region.bg_color || '#ffffff'}
            onChange={handleBgColorChange}
            className="w-10 h-8 rounded cursor-pointer"
          />
          <input
            type="text"
            value={region.bg_color || ''}
            onChange={handleBgColorChange}
            placeholder="Auto"
            className="flex-1 px-2 py-1 border rounded text-sm font-mono"
          />
          {region.bg_color && (
            <button
              onClick={() => onUpdate({ bg_color: null })}
              className="text-xs text-gray-500 hover:text-red-500"
              title="Usar color automático"
            >
              Auto
            </button>
          )}
        </div>
      </div>

      {/* Modo de composición */}
      <div className="border-t pt-3">
        <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Composición</h4>
        <select
          value={region.compose_mode || 'patch'}
          onChange={(e) => onUpdate({ compose_mode: e.target.value })}
          className="w-full px-2 py-1.5 border rounded text-sm"
        >
          <option value="patch">Patch (fondo sólido)</option>
          <option value="inpaint">Inpaint (reconstrucción)</option>
        </select>
      </div>

      {/* Info adicional */}
      <div className="border-t pt-3 text-xs text-gray-500">
        <div className="flex justify-between">
          <span>Tipo:</span>
          <span>{region.is_manual ? '✏️ Manual' : '🤖 OCR'}</span>
        </div>
        <div className="flex justify-between mt-1">
          <span>Confianza OCR:</span>
          <span>{Math.round((region.confidence || 0) * 100)}%</span>
        </div>
      </div>
    </div>
  );
};

export default RegionPropertiesPanel;
