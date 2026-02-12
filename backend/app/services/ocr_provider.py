import logging
from pathlib import Path
from typing import List, Optional

from ..config import get_ocr_engine
from ..db.models import TextRegion

logger = logging.getLogger(__name__)


def detect_text(
    image_path: Path,
    dpi: int,
    custom_filters: Optional[list] = None,
    document_type: str = "schematic",
) -> List[TextRegion]:
    engine = get_ocr_engine()
    logger.info("OCR engine selected: %s (dpi=%s, image=%s)", engine, dpi, str(image_path))
    if engine == "paddleocr":
        from . import ocr_service_paddle

        return ocr_service_paddle.detect_text(
            image_path,
            dpi,
            custom_filters=custom_filters,
            document_type=document_type,
        )

    if engine == "rapidocr":
        from . import ocr_service_rapid

        return ocr_service_rapid.detect_text(
            image_path,
            dpi,
            custom_filters=custom_filters,
            document_type=document_type,
        )

    from . import ocr_service

    return ocr_service.detect_text(
        image_path,
        dpi,
        custom_filters=custom_filters,
        document_type=document_type,
    )
