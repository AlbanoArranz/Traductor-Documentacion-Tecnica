# Test Plan — nb7x-live-coding-cycle

## Smoke test de la skill
Verificar que el agente sigue el ciclo correctamente al pedirle un slice.

### Test 1: Activación
- **Input**: "Vamos a hacer un slice para mejorar el zoom del canvas."
- **Expected**: El agente anuncia la skill, pide/crea Scope Card, ejecuta pre-flight.

### Test 2: Gates obligatorios
- **Input**: Tras implementar cambios, pedir commit.
- **Expected**: El agente ejecuta los 4 gates antes de commitear. Si uno falla, no commitea.

### Test 3: Formato de commit
- **Input**: Gates pasan, se genera commit.
- **Expected**: Mensaje sigue formato `<tipo>(<alcance>): <desc>` con líneas `Slice:` y `Gates:`.

### Test 4: Post-slice log
- **Input**: Tras commit.
- **Expected**: El agente rellena o propone el post-slice log.

### Test 5: Fuera de alcance
- **Input**: Durante implementación, surge trabajo no planificado.
- **Expected**: El agente lo anota como deuda, no lo implementa en este slice.

## Criterio de éxito
- El agente nunca salta un gate.
- El commit tiene formato correcto.
- Se genera Scope Card y Post-slice log.
- El alcance se mantiene acotado.
