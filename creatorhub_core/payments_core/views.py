# creatorhub_core/payments_core/views.py
import json
import logging
import uuid
from decimal import Decimal, InvalidOperation
from functools import partial

from django.conf import settings
from django.db import transaction
from django.http import HttpResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .gateways.mercadopago import MercadoPagoGateway
from .models import Payment
from .signals import payment_completed, payment_failed, payment_refunded

logger = logging.getLogger(__name__)


def get_gateway(name: str):
    if name == 'mercadopago':
        return MercadoPagoGateway(variant='pro')
    if name == 'mercadopago_bricks':
        return MercadoPagoGateway(variant='bricks')
    raise ValueError(f"Gateway no soportado: {name}")


def _get_webhook_secrets(event_type: str):
    if event_type == 'payment':
        return tuple(
            secret for secret in (
                getattr(settings, 'MERCADOPAGO_BRICKS_WEBHOOK_SECRET', ''),
                getattr(settings, 'MERCADOPAGO_PRO_WEBHOOK_SECRET', ''),
                getattr(settings, 'MERCADOPAGO_WEBHOOK_SECRET', ''),
            ) if secret
        )
    return tuple(
        secret for secret in (
            getattr(settings, 'MERCADOPAGO_PRO_WEBHOOK_SECRET', ''),
            getattr(settings, 'MERCADOPAGO_WEBHOOK_SECRET', ''),
        ) if secret
    )


def _amount_matches(payment, mp_data):
    transaction = mp_data.get("transaction", {})
    amount = (
        transaction.get("transaction_amount")
        or transaction.get("amount")
        or mp_data.get("transaction_amount")
        or mp_data.get("amount")
        or mp_data.get("total_amount")
    )
    currency = (
        transaction.get("currency_id")
        or transaction.get("currency")
        or mp_data.get("currency_id")
        or mp_data.get("currency")
    )
    if amount is None:
        logger.warning(
            "Order sin importe verificable para Payment %s",
            payment.id,
        )
        return False
    if not currency:
        logger.warning(
            "Order sin currency_id; se rechaza la sincronización "
            "del Payment %s",
            payment.id,
        )
        return False
    try:
        return (
            Decimal(str(amount)) == payment.amount
            and str(currency).upper() == payment.currency.upper()
        )
    except (InvalidOperation, AttributeError):
        return False


def _resolve_order_payment_id(payment_data):
    if not isinstance(payment_data, dict):
        return str(payment_data or ""), "id"

    reference = payment_data.get("reference") or {}
    candidates = (
        ("reference_id", payment_data.get("reference_id")),
        ("reference.id", reference.get("id")),
        ("id", payment_data.get("id")),
    )
    for source, value in candidates:
        if value:
            return str(value), source
    return "", None


def _select_order_payment(payments):
    """Prefer successful transactions, then the latest ISO timestamp."""
    priorities = {
        "processed": 3,
        "approved": 3,
        "pending": 2,
        "in_process": 2,
        "in_mediation": 2,
        "authorized": 2,
        "rejected": 1,
        "cancelled": 1,
    }
    candidates = [payment for payment in payments if isinstance(payment, dict)]
    if not candidates:
        return None

    return max(
        candidates,
        key=lambda payment: (
            priorities.get(payment.get("status"), 0),
            payment.get("date_last_updated") or payment.get("date_created") or "",
        ),
    )


