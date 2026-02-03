# Plan de resolución - PaddleOCR incompatibilidad

## Problema detectado
Error interno de PaddlePaddle: `ConvertPirAttribute2RuntimeAttribute not support [pir::ArrayAttribute<pir::DoubleAttribute>]`

Esto indica incompatibilidad entre:
- paddlepaddle 3.3.0
- paddleocr 3.3.3
- oneDNN (backend de ejecución)

## Opciones

### Opción A: Usar EasyOCR (Recomendada - 5 min)
- Cambiar smoke test para usar `ocr_engine=easyocr` (default del proyecto)
- PaddleOCR queda como experimental
- Todo funciona inmediatamente

### Opción B: Downgradear PaddleOCR a 2.x (15 min)
- Instalar `paddleocr==2.7.3` (última 2.x estable)
- Revertir cambios en código a API 2.x
- Verificar compatibilidad

### Opción C: Debuggear oneDNN (30+ min, incierto)
- Reinstalar paddlepaddle con version específica
- Variables de entorno para desactivar oneDNN
- Puede no resolver el problema

## Recomendación del plan
**Opción A** - El proyecto ya usa EasyOCR por defecto y funciona perfectamente. PaddleOCR era una alternativa experimental.
