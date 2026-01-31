import React, { useState, useRef, useCallback } from 'react';
import type { TextRegion } from '../lib/api';

interface EditableTextBoxProps {
  region: TextRegion;
  imageSize: { width: number; height: number };
  isSelected: boolean;
  index?: number;
  onSelect: () => void;
  onUpdate: (updates: Partial<TextRegion>) => void;
  onDelete: () => void;
  scale?: number;
}

const HANDLE_SIZE = 8;

export const EditableTextBox: React.FC<EditableTextBoxProps> = ({
  region,
  imageSize,
  isSelected,
  index = 0,
  onSelect,
  onUpdate,
  onDelete,
  scale = 1,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(region.tgt_text || '');
  const dragStart = useRef({ x: 0, y: 0, bbox: [...region.bbox] });

  const [x1, y1, x2, y2] = region.bbox;
  // Calcular posición y tamaño escalados
  const sx1 = x1 * scale;
  const sy1 = y1 * scale;
  const sx2 = x2 * scale;
  const sy2 = y2 * scale;
  const swidth = sx2 - sx1;
  const sheight = sy2 - sy1;

  // Calcular estilos visuales
  const bgColor = region.bg_color || 'rgba(255, 255, 255, 0.9)';
  const textColor = region.text_color || '#000000';
  const rotation = region.rotation || 0;

  // Determinar color del borde según estado
  let borderColor = '#9ca3af'; // gray-400 default
  if (region.locked) borderColor = '#dc2626'; // red-600
  else if (region.is_manual) borderColor = '#16a34a'; // green-600
  else if (isSelected) borderColor = '#2563eb'; // blue-600

  // Handlers de drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isEditing) return;
    e.stopPropagation();
    onSelect();
    
    if (!region.locked) {
      setIsDragging(true);
      dragStart.current = {
        x: e.clientX,
        y: e.clientY,
        bbox: [...region.bbox],
      };
    }
  }, [isEditing, onSelect, region.locked, region.bbox]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      // Calcular delta en píxeles de pantalla
      const dx = (e.clientX - dragStart.current.x);
      const dy = (e.clientY - dragStart.current.y);
      
      // Convertir delta a coordenadas originales
      const dxOrig = dx / scale;
      const dyOrig = dy / scale;
      
      // Aplicar al bbox original guardado
      const [ox1, oy1, ox2, oy2] = dragStart.current.bbox;
      onUpdate({
        bbox: [ox1 + dxOrig, oy1 + dyOrig, ox2 + dxOrig, oy2 + dyOrig],
      });
    }
  }, [isDragging, onUpdate, scale]);

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
    }
    if (isResizing) {
      setIsResizing(false);
    }
  }, [isDragging, isResizing]);

  // Attach global mouse events
  React.useEffect(() => {
    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, handleMouseMove, handleMouseUp]);

  // Resize handlers
  const createResizeHandler = (corner: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    if (region.locked) return;
    
    setIsResizing(true);
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      bbox: [...region.bbox], // Guardar coordenadas ORIGINALES
    };

    const handleResizeMove = (ev: MouseEvent) => {
      const dx = ev.clientX - dragStart.current.x;
      const dy = ev.clientY - dragStart.current.y;
      
      // Convertir delta a coordenadas originales
      const dxOrig = dx / scale;
      const dyOrig = dy / scale;
      
      const [ox1, oy1, ox2, oy2] = dragStart.current.bbox;
      let nx1 = ox1, ny1 = oy1, nx2 = ox2, ny2 = oy2;

      switch (corner) {
        case 'nw': nx1 += dxOrig; ny1 += dyOrig; break;
        case 'ne': nx2 += dxOrig; ny1 += dyOrig; break;
        case 'sw': nx1 += dxOrig; ny2 += dyOrig; break;
        case 'se': nx2 += dxOrig; ny2 += dyOrig; break;
      }

      // Minimum size (en coordenadas originales)
      if (nx2 - nx1 > 20 && ny2 - ny1 > 10) {
        onUpdate({ bbox: [nx1, ny1, nx2, ny2] });
      }
    };

    const handleResizeUp = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', handleResizeMove);
      window.removeEventListener('mouseup', handleResizeUp);
    };

    window.addEventListener('mousemove', handleResizeMove);
    window.addEventListener('mouseup', handleResizeUp);
  };

  // Double click to edit
  const handleDoubleClick = () => {
    if (!region.locked) {
      setIsEditing(true);
      setEditText(region.tgt_text || '');
    }
  };

  const handleEditSubmit = () => {
    onUpdate({ tgt_text: editText });
    setIsEditing(false);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleEditSubmit();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        left: sx1,
        top: sy1,
        width: swidth,
        height: sheight,
        transform: `rotate(${rotation}deg)`,
        transformOrigin: 'center center',
        cursor: region.locked ? 'default' : isDragging ? 'grabbing' : 'grab',
        zIndex: isSelected ? 1000 : 10 + index,
      }}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
    >
      {/* Background */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: bgColor,
          border: `${isSelected ? 2 : 1}px solid ${borderColor}`,
          borderRadius: 2,
          opacity: isDragging ? 0.8 : 1,
        }}
      />

      {/* Text content */}
      {isEditing ? (
        <textarea
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onBlur={handleEditSubmit}
          onKeyDown={handleEditKeyDown}
          autoFocus
          style={{
            position: 'absolute',
            inset: 2,
            width: swidth - 4,
            height: sheight - 4,
            border: 'none',
            background: 'white',
            fontSize: Math.min(sheight * 0.6, Math.max(10, swidth / 10)),
            fontFamily: region.font_family || 'Arial',
            color: textColor,
            textAlign: (region.text_align as any) || 'center',
            resize: 'none',
            outline: 'none',
            padding: 2,
          }}
        />
      ) : (
        <div
          style={{
            position: 'absolute',
            inset: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: region.text_align === 'left' ? 'flex-start' : region.text_align === 'right' ? 'flex-end' : 'center',
            fontSize: Math.min(sheight * 0.6, Math.max(10, swidth / 10)),
            fontFamily: region.font_family || 'Arial',
            color: textColor,
            textAlign: (region.text_align as any) || 'center',
            overflow: 'hidden',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          <span style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {region.tgt_text || region.src_text}
          </span>
        </div>
      )}

      {/* Selection handles */}
      {isSelected && !region.locked && (
        <>
          {/* Corner resize handles */}
          {['nw', 'ne', 'sw', 'se'].map((corner) => (
            <div
              key={corner}
              onMouseDown={createResizeHandler(corner)}
              style={{
                position: 'absolute',
                width: HANDLE_SIZE,
                height: HANDLE_SIZE,
                backgroundColor: '#2563eb',
                border: '1px solid white',
                borderRadius: '50%',
                ...(
                  corner === 'nw' ? { top: -HANDLE_SIZE/2, left: -HANDLE_SIZE/2, cursor: 'nw-resize' } :
                  corner === 'ne' ? { top: -HANDLE_SIZE/2, right: -HANDLE_SIZE/2, cursor: 'ne-resize' } :
                  corner === 'sw' ? { bottom: -HANDLE_SIZE/2, left: -HANDLE_SIZE/2, cursor: 'sw-resize' } :
                  { bottom: -HANDLE_SIZE/2, right: -HANDLE_SIZE/2, cursor: 'se-resize' }
                ),
              }}
            />
          ))}

          {/* Lock/Manual indicators */}
          <div
            style={{
              position: 'absolute',
              top: -20,
              right: 0,
              display: 'flex',
              gap: 4,
            }}
          >
            {region.locked && (
              <span title="Bloqueado">🔒</span>
            )}
            {region.is_manual && (
              <span title="Manual">✏️</span>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default EditableTextBox;
