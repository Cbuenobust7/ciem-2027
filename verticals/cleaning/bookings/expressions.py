"""Expresión `tstzrange(a, b, '[)')` para la restricción de exclusión (ADR-04).

Vive en su propio módulo —y no dentro de `models.py`— por una razón concreta:
`Booking.Meta.constraints` y la migración `0002` deben importar **la misma
clase**. Si cada archivo definiera la suya, la deconstrucción de la constraint
diferiría (la ruta de la clase forma parte del estado de migraciones) y
`makemigrations --check` reportaría un cambio fantasma en cada ejecución.
"""

from django.contrib.postgres.fields import DateTimeRangeField
from django.db.models import Func


class TsTzRange(Func):
    """`TSTZRANGE(start_at, occupies_until, '[)')` como expresión de Django."""

    function = 'TSTZRANGE'
    output_field = DateTimeRangeField()

    def __init__(self, start, end, bounds):
        super().__init__(start, end, bounds)