def _sync_payment(gateway_payment_id, mp_data):
    status_map = {
        "approved": Payment.Status.COMPLETED,
        "processed": Payment.Status.COMPLETED,
        "refunded": Payment.Status.REFUNDED,
        "charged_back": Payment.Status.REFUNDED,
        "rejected": Payment.Status.FAILED,
        "cancelled": Payment.Status.FAILED,
        "pending": Payment.Status.PENDING,
        "in_process": Payment.Status.PENDING,
        "in_mediation": Payment.Status.PENDING,
        "authorized": Payment.Status.PENDING,
    }
    mp_status = mp_data.get("status")
    new_status = status_map.get(mp_status)
    if new_status is None:
        logger.warning(
            "Estado de Mercado Pago no reconocido: %s",
            mp_status,
        )
        return None, f"status no reconocido: {mp_status}"

    external_ref = mp_data.get("external_reference")
    signal_to_send = None

    with transaction.atomic():
        payment = Payment.objects.select_for_update().filter(
            gateway_payment_id=str(gateway_payment_id)
        ).first()

        if not payment and external_ref:
            payment = Payment.objects.select_for_update().filter(
                external_reference=external_ref,
                gateway="mercadopago",
            ).first()

        if not payment:
            logger.error(
                "Payment no encontrado para %s / %s",
                gateway_payment_id,
                external_ref,
            )
            return None, "Payment no encontrado"

        previous_status = payment.status
        if previous_status == Payment.Status.COMPLETED and new_status in {
            Payment.Status.PENDING,
            Payment.Status.FAILED,
        }:
            logger.warning(
                "Ignorando degradación del Payment %s: %s -> %s",
                payment.id,
                previous_status,
                new_status,
            )
            return payment, "degradación ignorada"

        if not _amount_matches(payment, mp_data):
            logger.error(
                "Monto o moneda no coinciden para Payment %s",
                payment.id,
            )
            return None, "monto o moneda no coinciden"

        payment.gateway_payment_id = str(gateway_payment_id)
        payment.raw_gateway_response = mp_data
        payment.status = new_status
        payment.save(
            update_fields=[
                "gateway_payment_id",
                "raw_gateway_response",
                "status",
                "updated_at",
            ]
        )

        if previous_status != new_status:
            if new_status == Payment.Status.COMPLETED:
                signal_to_send = payment_completed
            elif new_status == Payment.Status.FAILED:
                signal_to_send = payment_failed
            elif new_status == Payment.Status.REFUNDED:
                signal_to_send = payment_refunded
        payment_id = payment.id

    if signal_to_send is not None:
        transaction.on_commit(
            partial(_dispatch_payment_signal, signal_to_send, payment_id)
        )
    return payment, "sincronizado"


class CreatePreferenceView(APIView):
    """
    POST /api/payments/create-preference/
    Body: { amount, currency, payment_type, title?, metadata? }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        amount = request.data.get('amount')
        payment_type = request.data.get('payment_type')

        if not amount or not payment_type:
            return Response(
                {'error': 'amount y payment_type son requeridos'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            amount = float(amount)
            if amount <= 0:
                raise ValueError
        except (TypeError, ValueError):
            return Response(
                {'error': 'amount debe ser un número positivo'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        currency = request.data.get('currency', 'PEN')
        metadata = request.data.get('metadata', {})

        external_ref = (
            f"{payment_type}_{uuid.uuid4().hex[:8]}"
            f"_{request.user.id}_{int(timezone.now().timestamp())}"
        )

        # 1. Payment PENDING primero — nunca debe existir una preferencia
        #    en MP sin un Payment local que la represente.
        payment = Payment.objects.create(
            payer=request.user,
            amount=amount,
            currency=currency,
            payment_type=payment_type,
            status=Payment.Status.PENDING,
            gateway='mercadopago',
            external_reference=external_ref,
            metadata=metadata,
        )

        # 2. Recién ahora se llama a Mercado Pago.
        gateway = get_gateway('mercadopago')
        try:
            result = gateway.create_preference(
                payment_data={
                    'amount': amount,
                    'currency': currency,
                    'payment_type': payment_type,
                    'external_reference': external_ref,
                    'title': request.data.get('title'),
                    'description': request.data.get('description'),
                    'metadata': metadata,
                },
                user=request.user,
            )
        except Exception as e:
            logger.exception("Error creando preferencia de pago")
            # 3. Si MP falla, el Payment queda failed, no huérfano.
            payment.status = Payment.Status.FAILED
            payment.save(update_fields=['status', 'updated_at'])
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(result, status=status.HTTP_201_CREATED)


class PaymentHistoryView(APIView):
    """
    GET /api/payments/history/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        payments = Payment.objects.filter(payer=request.user).order_by('-created_at')
        data = [{
            'id': p.id,
            'amount': str(p.amount),
            'currency': p.currency,
            'payment_type': p.payment_type,
            'status': p.status,
            'gateway': p.gateway,
            'external_reference': p.external_reference,
            'created_at': p.created_at.isoformat(),
        } for p in payments]
        return Response(data)


