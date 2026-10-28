"""Compatibilidad: los errores de la vertical viven ahora en `verticals.cleaning.errors`.

Este módulo se conserva para no romper los imports del slice 0 (servicios y
tests de `cleaning_bookings`); reexporta **los mismos objetos**, no copias, así
que `isinstance` sigue funcionando con una única jerarquía.
"""

from verticals.cleaning.errors import (  # noqa: F401
    CleaningAPIError,
    HoldExpired,
    InvalidTransition,
    ResourceUnavailable,
    SlotUnavailable,
)

__all__ = [
    'CleaningAPIError',
    'HoldExpired',
    'InvalidTransition',
    'ResourceUnavailable',
    'SlotUnavailable',
]
