"""Backfill de `VisibilityPurchase.provider_account` desde el `seller` legado.

ADR-10: la promoción pasa a pertenecer a la cuenta de proveedor. Para las compras
que ya existían se busca la cuenta cuyo `owner` es el `seller`; si no hay ninguna,
se deja en NULL (la columna es nullable a propósito: la vertical puede estar
desactivada y no hay cuenta que asignar).
"""

from django.db import migrations


def backfill(apps, schema_editor):
    VisibilityPurchase = apps.get_model('marketplace_visibility', 'VisibilityPurchase')
    ProviderAccount = apps.get_model('cleaning_providers', 'ProviderAccount')
    for purchase in VisibilityPurchase.objects.filter(provider_account__isnull=True):
        account = (
            ProviderAccount.objects
            .filter(owner_id=purchase.seller_id)
            .order_by('id')
            .first()
        )
        if account is not None:
            purchase.provider_account = account
            purchase.save(update_fields=['provider_account'])


def noop_reverse(apps, schema_editor):
    """Revertir el campo ya lo deja en NULL: no hay nada que deshacer."""


class Migration(migrations.Migration):

    dependencies = [
        ('marketplace_visibility', '0003_visibilitypurchase_provider_account'),
        ('cleaning_providers', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(backfill, noop_reverse),
    ]
