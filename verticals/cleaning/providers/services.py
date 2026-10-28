"""Servicios de dominio de `cleaning_providers`.

Las transiciones de la relación comercial (§4) viven aquí, no en las vistas:
igual que `BookingEvent` en la vertical de reservas, cada cambio escribe un
`ProviderStatusEvent` dentro de la misma transacción. Así la auditoría
administrativa es fiable y las vistas solo orquestan permisos y respuestas.
"""

from django.db import IntegrityError, transaction
from django.utils import timezone

from verticals.cleaning.errors import (
    ClaimAlreadyPending,
    ClaimNotAvailable,
    InvalidTransition,
    ProviderInactive,
    ProviderNotOperational,
    ProviderSuspended,
)

from .models import (
    ProviderAccount,
    ProviderClaim,
    ProviderMembership,
    ProviderResource,
    ProviderStatusEvent,
)

TERMS_VERSION = '2026-10'


def record_event(
    account,
    event_type,
    *,
    actor=None,
    from_status='',
    to_status='',
    reason='',
    metadata=None,
):
    return ProviderStatusEvent.objects.create(
        account=account,
        event_type=event_type,
        from_status=from_status or '',
        to_status=to_status or '',
        actor=actor,
        reason=reason,
        metadata=metadata or {},
    )


def ensure_primary_resource(account):
    """Crea el recurso "Principal" si la cuenta aún no tiene agenda."""
    return ProviderResource.objects.get_or_create(
        account=account,
        name='Principal',
        defaults={'kind': ProviderResource.Kind.CREW},
    )[0]


# ---------------------------------------------------------------------------
# Reclamaciones (§2, §4)
# ---------------------------------------------------------------------------
@transaction.atomic
def request_claim(account, claimant, *, contact_email='', contact_phone='',
                  message='', evidence_url='', terms_accepted=False):
    """Solicita reclamar una ficha `directory`.

    No asigna titularidad ni verifica: solo deja la ficha en `claimed` y crea
    una reclamación pendiente de revisión administrativa.
    """
    if (
        account.participation_status != ProviderAccount.Participation.DIRECTORY
        or not account.is_published
        or not account.is_active
    ):
        raise ClaimNotAvailable(
            'Esta ficha no admite una reclamación en su estado actual.',
            extra={'account': account.id, 'status': account.participation_status},
        )
    if (
        account.owner_id == claimant.id
        or account.memberships.filter(user=claimant, is_active=True).exists()
    ):
        raise ClaimAlreadyPending(
            'Ya operas esta ficha.',
            extra={'account': account.id},
        )
    if account.claims.filter(status=ProviderClaim.Status.PENDING).exists():
        raise ClaimAlreadyPending(
            'Ya hay una reclamación pendiente para esta ficha.',
            extra={'account': account.id},
        )

    previous = account.participation_status
    try:
        with transaction.atomic():
            claim = ProviderClaim.objects.create(
                account=account,
                claimant=claimant,
                contact_email=contact_email,
                contact_phone=contact_phone,
                message=message,
                evidence_url=evidence_url,
                terms_accepted=terms_accepted,
            )
    except IntegrityError:
        raise ClaimAlreadyPending(
            'Ya hay una reclamación pendiente para esta ficha.',
            extra={'account': account.id},
        )
    account.participation_status = ProviderAccount.Participation.CLAIMED
    account.save(update_fields=['participation_status', 'updated_at'])
    record_event(
        account,
        ProviderStatusEvent.EventType.CLAIM,
        actor=claimant,
        from_status=previous,
        to_status=account.participation_status,
        reason='reclamacion_solicitada',
        metadata={'claim_id': claim.id},
    )
    return claim


