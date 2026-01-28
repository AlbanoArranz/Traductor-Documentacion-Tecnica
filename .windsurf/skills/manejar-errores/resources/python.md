# Manejo de errores en Python

## Jerarquía de excepciones personalizada
```python
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any


@dataclass
class ApplicationError(Exception):
    message: str
    code: str | None = None
    details: dict[str, Any] = field(default_factory=dict)
    timestamp: datetime = field(default_factory=datetime.utcnow)

    def __str__(self) -> str:
        return self.message


class ValidationError(ApplicationError):
    pass


class NotFoundError(ApplicationError):
    pass


class ExternalServiceError(ApplicationError):
    service: str

    def __init__(self, message: str, service: str, code: str | None = None, details: dict[str, Any] | None = None):
        super().__init__(message=message, code=code, details=details or {})
        self.service = service
```

## Context managers para limpieza
```python
from contextlib import contextmanager


@contextmanager
def database_transaction(session):
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
```

## Retry con backoff exponencial
```python
import time
from functools import wraps
from typing import Callable, TypeVar

T = TypeVar("T")


def retry(max_attempts: int = 3, backoff_factor: float = 2.0, exceptions: tuple[type[BaseException], ...] = (Exception,)):
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        def wrapper(*args, **kwargs) -> T:
            last_exception: BaseException | None = None
            for attempt in range(max_attempts):
                try:
                    return func(*args, **kwargs)
                except exceptions as e:  # type: ignore[misc]
                    last_exception = e
                    if attempt < max_attempts - 1:
                        time.sleep(backoff_factor**attempt)
                        continue
                    raise
            raise last_exception or RuntimeError("retry: unexpected state")

        return wrapper

    return decorator
```
