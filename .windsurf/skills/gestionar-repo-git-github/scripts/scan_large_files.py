"""Scan repo for large tracked files.
Usage: python .windsurf/skills/gestionar-repo-git-github/scripts/scan_large_files.py [max_mb]
"""

from __future__ import annotations

import os
import subprocess
import sys


def _git_ls_files() -> list[str]:
    result = subprocess.run(["git", "ls-files"], capture_output=True, text=True, check=False)
    if result.returncode != 0:
        print("Error: git ls-files failed", file=sys.stderr)
        return []
    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


def main() -> int:
    max_mb = 100
    if len(sys.argv) > 1:
        try:
            max_mb = int(sys.argv[1])
        except ValueError:
            print("max_mb must be an integer", file=sys.stderr)
            return 2

    max_bytes = max_mb * 1024 * 1024
    files = _git_ls_files()
    if not files:
        print("No tracked files found.")
        return 0

    oversized = []
    for path in files:
        if not os.path.isfile(path):
            continue
        size = os.path.getsize(path)
        if size >= max_bytes:
            oversized.append((path, size))

    if not oversized:
        print(f"OK: no tracked files >= {max_mb} MB")
        return 0

    print(f"Found {len(oversized)} files >= {max_mb} MB:")
    for path, size in sorted(oversized, key=lambda x: x[1], reverse=True):
        print(f"- {path} ({size / (1024 * 1024):.2f} MB)")

    return 1


if __name__ == "__main__":
    raise SystemExit(main())