@transaction.atomic
def approve_claim(claim, actor, note=''):
    """Aprueba una reclamación: asigna titularidad y convierte en `partner`.

    No verifica. La verificación es un acto separado del administrador.
    """
    claim = ProviderClaim.objects.select_for_update().get(pk=claim.pk)
    if claim.status != ProviderClaim.Status.PENDING:
        raise InvalidTransition(
            'La reclamación ya no está pendiente.',
            extra={'claim': claim.id, 'status': claim.status},
        )
    if not claim.terms_accepted:
        raise InvalidTransition(
            'La reclamación no incluye la aceptación de condiciones.',
            extra={'claim': claim.id},
        )
    account = claim.account
    if account.participation_status != ProviderAccount.Participation.CLAIMED:
        raise InvalidTransition(
            'La ficha ya no está en estado reclamado.',
            extra={'account': account.id, 'status': account.participation_status},
        )

    previous = account.participation_status
    account.owner = claim.claimant
    account.participation_status = ProviderAccount.Participation.PARTNER
    account.is_published = True
    account.last_reviewed_at = timezone.now()
    account.reviewed_by = actor
    if claim.terms_accepted:
        account.terms_accepted_at = timezone.now()
        account.terms_version = TERMS_VERSION
    account.save(update_fields=[
        'owner',
        'participation_status',
        'is_published',
        'last_reviewed_at',
        'reviewed_by',
        'terms_accepted_at',
        'terms_version',
        'updated_at',
    ])

    # Solo puede haber un owner activo por cuenta; el resto se desactiva.
    ProviderMembership.objects.filter(
        account=account, role=ProviderMembership.Role.OWNER,
    ).exclude(user=claim.claimant).update(is_active=False)
    ProviderMembership.objects.update_or_create(
        account=account,
        user=claim.claimant,
        defaults={
            'role': ProviderMembership.Role.OWNER,
            'is_active': True,
        },
    )
    ensure_primary_resource(account)

    claim.status = ProviderClaim.Status.APPROVED
    claim.reviewed_by = actor
    claim.reviewed_at = timezone.now()
    claim.decision_note = note
    claim.save(update_fields=[
        'status', 'reviewed_by', 'reviewed_at', 'decision_note',
    ])

    record_event(
        account,
        ProviderStatusEvent.EventType.CLAIM,
        actor=actor,
        from_status=previous,
        to_status=account.participation_status,
        reason='reclamacion_aprobada',
        metadata={'claim_id': claim.id},
    )
    record_event(
        account,
        ProviderStatusEvent.EventType.STATUS,
        actor=actor,
        from_status=previous,
        to_status=account.participation_status,
        reason='reclamacion_aprobada',
        metadata={'claim_id': claim.id},
    )
    return claim


@transaction.atomic
def reject_claim(claim, actor, note=''):
    claim = ProviderClaim.objects.select_for_update().get(pk=claim.pk)
    if claim.status != ProviderClaim.Status.PENDING:
        raise InvalidTransition(
            'La reclamación ya no está pendiente.',
            extra={'claim': claim.id, 'status': claim.status},
        )
    account = claim.account
    previous = account.participation_status
    account.participation_status = ProviderAccount.Participation.DIRECTORY
    account.save(update_fields=['participation_status', 'updated_at'])

    claim.status = ProviderClaim.Status.REJECTED
    claim.reviewed_by = actor
    claim.reviewed_at = timezone.now()
    claim.decision_note = note
    claim.save(update_fields=[
        'status', 'reviewed_by', 'reviewed_at', 'decision_note',
    ])

    record_event(
        account,
        ProviderStatusEvent.EventType.CLAIM,
        actor=actor,
        from_status=previous,
        to_status=account.participation_status,
        reason='reclamacion_rechazada',
        metadata={'claim_id': claim.id},
    )
    return claim


# ---------------------------------------------------------------------------
# Publicación, correcciones y verificación
# ---------------------------------------------------------------------------
@transaction.atomic
def set_publication(account, actor, published, *, reason=''):
    if published and account.participation_status not in ProviderAccount.PUBLIC_PARTICIPATION:
        raise InvalidTransition(
            'Una ficha suspendida o retirada no puede publicarse.',
            extra={'account': account.id, 'status': account.participation_status},
        )
    previous = account.is_published
    account.is_published = bool(published)
    if published:
        account.last_reviewed_at = timezone.now()
        account.reviewed_by = actor
    account.save(update_fields=[
        'is_published', 'last_reviewed_at', 'reviewed_by', 'updated_at',
    ])
    record_event(
        account,
        ProviderStatusEvent.EventType.PUBLICATION,
        actor=actor,
        from_status='published' if previous else 'unpublished',
        to_status='published' if account.is_published else 'unpublished',
        reason=reason or 'cambio_de_publicacion',
    )
    return account


