# creatorhub_core/payments_core/gateways/mercadopago.py
import hashlib
import hmac
from urllib.parse import quote

from django.conf import settings

from .base import PaymentGateway


def _verify_mercadopago_signature(request, secret):
    """Valida la firma contra un secreto concreto."""
    if not secret:
        return False

    signature_header = request.headers.get("x-signature", "")
    request_id = request.headers.get("x-request-id", "")

    ts = None
    received_hash = None
    for part in signature_header.split(","):
        if "=" not in part:
            continue
        key, value = part.split("=", 1)
        key = key.strip()
        value = value.strip()
        if key == "ts":
            ts = value
        elif key == "v1":
            received_hash = value

    if not ts or not received_hash:
        return False

    manifest_parts = []
    data_id = request.GET.get("data.id", "").lower()
    if data_id:
        manifest_parts.append(f"id:{data_id}")
    if request_id:
        manifest_parts.append(f"request-id:{request_id}")
    manifest_parts.append(f"ts:{ts}")
    manifest = ";".join(manifest_parts) + ";"
    computed_hash = hmac.new(
        secret.encode(),
        manifest.encode(),
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(computed_hash, received_hash)


def verify_mercadopago_signature(request, secret=None):
    """
    Valida la firma del webhook de Mercado Pago.

    No requiere instanciar MercadoPagoGateway ni disponer del
    MERCADOPAGO_ACCESS_TOKEN.
    """
    if secret is not None:
        return _verify_mercadopago_signature(request, secret)

    return any(
        _verify_mercadopago_signature(request, candidate)
        for candidate in (
            getattr(settings, "MERCADOPAGO_PRO_WEBHOOK_SECRET", None),
            getattr(settings, "MERCADOPAGO_BRICKS_WEBHOOK_SECRET", None),
            getattr(settings, "MERCADOPAGO_WEBHOOK_SECRET", None),
        )
    )


class MercadoPagoGateway(PaymentGateway):
    def __init__(self, variant="pro", token=None):
        if token is None:
            setting_name = (
                'MERCADOPAGO_BRICKS_ACCESS_TOKEN'
                if variant == 'bricks'
                else 'MERCADOPAGO_PRO_ACCESS_TOKEN'
            )
            token = getattr(settings, setting_name, None)
            error_msg = f'{setting_name} no configurado'
        else:
            error_msg = 'MERCADOPAGO_ACCESS_TOKEN no configurado'
        if not token:
            raise ValueError(error_msg)
        self.token = token

        import mercadopago
        self.sdk = mercadopago.SDK(token)

    def create_preference(self, payment_data, user):
        """
        payment_data espera:
          - amount (Decimal/float)
          - currency (str)
          - payment_type (str)
          - external_reference (str)  ← lo genera el caller, no el gateway
          - title (str, opcional)
          - description (str, opcional)
          - metadata (dict, opcional)
        """
        external_ref = payment_data['external_reference']
        return_ref = quote(external_ref, safe='')

        payer = {
            "email": user.email,
            "name": user.first_name or user.username,
        }
        identification_number = getattr(user, "dni", None)
        if identification_number:
            payer["identification"] = {
                "type": "DNI",
                "number": str(identification_number),
            }

        preference = {
            "items": [{
                "title": payment_data.get('title') or settings.PLATFORM_NAME,
                "description": (
                    payment_data.get('description') or "Zona Premium"
                ),
                "quantity": 1,
                "unit_price": float(payment_data['amount']),
                "currency_id": payment_data.get('currency', 'PEN'),
            }],
            "payer": payer,
            "back_urls": {
                "success": (
                    f"{settings.FRONTEND_URL}/payment/success"
                    f"?external_reference={return_ref}"
                ),
                "failure": (
                    f"{settings.FRONTEND_URL}/payment/failure"
                    f"?external_reference={return_ref}"
                ),
                "pending": (
                    f"{settings.FRONTEND_URL}/payment/pending"
                    f"?external_reference={return_ref}"
                ),
            },
            "auto_return": "approved",
            "external_reference": external_ref,
            "notification_url": f"{settings.BACKEND_URL}/api/payments/webhook/mercadopago/",
            "statement_descriptor": "MARKETPLACE STARTER",
            "metadata": payment_data.get('metadata', {}),
        }

        result = self.sdk.preference().create(preference)
        response = result["response"]

        return {
            "init_point": response["init_point"],
            "sandbox_init_point": response.get("sandbox_init_point", ""),
            "preference_id": response["id"],
            "external_reference": external_ref,
            "gateway": "mercadopago",
        }

    def create_order(self, order_data, user):
        """Crea una orden online de Checkout Pro vía ``/v1/orders``."""
        from mercadopago.config import RequestOptions

        amount = str(order_data['amount'])
        payer = {"email": order_data['payer_email']}
        if order_data.get('payer_first_name'):
            payer['first_name'] = order_data['payer_first_name']
        if order_data.get('payer_last_name'):
            payer['last_name'] = order_data['payer_last_name']
        if order_data.get('payer_identification'):
            payer['identification'] = order_data['payer_identification']

        order = {
            "type": "online",
            "processing_mode": "manual",
            "capture_mode": "automatic_async",
            "total_amount": amount,
            "external_reference": order_data['external_reference'],
            "payer": payer,
            "items": [{
                "title": order_data['title'],
                "description": order_data.get('description', ''),
                "category_id": order_data.get('category_id', 'services'),
                "quantity": 1,
                "unit_price": amount,
            }],
            "config": {
                "online": {
                    "success_url": order_data['back_urls']['success'],
                    "failure_url": order_data['back_urls']['failure'],
                    "pending_url": order_data['back_urls']['pending'],
                },
                "statement_descriptor": order_data.get(
                    'statement_descriptor',
                    getattr(settings, 'PLATFORM_NAME', 'MARKETPLACE STARTER'),
                ),
            },
        }
        request_options = RequestOptions(custom_headers={
            'x-idempotency-key': order_data['external_reference'],
        })
        result = self.sdk.order().create(order, request_options)
        if result.get('status') not in (200, 201):
            raise ValueError(
                f"MP respondió HTTP {result.get('status')}: "
                f"{result.get('response')}"
            )

        response = result['response']
        return {
            'checkout_url': response['checkout_url'],
            'order_id': response['id'],
            'external_reference': order_data['external_reference'],
            'gateway': 'mercadopago',
        }

    def get_payment_status(self, gateway_payment_id):
        response = self.sdk.payment().get(gateway_payment_id)
        if response.get('status') != 200:
            return None
        return response['response']

    def get_merchant_order(self, merchant_order_id):
        """
        Consulta un merchant_order en MP.

        Necesario para procesar notificaciones legacy
        (topic=merchant_order), donde el id que llega es de la
        orden, no del payment.
        """
        response = self.sdk.merchant_order().get(merchant_order_id)
        if response.get('status') != 200:
            return None
        return response['response']

    def get_order(self, order_id):
        """Consulta una Order para resolver sus pagos desde el webhook."""
        response = self.sdk.order().get(order_id)
        if response.get('status') != 200:
            return None
        return response['response']

    def create_payment(self, payment_data):
        """
        Crea un pago vía Checkout API.

        payment_data espera:
          - token: string (generado por el Brick)
          - payment_method_id: string (ej. "visa")
          - issuer_id: string | None
          - installments: int
          - transaction_amount: float
          - description: str
          - external_reference: str
          - payer: dict { email, identification: { type, number } }
          - metadata: dict

        Devuelve la respuesta de MP o None si falla.
        """
        from mercadopago.config import RequestOptions

        external_reference = payment_data.get("external_reference")
        request_options = RequestOptions(
            custom_headers={
                "x-idempotency-key": external_reference,
            }
        ) if external_reference else None

        response = self.sdk.payment().create(
            payment_data,
            request_options,
        )
        if response.get('status') not in (200, 201):
            error_body = response.get('response') or {}
            causes = error_body.get('cause') or error_body.get('causes') or []
            if isinstance(causes, list):
                causes = [
                    {
                        key: cause.get(key)
                        for key in ('code', 'description', 'data')
                        if cause.get(key) is not None
                    }
                    for cause in causes
                    if isinstance(cause, dict)
                ]
            else:
                causes = []

            detail = {
                key: error_body.get(key)
                for key in ('message', 'error', 'status_detail')
                if error_body.get(key) is not None
            }
            if causes:
                detail['causes'] = causes

            raise ValueError(
                f"Mercado Pago respondió HTTP {response.get('status')}: "
                f"{detail or 'respuesta de error sin detalle'}"
            )
        return response['response']

    def verify_webhook_signature(self, request) -> bool:
        return verify_mercadopago_signature(request)
