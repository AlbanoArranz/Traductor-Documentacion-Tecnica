import json
import os
import sys


def _load_event() -> dict:
    try:
        raw = sys.stdin.read()
        if not raw.strip():
            return {}
        return json.loads(raw)
    except Exception as exc:  # noqa: BLE001
        print(f"Hook error: invalid JSON input: {exc}", file=sys.stderr)
        return {}


def _norm_path(p: str) -> str:
    if not p:
        return ""
    p = os.path.normpath(p)
    return p.lower()


def _is_env_path(path: str) -> bool:
    p = _norm_path(path)
    base = os.path.basename(p)

    if base == ".env":
        return True

    # Also protect variants like ".env.local", ".env.production", etc.
    if base.startswith(".env."):
        return True

    return False


def _block(msg: str) -> "never":
    print(msg, file=sys.stderr)
    raise SystemExit(2)


def _handle_pre_read_code(tool_info: dict) -> None:
    path = tool_info.get("file_path", "")
    if _is_env_path(path):
        _block(f"Blocked: reading protected file '{path}' (.env).")


def _handle_pre_write_code(tool_info: dict) -> None:
    path = tool_info.get("file_path", "")
    if _is_env_path(path):
        _block(f"Blocked: writing protected file '{path}' (.env).")


def _handle_pre_run_command(tool_info: dict) -> None:
    cmd = (tool_info.get("command_line") or "").strip()
    cmd_l = cmd.lower()

    # Basic destructive patterns (Windows/PowerShell + *nix).
    blocked_substrings = [
        "rm -rf",
        "rm -r",
        "del ",
        "erase ",
        "rmdir ",
        "rd ",
        "remove-item",
        "format ",
        "format-volume",
        "diskpart",
        "shutdown",
        "stop-computer",
        "restart-computer",
    ]

    for s in blocked_substrings:
        if s in cmd_l:
            _block(f"Blocked: potentially destructive command detected: {cmd}")


def main() -> None:
    event = _load_event()
    action = (event.get("agent_action_name") or "").strip()
    tool_info = event.get("tool_info") or {}

    if action == "pre_read_code":
        _handle_pre_read_code(tool_info)
    elif action == "pre_write_code":
        _handle_pre_write_code(tool_info)
    elif action == "pre_run_command":
        _handle_pre_run_command(tool_info)

    raise SystemExit(0)


if __name__ == "__main__":
    main()
