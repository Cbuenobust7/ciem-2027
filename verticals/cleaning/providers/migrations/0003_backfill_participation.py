"""Backfill de la relación comercial a partir del estado anterior.

Mapeo (documentado en el diagnóstico, §6):

* `verified`            → `verified_partner` publicado
* `pending`             → `partner` publicado (asociado aún no verificado)
* `rejected`            → `partner` no publicado
* `suspended`           → `suspended` no publicado
* `is_active=False`     → `suspended` no publicado

La verificación documental se conserva en `verification_status`; la relación
comercial pasa a `participation_status`. No se inventan datos de procedencia:
`source_*` queda vacío y el admin lo completa al revisar cada ficha.
"""

from django.db import migrations


def backfill(apps, schema_editor):
    ProviderAccount = apps.get_model('cleaning_providers', 'ProviderAccount')
    ProviderStatusEvent = apps.get_model(
        'cleaning_providers', 'ProviderStatusEvent',
    )

    for account in ProviderAccount.objects.all().iterator():
        verification = account.verification_status
        if not account.is_active or verification == 'suspended':
            participation = 'suspended'
            published = False
        elif verification == 'verified':
            participation = 'verified_partner'
            published = True
        elif verification == 'rejected':
            participation = 'partner'
            published = False
        else:
            participation = 'partner'
            published = True

        account.participation_status = participation
        account.is_published = published
        update_fields = ['participation_status', 'is_published']
        # Los logos ya subidos por sus titulares se consideran autorizados; las
        # fichas nuevas exigen que el admin marque `media_authorized`.
        if account.logo:
            account.media_authorized = True
            update_fields.append('media_authorized')
        account.save(update_fields=update_fields)

        ProviderStatusEvent.objects.create(
            account=account,
            event_type='status',
            from_status='',
            to_status=participation,
            actor=None,
            reason='migracion_estado_inicial',
            metadata={
                'verification_status': verification,
                'is_active': account.is_active,
                'is_published': published,
            },
        )


class Migration(migrations.Migration):

    dependencies = [
        (
            'cleaning_providers',
            '0002_directorycorrectionrequest_providerclaim_and_more',
        ),
    ]

    operations = [
        migrations.RunPython(backfill, migrations.RunPython.noop),
    ]