@csrf_exempt
@require_http_methods(["POST"])
def mercadopago_webhook(request):
    """
    Webhook de Mercado Pago.

    La firma se valida antes de instanciar el gateway,
    porque verificar la firma solo requiere el webhook secret.
    """

    from .gateways.mercadopago import verify_mercadopago_signature

    try:
        body = json.loads(request.body)
    except json.JSONDecodeError:
        return HttpResponse(status=400)

    event_type = body.get("type") or request.GET.get("topic")

    if event_type not in (
        "payment",
        "merchant_order",
        "order",
        "orders_v2",
    ):
        return HttpResponse(status=200)

    logger.info(
        "Mercado Pago webhook recibido: type=%s data_id=%s",
        event_type,
        body.get("data", {}).get("id"),
    )

    is_order_event = event_type in ("order", "orders_v2")
    gateway_payment_id = None
    order_payment_data = None
    order_external_ref = None
    order_data = {}

    if event_type == "payment":
        # Webhook moderno: body JSON con data.id.
        if not any(
            verify_mercadopago_signature(request, secret)
            for secret in _get_webhook_secrets(event_type)
        ):
            logger.warning("Webhook rechazado: firma inválida")
            return HttpResponse(status=401)
        gateway_payment_id = body.get("data", {}).get("id")
    elif event_type == "merchant_order":
        # Notificacion legacy: topic=merchant_order.
        # MP no firma con el manifest moderno, asi que se consulta
        # directamente el merchant_order para obtener el payment_id.
        merchant_order_id = request.GET.get("id") or body.get("id")

        if merchant_order_id:
            try:
                gateway_tmp = get_gateway("mercadopago")
                merchant_order = gateway_tmp.get_merchant_order(
                    str(merchant_order_id)
                )
                if merchant_order:
                    payments = merchant_order.get("payments", [])
                    if payments:
                        gateway_payment_id = str(payments[0]["id"])
            except Exception:
                logger.exception(
                    "Error consultando merchant_order %s",
                    merchant_order_id,
                )
                return HttpResponse(status=200)

    else:
        if not any(
            verify_mercadopago_signature(request, secret)
            for secret in _get_webhook_secrets(event_type)
        ):
            logger.warning("Webhook de Order rechazado: firma inválida")
            return HttpResponse(status=401)

        order_id = body.get("data", {}).get("id")
        if not order_id:
            return HttpResponse(status=200)

        try:
            order = get_gateway("mercadopago").get_order(str(order_id)) or {}
            order_data = order
            order_external_ref = order.get("external_reference")
            order_payments = (
                order.get("transactions", {}).get("payments", [])
            )
        except Exception:
            logger.exception("Error consultando Order %s", order_id)
            return HttpResponse(status=200)

        if order_payments:
            order_payment_data = _select_order_payment(order_payments)
        if order_payment_data:
            gateway_payment_id, identifier_source = _resolve_order_payment_id(
                order_payment_data
            )
            logger.info(
                "Mercado Pago Order identificador resuelto: "
                "type=%s source=%s",
                event_type,
                identifier_source,
            )

    if not gateway_payment_id:
        return HttpResponse(status=200)

    # Orders ya devuelve el estado de la transacción dentro de la respuesta;
    # no se consulta el endpoint legacy de payments con un PAY... id.
    if is_order_event and order_payment_data:
        mp_data = {
            "external_reference": order_external_ref,
            "status": order_payment_data.get("status"),
            "status_detail": order_payment_data.get("status_detail"),
            "order_id": body.get("data", {}).get("id"),
            "total_amount": order_data.get("total_amount"),
            "currency_id": order_data.get("currency_id"),
            "currency": order_data.get("currency"),
            "transaction": order_payment_data,
        }
    else:
        mp_data = None

    # 2. Solo después de validar la firma necesitamos el Access Token. Como
    # Pro y Bricks comparten endpoint, probamos el token de cada integración.
    candidate_gateways = [] if mp_data else [get_gateway("mercadopago")]
    if not mp_data and getattr(
        settings, "MERCADOPAGO_BRICKS_ACCESS_TOKEN", ""
    ):
        candidate_gateways.append(get_gateway("mercadopago_bricks"))

    for gateway in candidate_gateways:
        try:
            mp_data = gateway.get_payment_status(str(gateway_payment_id))
        except Exception:
            logger.exception(
                "Error consultando estado del pago %s",
                gateway_payment_id,
            )
            continue
        if mp_data:
            break

    if not mp_data:
        logger.error(
            "No se pudo obtener estado del pago %s",
            gateway_payment_id,
        )
        return HttpResponse(status=200)

    _sync_payment(gateway_payment_id, mp_data)

    return HttpResponse(status=200)


def _dispatch_payment_signal(signal, payment_id):
    """
    Relee el Payment después del commit y emite la señal.
    """
    try:
        payment = Payment.objects.get(pk=payment_id)
    except Payment.DoesNotExist:
        logger.error(
            "Payment %s desapareció antes de emitir la señal.",
            payment_id,
        )
        return

    signal.send(sender=Payment, payment=payment)
