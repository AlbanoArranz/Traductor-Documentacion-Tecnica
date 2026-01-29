from typing import List, Optional

from fastapi import APIRouter
from pydantic import BaseModel

from ..db.repository import global_glossary_repo

router = APIRouter()


class GlossaryEntry(BaseModel):
    id: Optional[str] = None
    src_term: str
    tgt_term: str
    locked: bool = False


class GlossaryResponse(BaseModel):
    entries: List[GlossaryEntry]


@router.get("", response_model=GlossaryResponse)
async def get_global_glossary():
    entries = global_glossary_repo.list_all()
    return GlossaryResponse(
        entries=[
            GlossaryEntry(
                id=e.id,
                src_term=e.src_term,
                tgt_term=e.tgt_term,
                locked=e.locked,
            )
            for e in entries
        ]
    )


@router.put("")
async def update_global_glossary(glossary: GlossaryResponse):
    global_glossary_repo.replace_all(glossary.entries)
    return {"status": "ok"}
