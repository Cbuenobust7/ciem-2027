# Generado por Django 5.2.10 y ajustado a mano (ADR-04, Apéndice A).
"""Instala la restricción de exclusión de agenda de ADR-04.

Flujo de autoría 0001/0002: `0001_initial` se generó **sin** la constraint y es
aquí donde se añade, con `BtreeGistExtension()` antes de `AddConstraint`. La
constraint usa el mismo objeto y el mismo módulo
(`verticals.cleaning.bookings.expressions.TsTzRange`) que
`Booking.Meta.constraints`; de ahí que `makemigrations --check` no proponga nada:
el estado del ORM y el de las migraciones coinciden.

Garantía que aporta: PostgreSQL rechaza dos reservas incompatibles del mismo
recurso con SQLSTATE `23P01`, incluso si la escritura no pasa por Django.
"""

import django.contrib.postgres.constraints
import django.contrib.postgres.fields.ranges
import verticals.cleaning.bookings.expressions
from django.conf import settings
from django.contrib.postgres.operations import BtreeGistExtension
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('cleaning_bookings', '0001_initial'),
        ('cleaning_providers', '0001_initial'),
        ('marketplace_listings', '0003_listingimage_marketplace_listing_bec690_idx_and_more'),
        ('marketplace_visibility', '0002_visibilitypurchase_mp_order_id'),
        ('payments_core', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # `btree_gist` es *trusted* desde PostgreSQL 13: la crea quien tenga
        # permiso CREATE en ESTA base, sin superusuario. Va antes de la
        # constraint porque el índice GiST necesita la clase de operador.
        BtreeGistExtension(),
        migrations.AddConstraint(
            model_name='booking',
            constraint=django.contrib.postgres.constraints.ExclusionConstraint(condition=models.Q(('status__in', ['requested', 'confirmed', 'in_progress'])), expressions=[(verticals.cleaning.bookings.expressions.TsTzRange('start_at', 'occupies_until', django.contrib.postgres.fields.ranges.RangeBoundary()), '&&'), ('resource', '=')], name='booking_no_overlap_per_resource'),
        ),
    ]
