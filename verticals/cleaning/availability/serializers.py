"""Serialización de la respuesta de disponibilidad (§5.2).

El contrato muestra las horas en UTC con sufijo `Z` y la zona del recurso en un
campo aparte (`timezone`), para que el frontend renderice en hora local sin
adivinar offsets.
"""

from datetime import timezone as dt_timezone


def iso_z(value):
    """`2026-10-10T15:00:00Z`, exactamente como el ejemplo del contrato."""
    return value.astimezone(dt_timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def serialize_availability(*, listing, service, timezone_name, days, generated_at):
    """Construye el cuerpo de `GET .../availability/`."""
    payload_days = []
    for day in days:
        item = {
            'date': day.day.isoformat(),
            'weekday': day.weekday,
            'slots': [
                {
                    'start': iso_z(slot.start),
                    'end': iso_z(slot.end),
                    'resource_id': slot.resource_id,
                    'resource_name': slot.resource_name,
                }
                for slot in day.slots
            ],
        }
        # `reason` solo aparece cuando el día no tiene huecos (§5.2).
        if day.reason:
            item['reason'] = day.reason
        payload_days.append(item)

    return {
        'service': listing.id,
        'duration_minutes': service.duration_minutes,
        'timezone': timezone_name,
        'days': payload_days,
        'generated_at': iso_z(generated_at),
    }
