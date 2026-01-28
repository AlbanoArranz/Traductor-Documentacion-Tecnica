import argparse
import os
from pathlib import Path


def _validate_skill_name(name: str) -> None:
    if not name:
        raise ValueError("El nombre de la skill no puede estar vacío")
    if len(name) > 64:
        raise ValueError("El nombre de la skill no puede superar 64 caracteres")

    allowed = set("abcdefghijklmnopqrstuvwxyz0123456789-")
    if any(ch not in allowed for ch in name):
        raise ValueError("El nombre debe ser kebab-case (minúsculas, números y guiones)")

    reserved = {"anthropic", "claude"}
    if name in reserved:
        raise ValueError("El nombre no puede ser una palabra reservada")


def _render_skill_md(name: str, description: str) -> str:
    return (
        "---\n"
        f"name: {name}\n"
        f"description: {description}\n"
        "---\n\n"
        "## Objetivo\n"
        "<Describe en una frase el resultado>\n\n"
        "## Instrucciones\n"
        "1. <Paso 1>\n"
        "2. <Paso 2>\n\n"
        "## Ejemplos\n"
        "### Ejemplo 1\n"
        "- Entrada:\n"
        "  - <texto>\n"
        "- Salida esperada:\n"
        "  - <texto>\n\n"
        "## Restricciones\n"
        "- No hardcodear secretos.\n"
        "- No sobrescribir archivos existentes.\n\n"
        "## Recursos\n"
        "- Test plan: `test_plan.md`\n"
        "- Ver: `resources/` y `examples/`\n"
    )


def _render_test_plan_md() -> str:
    return (
        "# Test plan\n\n"
        "- **Caso feliz**: ...\n"
        "- **Errores**: ...\n"
        "- **Regresión**: ...\n"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Scaffold de Skills para .windsurf/skills")
    parser.add_argument("name", help="Nombre de la Skill (kebab-case)")
    parser.add_argument("description", help="Descripción de la Skill (qué hace y cuándo usarla)")
    parser.add_argument(
        "--root",
        default=None,
        help="Ruta al root del repo. Por defecto: detectar subiendo desde este script.",
    )

    args = parser.parse_args()
    name = args.name.strip()
    description = args.description.strip()

    _validate_skill_name(name)

    if not description:
        raise ValueError("La descripción no puede estar vacía")

    if args.root:
        repo_root = Path(args.root).resolve()
    else:
        # scripts/ -> skill-master/ -> skills/ -> .windsurf/ -> repo root
        repo_root = Path(__file__).resolve().parents[4]

    skills_dir = repo_root / ".windsurf" / "skills"
    target_dir = skills_dir / name

    if target_dir.exists():
        raise FileExistsError(f"La carpeta ya existe: {target_dir}")

    os.makedirs(target_dir / "scripts", exist_ok=False)
    os.makedirs(target_dir / "resources", exist_ok=False)
    os.makedirs(target_dir / "examples", exist_ok=False)

    (target_dir / "SKILL.md").write_text(_render_skill_md(name, description), encoding="utf-8")
    (target_dir / "test_plan.md").write_text(_render_test_plan_md(), encoding="utf-8")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
