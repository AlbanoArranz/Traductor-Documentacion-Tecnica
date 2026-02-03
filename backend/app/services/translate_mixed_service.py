from typing import Dict, List

from . import translate_service
from .text_script_utils import iter_han_runs


def translate_batch_preserving_non_han(texts: List[str], glossary_map: Dict[str, str]) -> List[str]:
    """Traduce solo runs Han y conserva el resto (AC/R1/etc.)."""

    segment_texts: List[str] = []
    segment_keys: List[tuple[int, int]] = []

    split_runs: List[List[tuple[bool, str]]] = []

    for i, text in enumerate(texts):
        runs = list(iter_han_runs(text or ""))
        split_runs.append(runs)
        for j, (is_han, seg) in enumerate(runs):
            if not is_han:
                continue
            seg = seg.strip()
            if not seg:
                continue
            if seg in glossary_map:
                continue
            segment_keys.append((i, j))
            segment_texts.append(seg)

    translations: List[str] = []
    if segment_texts:
        translations = translate_service.translate_batch(segment_texts)

    translated_by_key: Dict[tuple[int, int], str] = {}
    for (i, j), t in zip(segment_keys, translations):
        translated_by_key[(i, j)] = t

    out: List[str] = []
    for i, runs in enumerate(split_runs):
        parts: List[str] = []
        for j, (is_han, seg) in enumerate(runs):
            if not is_han:
                parts.append(seg)
                continue
            seg_stripped = seg.strip()
            if not seg_stripped:
                parts.append(seg)
                continue
            if seg_stripped in glossary_map:
                parts.append(glossary_map[seg_stripped])
                continue
            parts.append(translated_by_key.get((i, j), seg))
        out.append("".join(parts))

    return out