@transaction.atomic
def resolve_correction(request, actor, *, note='', remove=False):
    from .models import DirectoryCorrectionRequest

    request = DirectoryCorrectionRequest.objects.select_for_update().get(
        pk=request.pk,
    )
    if request.status != DirectoryCorrectionRequest.Status.PENDING:
        raise InvalidTransition(
            'La solicitud ya está resuelta.',
            extra={'request': request.id, 'status': request.status},
        )
    account = request.account
    previous = account.participation_status
    if remove:
        account.participation_status = ProviderAccount.Participation.REMOVED
        account.is_published = False
        account.save(update_fields=[
            'participation_status', 'is_published', 'updated_at',
        ])
        record_event(
            account,
            ProviderStatusEvent.EventType.STATUS,
            actor=actor,
            from_status=previous,
            to_status=account.participation_status,
            reason='retirada_solicitada',
            metadata={'correction_request': request.id},
        )
    request.status = DirectoryCorrectionRequest.Status.RESOLVED
    request.resolved_by = actor
    request.resolved_at = timezone.now()
    request.resolution_note = note
    request.save(update_fields=[
        'status', 'resolved_by', 'resolved_at', 'resolution_note',
    ])
    record_event(
        account,
        ProviderStatusEvent.EventType.CORRECTION,
        actor=actor,
        from_status=previous,
        to_status=account.participation_status,
        reason='retirada_resuelta' if remove else 'correccion_resuelta',
        metadata={'correction_request': request.id},
    )
    return request


@transaction.atomic
def reject_correction(request, actor, *, note=''):
    from .models import DirectoryCorrectionRequest

    request = DirectoryCorrectionRequest.objects.select_for_update().get(
        pk=request.pk,
    )
    if request.status != DirectoryCorrectionRequest.Status.PENDING:
        raise InvalidTransition(
            'La solicitud ya está resuelta.',
            extra={'request': request.id, 'status': request.status},
        )
    request.status = DirectoryCorrectionRequest.Status.REJECTED
    request.resolved_by = actor
    request.resolved_at = timezone.now()
    request.resolution_note = note
    request.save(update_fields=[
        'status', 'resolved_by', 'resolved_at', 'resolution_note',
    ])
    record_event(
        request.account,
        ProviderStatusEvent.EventType.CORRECTION,
        actor=actor,
        reason='solicitud_rechazada',
        metadata={'correction_request': request.id},
    )
    return request


@transaction.atomic
def request_verification(account, actor):
    """Solicita la verificación documental; no cambia la relación comercial."""
    if not account.is_active:
        raise ProviderInactive(
            'La cuenta está desactivada.',
            extra={'account': account.id},
        )
    if (
        account.participation_status == ProviderAccount.Participation.SUSPENDED
        or account.verification_status == ProviderAccount.Verification.SUSPENDED
    ):
        raise ProviderSuspended(
            'La cuenta está suspendida.',
            extra={'account': account.id},
        )
    if not account.can_operate:
        raise ProviderNotOperational(
            'Solo un proveedor asociado puede solicitar la verificación.',
            extra={'account': account.id, 'status': account.participation_status},
        )
    if account.verification_status in (
        ProviderAccount.Verification.PENDING,
        ProviderAccount.Verification.VERIFIED,
    ):
        return account
    previous = account.verification_status
    account.verification_status = ProviderAccount.Verification.PENDING
    account.verified_at = None
    account.save(update_fields=[
        'verification_status', 'verified_at', 'updated_at',
    ])
    record_event(
        account,
        ProviderStatusEvent.EventType.VERIFICATION,
        actor=actor,
        from_status=previous,
        to_status=account.verification_status,
        reason='verificacion_solicitada',
    )
    return account


@transaction.atomic
def retire_provider(account, actor, *, reason=''):
    """Retira una ficha del directorio sin borrar su historial (§4)."""
    previous = account.participation_status
    account.participation_status = ProviderAccount.Participation.REMOVED
    account.is_published = False
    account.save(update_fields=[
        'participation_status', 'is_published', 'updated_at',
    ])
    record_event(
        account,
        ProviderStatusEvent.EventType.STATUS,
        actor=actor,
        from_status=previous,
        to_status=account.participation_status,
        reason=reason or 'retirada_administrativa',
    )
    return account
