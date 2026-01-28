---
name: antivirus-false-positive-mitigation
description: Mitiga falsos positivos de antivirus en ejecutables generados con PyInstaller, proponiendo medidas seguras y verificables. Úsese cuando el usuario mencione antivirus, false positive, Windows Defender, bloqueos al ejecutar el .exe o cuarentena.
---

# Mitigar falsos positivos de antivirus (PyInstaller)

## Cuándo usar esta skill
- Cuando el `.exe` generado con PyInstaller es bloqueado o puesto en cuarentena.
- Cuando el usuario pida recomendaciones para distribución en Windows.

## Flujo de trabajo
- [ ] Recoger evidencia: antivirus, mensaje exacto, hash/ubicación (si aplica).
- [ ] Confirmar si es entorno de dev/testing o distribución real.
- [ ] Proponer mitigaciones escalonadas (de menor a mayor fricción).
- [ ] Validar con el usuario qué opción aplicar.

## Instrucciones
1. Pide inputs mínimos:
   - Qué antivirus (p.ej. Windows Defender).
   - Qué acción hizo (bloqueo, cuarentena, warning).
   - Dónde está el `.exe` (ruta) y cómo se generó.
2. Propón mitigaciones (sin ejecutar nada):
   - Para testing local: exclusión de carpeta de build (si el usuario lo decide).
   - Para distribución: firmar el binario (recomendado).
   - Evitar empaquetados sospechosos (mantener build simple, sin “trucos”).
   - Enviar el binario a revisión del proveedor (si aplica).
3. Documenta riesgos:
   - No desactivar antivirus globalmente.
   - No recomendar prácticas inseguras.

## Restricciones
- No desactivar antivirus ni proponer acciones peligrosas.
- No inventar la causa del false positive.

## Recursos
- Checklist: `resources/checklist.md`
- Test plan: `test_plan.md`
