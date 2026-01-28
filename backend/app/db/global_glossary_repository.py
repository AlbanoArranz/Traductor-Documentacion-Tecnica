import json
import uuid
from typing import Any, Dict, List

from app.config import GLOSSARY_GLOBAL_FILE
from app.db.models import GlossaryEntry


class GlobalGlossaryRepository:
    def __init__(self):
        self._cache: Dict[str, GlossaryEntry] = {}
        self._loaded = False

    def _load(self) -> None:
        if self._loaded:
            return
        self._loaded = True
        if not GLOSSARY_GLOBAL_FILE.exists():
            return
        try:
            with open(GLOSSARY_GLOBAL_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception:
            data = []
        for e in data:
            entry = GlossaryEntry(
                id=e.get("id") or str(uuid.uuid4()),
                project_id="__global__",
                src_term=e.get("src_term", ""),
                tgt_term=e.get("tgt_term", ""),
                locked=bool(e.get("locked", False)),
            )
            if entry.src_term:
                self._cache[entry.id] = entry

    def _save(self) -> None:
        GLOSSARY_GLOBAL_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(GLOSSARY_GLOBAL_FILE, "w", encoding="utf-8") as f:
            json.dump(
                [
                    {
                        "id": e.id,
                        "src_term": e.src_term,
                        "tgt_term": e.tgt_term,
                        "locked": e.locked,
                    }
                    for e in self._cache.values()
                ],
                f,
                ensure_ascii=False,
                indent=2,
            )

    def list_all(self) -> List[GlossaryEntry]:
        self._load()
        return list(self._cache.values())

    def replace_all(self, entries: List[Any]) -> None:
        self._load()
        self._cache = {}
        for e in entries:
            entry_id = getattr(e, "id", None) or str(uuid.uuid4())
            src_term = getattr(e, "src_term", "")
            tgt_term = getattr(e, "tgt_term", "")
            locked = bool(getattr(e, "locked", False))
            if not src_term:
                continue
            self._cache[entry_id] = GlossaryEntry(
                id=entry_id,
                project_id="__global__",
                src_term=src_term,
                tgt_term=tgt_term,
                locked=locked,
            )
        self._save()

    def contains_src_term(self, src_term: str) -> bool:
        self._load()
        return any(e.src_term == src_term for e in self._cache.values())
