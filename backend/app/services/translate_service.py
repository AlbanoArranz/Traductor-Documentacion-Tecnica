"""
Servicio de traducción usando DeepL API.
"""

from typing import List, Optional

from ..config import get_config


def _get_api_key() -> str:
    """Obtiene la API key de DeepL desde la configuración persistente."""
    config = get_config()
    return config.get("deepl_api_key", "")


def translate_batch(texts: List[str], source_lang: str = "ZH", target_lang: str = "ES") -> List[str]:
    """
    Traduce una lista de textos de chino a español usando DeepL.
    
    Args:
        texts: Lista de textos a traducir
        source_lang: Idioma origen (default: ZH)
        target_lang: Idioma destino (default: ES)
    
    Returns:
        Lista de textos traducidos
    """
    api_key = _get_api_key()
    if not api_key:
        # Fallback: devolver textos sin traducir con marcador
        return [f"[ES] {t}" for t in texts]
    
    try:
        import deepl
        translator = deepl.Translator(api_key)
        
        results = translator.translate_text(
            texts,
            source_lang=source_lang,
            target_lang=target_lang,
        )
        
        if isinstance(results, list):
            return [r.text for r in results]
        else:
            return [results.text]
    
    except Exception as e:
        # Fallback en caso de error
        print(f"Error en traducción DeepL: {e}")
        return [f"[ES] {t}" for t in texts]


def translate_single(text: str, source_lang: str = "ZH", target_lang: str = "ES") -> str:
    """Traduce un solo texto."""
    results = translate_batch([text], source_lang, target_lang)
    return results[0] if results else text
