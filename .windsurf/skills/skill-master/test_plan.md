# Test plan

- **Caso feliz**:
  - Dado un nombre y descripción válidos, genera una skill en `.windsurf/skills/<skill-name>/`.
  - El `SKILL.md` resultante incluye:
    - frontmatter válido (name/description)
    - cuándo usar, flujo, instrucciones, restricciones, recursos
  - No sobrescribe carpetas existentes.

- **Errores**:
  - Si la carpeta destino existe: debe abortar y pedir confirmación.
  - Si el `name` es inválido (no kebab-case / >64): debe rechazarlo.
  - Si se requiere ejecutar comandos: debe pedir confirmación explícita.

- **Regresión**:
  - Generar 2 skills distintas y verificar que ambas siguen el mismo estándar (estructura y secciones).
