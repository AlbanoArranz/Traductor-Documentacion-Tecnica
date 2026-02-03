import re
from typing import Iterable


def is_han_char(char: str) -> bool:
    code = ord(char)
    return (
        0x4E00 <= code <= 0x9FFF
        or 0x3400 <= code <= 0x4DBF
        or 0x20000 <= code <= 0x2A6DF
        or 0x2A700 <= code <= 0x2B73F
        or 0x2B740 <= code <= 0x2B81F
        or 0x2B820 <= code <= 0x2CEAF
        or 0xF900 <= code <= 0xFAFF
        or 0x2F800 <= code <= 0x2FA1F
    )


def has_han(text: str) -> bool:
    return any(is_han_char(c) for c in (text or ""))


def han_ratio(text: str) -> float:
    if not text:
        return 0.0
    han_count = sum(1 for c in text if is_han_char(c))
    return han_count / len(text)


_ALLOWED_LABEL_CHARS_RE = re.compile(r"^[A-Za-z0-9\-_/().:+,\s]+$")


def is_pure_label_like(text: str) -> bool:
    if not text:
        return True
    if has_han(text):
        return False
    return _ALLOWED_LABEL_CHARS_RE.match(text.strip()) is not None


def normalize_ocr_text(text: str) -> str:
    if text is None:
        return ""
    return " ".join(str(text).strip().split())


def iter_han_runs(text: str) -> Iterable[tuple[bool, str]]:
    if not text:
        return []

    out: list[tuple[bool, str]] = []
    buf: list[str] = []
    buf_is_han = is_han_char(text[0])

    for ch in text:
        ch_is_han = is_han_char(ch)
        if ch_is_han == buf_is_han:
            buf.append(ch)
        else:
            out.append((buf_is_han, "".join(buf)))
            buf = [ch]
            buf_is_han = ch_is_han

    if buf:
        out.append((buf_is_han, "".join(buf)))

    return out
