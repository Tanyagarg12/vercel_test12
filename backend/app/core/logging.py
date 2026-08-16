import logging
import sys
from functools import lru_cache

from app.core.config import get_settings


class StructuredFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        base = super().format(record)
        params = getattr(record, "params", None)
        if params:
            base = f"{base} | {params}"
        return base


@lru_cache
def get_logger(name: str = "app") -> logging.Logger:
    settings = get_settings()
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(
            StructuredFormatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s")
        )
        logger.addHandler(handler)
        logger.setLevel(settings.log_level)
        logger.propagate = False
    return logger
