import React, { useState, useRef, useCallback } from 'react';
import type { TextRegion } from '../lib/api';

interface EditableTextBoxProps {
  region: TextRegion;
  isSelected: boolean;
  index?: number;
  onSelect: (e?: React.MouseEvent) => void;
  onUpdate: (updates: Partial<TextRegion>) => void;
  scale?: number;
  documentType?: 'schematic' | 'manual';
  isIsolated?: boolean;
}

const HANDLE_SIZE = 8;

export const EditableTextBox: React.FC<EditableTextBoxProps> = ({
  region,
  isSelected,
  index = 0,
  onSelect,
  onUpdate,
  scale = 1,
  documentType = 'schematic',
  isIsolated = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeCorner, setResizeCorner] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(region.tgt_text || '');
  const dragStart = useRef({ x: 0, y: 0, bbox: [...region.bbox] });
  const localBboxRef = useRef<number[] | null>(null);
  const [localBbox, setLocalBbox] = useState<number[] | null>(null);
  const editSessionRef = useRef<{ original: string; done: boolean }>({
    original: region.tgt_text || '',
    done: false,
  });

  const baseBbox = React.useMemo(() => {
    if (!isIsolated) return region.bbox;
    const [x1, y1, x2, y2] = region.bbox;
    const h = Math.max(1, y2 - y1);
    const cy = (y1 + y2) / 2;
    const nh = h * 1.2;
    return [x1, cy - nh / 2, x2, cy + nh / 2];
  }, [isIsolated, region.bbox]);

  const visualBbox = (isDragging || isResizing) && localBbox ? localBbox : baseBbox;
  const [x1, y1, x2, y2] = visualBbox;
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

  // Determinar color del borde según estado y tipo de documento
  let borderColor = '#9ca3af'; // gray-400 default
  if (region.locked) borderColor = '#dc2626'; // red-600
  else if (isSelected) borderColor = '#2563eb'; // blue-600
  else if (documentType === 'manual') borderColor = '#059669'; // emerald-600 para manual
  else if (region.is_manual) borderColor = '#16a34a'; // green-600 para manual caja

  // Para modo manual, ajustar el ancho del borde
  const borderWidth = documentType === 'manual' ? 2 : 1;

  // Handlers de drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isEditing) return;
    e.stopPropagation();
    onSelect(e);
    
    if (!region.locked) {
      setIsDragging(true);
      dragStart.current = {
        x: e.clientX,
        y: e.clientY,
        bbox: [...region.bbox],
      };
      localBboxRef.current = [...baseBbox];
      setLocalBbox([...baseBbox]);
    }
  }, [isEditing, onSelect, region.locked, baseBbox, region.bbox]);

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
      const next = [ox1 + dxOrig, oy1 + dyOrig, ox2 + dxOrig, oy2 + dyOrig];
      localBboxRef.current = next;
      setLocalBbox(next);
      return;
    }

    if (isResizing && resizeCorner) {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      const dxOrig = dx / scale;
      const dyOrig = dy / scale;

      const [ox1, oy1, ox2, oy2] = dragStart.current.bbox;
      let nx1 = ox1, ny1 = oy1, nx2 = ox2, ny2 = oy2;

      switch (resizeCorner) {
        case 'nw': nx1 += dxOrig; ny1 += dyOrig; break;
        case 'ne': nx2 += dxOrig; ny1 += dyOrig; break;
        case 'sw': nx1 += dxOrig; ny2 += dyOrig; break;
        case 'se': nx2 += dxOrig; ny2 += dyOrig; break;
        case 'n': ny1 += dyOrig; break;
        case 's': ny2 += dyOrig; break;
        case 'w': nx1 += dxOrig; break;
        case 'e': nx2 += dxOrig; break;
      }

      const minW = 20;
      const minH = 10;
      const movesWest = ['nw', 'w', 'sw'].includes(resizeCorner);
      const movesEast = ['ne', 'e', 'se'].includes(resizeCorner);
      const movesNorth = ['nw', 'n', 'ne'].includes(resizeCorner);
      const movesSouth = ['sw', 's', 'se'].includes(resizeCorner);

      // Normalizar bbox (mantener orden)
      if (nx1 > nx2) [nx1, nx2] = [nx2, nx1]
      if (ny1 > ny2) [ny1, ny2] = [ny2, ny1]

      if (nx2 - nx1 < minW) {
        if (movesWest && !movesEast) {
          nx1 = nx2 - minW;
        } else if (movesEast && !movesWest) {
          nx2 = nx1 + minW;
        } else {
          const cx = (nx1 + nx2) / 2;
          nx1 = cx - minW / 2;
          nx2 = cx + minW / 2;
        }
      }

      if (ny2 - ny1 < minH) {
        if (movesNorth && !movesSouth) {
          ny1 = ny2 - minH;
        } else if (movesSouth && !movesNorth) {
          ny2 = ny1 + minH;
        } else {
          const cy = (ny1 + ny2) / 2;
          ny1 = cy - minH / 2;
          ny2 = cy + minH / 2;
        }
      }

      const next = [nx1, ny1, nx2, ny2];
      localBboxRef.current = next;
      setLocalBbox(next);
    }
  }, [isDragging, isResizing, resizeCorner, scale]);

  const handleMouseUp = useCallback(() => {
    if (isDragging || isResizing) {
      const startBbox = dragStart.current.bbox; // always region.bbox at start
      const cur = localBboxRef.current;
      if (cur && startBbox) {
        let saveBbox: number[];
        if (isDragging) {
          // For drag: apply delta to original region.bbox
          const ddx = cur[0] - startBbox[0];
          const ddy = cur[1] - startBbox[1];
          saveBbox = [
            region.bbox[0] + ddx,
            region.bbox[1] + ddy,
            region.bbox[2] + ddx,
            region.bbox[3] + ddy,
          ];
        } else {
          // For resize: the cur bbox was computed from startBbox (= region.bbox) deltas
          saveBbox = cur;
        }
        const hasMeaningfulDelta = saveBbox.some((value, idx) => Math.abs(value - region.bbox[idx]) > 0.5);
        if (hasMeaningfulDelta) {
          onUpdate({ bbox: saveBbox });
        }
      }
    }

    if (isDragging) setIsDragging(false);
    if (isResizing) setIsResizing(false);
    if (resizeCorner) setResizeCorner(null);
    localBboxRef.current = null;
    setLocalBbox(null);
  }, [isDragging, isResizing, onUpdate, region.bbox, resizeCorner]);

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
    e.preventDefault();
    e.stopPropagation();
    if (region.locked) return;
    
    setIsResizing(true);
    setResizeCorner(corner);
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      bbox: [...region.bbox], // Guardar coordenadas ORIGINALES (sin expansión)
    };
    localBboxRef.current = [...baseBbox];
    setLocalBbox([...baseBbox]);
  };

  // Double click to edit
  const handleDoubleClick = () => {
    if (!region.locked) {
      setIsEditing(true);
      const original = region.tgt_text || '';
      editSessionRef.current = { original, done: false };
      setEditText(original);
    }
  };

  const handleEditSubmit = () => {
    if (editSessionRef.current.done) return;
    editSessionRef.current.done = true;
    onUpdate({ tgt_text: editText });
    setIsEditing(false);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) return;
      e.preventDefault();
      handleEditSubmit();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      editSessionRef.current.done = true;
      setEditText(editSessionRef.current.original);
      setIsEditing(false);
    }
  };

  return (
    <div
      data-testid="text-box"
      data-selected={isSelected ? 'true' : 'false'}
      data-region-id={region.id}
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
          border: `${borderWidth}px solid ${borderColor}`,
          borderRadius: 2,
          opacity: isDragging ? 0.8 : 1,
        }}
      />

      {/* Text content */}
      {isEditing ? (
        <textarea
          data-testid="text-box-editor"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onBlur={() => {
            if (editSessionRef.current.done) return;
            handleEditSubmit();
          }}
          onKeyDown={handleEditKeyDown}
          autoFocus
          style={{
            position: 'absolute',
            inset: 0,
            width: swidth,
            height: sheight,
            border: 'none',
            background: 'white',
            fontSize: region.font_size ? region.font_size * scale : Math.min(sheight * 0.5, Math.max(8, swidth / 8)),
            fontFamily: region.font_family || 'Arial',
            color: textColor,
            textAlign: (region.text_align as any) || 'center',
            lineHeight: region.line_height || 1.0,
            resize: 'none',
            outline: 'none',
            padding: 0,
            boxSizing: 'border-box',
            margin: 0,
          }}
        />
      ) : (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: region.text_align === 'left' ? 'flex-start' : region.text_align === 'right' ? 'flex-end' : 'center',
            fontSize: region.font_size
              ? region.font_size * scale
              : Math.min(sheight * 0.5, Math.max(8, swidth / 8)),
            fontFamily: region.font_family || 'Arial',
            color: textColor,
            textAlign: (region.text_align as any) || 'center',
            lineHeight: region.line_height || 1.0,
            overflow: 'hidden',
            pointerEvents: 'none',
            userSelect: 'none',
            padding: 0,
            boxSizing: 'border-box',
          }}
        >
          <span style={{ maxWidth: '100%', wordBreak: 'break-word', overflow: 'hidden' }}>
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
              data-testid={`text-handle-${corner}`}
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

          {/* Edge resize handles (mid-side) */}
          <>
            {/* N */}
            <div
              data-testid="text-handle-n"
              onMouseDown={createResizeHandler('n')}
              style={{
                position: 'absolute',
                width: HANDLE_SIZE * 2,
                height: HANDLE_SIZE,
                backgroundColor: '#2563eb',
                border: '1px solid white',
                borderRadius: 2,
                top: -HANDLE_SIZE/2,
                left: `calc(50% - ${HANDLE_SIZE}px)`,
                cursor: 'n-resize',
              }}
            />
            {/* S */}
            <div
              data-testid="text-handle-s"
              onMouseDown={createResizeHandler('s')}
              style={{
                position: 'absolute',
                width: HANDLE_SIZE * 2,
                height: HANDLE_SIZE,
                backgroundColor: '#2563eb',
                border: '1px solid white',
                borderRadius: 2,
                bottom: -HANDLE_SIZE/2,
                left: `calc(50% - ${HANDLE_SIZE}px)`,
                cursor: 's-resize',
              }}
            />
            {/* W */}
            <div
              data-testid="text-handle-w"
              onMouseDown={createResizeHandler('w')}
              style={{
                position: 'absolute',
                width: HANDLE_SIZE,
                height: HANDLE_SIZE * 2,
                backgroundColor: '#2563eb',
                border: '1px solid white',
                borderRadius: 2,
                left: -HANDLE_SIZE/2,
                top: `calc(50% - ${HANDLE_SIZE}px)`,
                cursor: 'w-resize',
              }}
            />
            {/* E */}
            <div
              data-testid="text-handle-e"
              onMouseDown={createResizeHandler('e')}
              style={{
                position: 'absolute',
                width: HANDLE_SIZE,
                height: HANDLE_SIZE * 2,
                backgroundColor: '#2563eb',
                border: '1px solid white',
                borderRadius: 2,
                right: -HANDLE_SIZE/2,
                top: `calc(50% - ${HANDLE_SIZE}px)`,
                cursor: 'e-resize',
              }}
            />
          </>

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
