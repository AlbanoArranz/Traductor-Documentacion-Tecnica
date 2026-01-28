# Ejemplo de uso

Usuario:
"Configura Windsurf para este repo. Ya tengo algunas rules, pero me faltan workflows y hooks. No quiero que se sobrescriba nada existente."

Agente (usando `configurar-windsurf-proyecto`):
1. Inventaria `.windsurf/` y lista lo que ya existe.
2. Pregunta por stack y comandos (dev/test/build/release).
3. Propone deltas:
   - Create: `rules/<...>.md`, `workflows/<...>.md`, `hooks.json` (si falta), `hooks/guardrails.py` (si falta).
   - Modify: solo si mejora sin duplicar ni romper.
4. Pide confirmación.
5. Aplica cambios.
6. Devuelve árbol final y cómo usar cada workflow.
