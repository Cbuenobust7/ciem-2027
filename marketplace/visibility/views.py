import logging

from django.conf import settings
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from creatorhub_core.payments_core.models import Payment

from .models import City, VisibilityPurchase
from .serializers import (
    CityAvailabilitySerializer,
    CitySerializer,
    FeaturedSellerSerializer,
    VisibilityPurchaseSerializer,
)
from .services import _build_slots, claim_free_slot, create_paid_purchase

logger = logging.getLogger(__name__)


class CityListView(generics.ListAPIView):
    queryset = City.objects.filter(is_active=True)
    serializer_class = CitySerializer
    permission_classes = [AllowAny]


class CityAvailabilityView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, slug):
        city = get_object_or_404(City, slug=slug, is_active=True)

        data = {
            "city": city,
            "slots": _build_slots(city),
        }

        serializer = CityAvailabilitySerializer(data)
        return Response(serializer.data)


class ClaimFreeSlotView(APIView):
    """
    POST /api/visibility/cities/<slug>/claim/
    Body: { "position": 3 }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, slug):
        city = get_object_or_404(City, slug=slug, is_active=True)

        position = request.data.get("position")
        if position is None:
            return Response(
                {"error": "Falta el campo 'position'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            position = int(position)
        except (TypeError, ValueError):
            return Response(
                {"error": "'position' debe ser un número."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            purchase = claim_free_slot(request.user, city, position)
        except ValueError as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_409_CONFLICT,
            )

        serializer = VisibilityPurchaseSerializer(purchase)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class BuySlotView(APIView):
    """
    POST /api/visibility/cities/<slug>/buy/
    Body: { "position": 3 }

    Crea una VisibilityPurchase PENDING y una preferencia de MP.
    El pago se completa vía webhook, que emite payment_completed.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, slug):
        city = get_object_or_404(City, slug=slug, is_active=True)

        position = request.data.get("position")
        if position is None:
            return Response(
                {"error": "Falta el campo 'position'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            position = int(position)
        except (TypeError, ValueError):
            return Response(
                {"error": "'position' debe ser un número."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 1. Crear la compra PENDING
        try:
            purchase = create_paid_purchase(request.user, city, position)
        except ValueError as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_409_CONFLICT,
            )

        # 2. Crear Order en MP vía payments_core
        from creatorhub_core.payments_core.views import get_gateway

        external_ref = f"visibility_{purchase.id}_{request.user.id}"

        # Payment PENDING en payments_core
        payment = Payment.objects.create(
            payer=request.user,
            amount=purchase.price,
            currency=purchase.currency,
            payment_type='visibility',
            status=Payment.Status.PENDING,
            gateway='mercadopago',
            external_reference=external_ref,
            metadata={
                'purchase_id': purchase.id,
                'city_id': city.id,
                'position': position,
            },
        )

        # Asociar el Payment a la purchase ANTES de llamar al gateway.
        # Si el gateway falla, la purchase ya tiene trazabilidad del pago.
        purchase.payment = payment
        purchase.save(update_fields=['payment', 'updated_at'])

        # 3. Llamar a MP
        gateway = get_gateway("mercadopago")
        try:
            result = gateway.create_order(
                order_data={
                    'amount': purchase.price,
                    'payment_type': 'visibility',
                    'external_reference': external_ref,
                    'title': f'Zona Premium {city.name}',
                    'description': f'Posición #{position}',
                    'category_id': 'services',
                    'statement_descriptor': 'MARKETPLACE STARTER',
                    'payer_email': request.user.email,
                    'payer_first_name': request.user.first_name,
                    'payer_last_name': request.user.last_name,
                    'payer_identification': (
                        {
                            'type': 'DNI',
                            'number': str(request.user.dni),
                        }
                        if getattr(request.user, 'dni', None)
                        else None
                    ),
                    'payer_registration_date': (
                        request.user.date_joined.isoformat()
                        if request.user.date_joined
                        else None
                    ),
                    'back_urls': {
                        'success': f'{settings.FRONTEND_URL}/payment/success?external_reference={external_ref}',
                        'failure': f'{settings.FRONTEND_URL}/payment/failure?external_reference={external_ref}',
                        'pending': f'{settings.FRONTEND_URL}/payment/pending?external_reference={external_ref}',
                    },
                },
                user=request.user,
            )
        except Exception as e:
            logger.exception("Error creando Order MP")
            payment.status = Payment.Status.FAILED
            payment.save(update_fields=['status', 'updated_at'])
            purchase.status = VisibilityPurchase.Status.CANCELLED
            purchase.save(update_fields=['status', 'updated_at'])
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 4. Asociar el order_id a la compra
        purchase.mp_order_id = result['order_id']
        purchase.save(update_fields=['mp_order_id', 'updated_at'])

        return Response({
            **VisibilityPurchaseSerializer(purchase).data,
            'checkout_url': result['checkout_url'],
            'order_id': result['order_id'],
        }, status=status.HTTP_201_CREATED)


class MyVisibilityPurchasesView(generics.ListAPIView):
    """GET /api/visibility/me/"""
    permission_classes = [IsAuthenticated]
    serializer_class = VisibilityPurchaseSerializer

    def get_queryset(self):
        return (
            VisibilityPurchase.objects
            .filter(seller=self.request.user)
            .select_related("city", "payment")
        )


class ProcessSlotPaymentView(APIView):
    """
    POST /api/visibility/cities/<slug>/process/

    Body: {
      "position": 1,
      "token": "...",
      "payment_method_id": "visa",
      "issuer_id": null,
      "installments": 1,
      "identification_number": "12345678"
    }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, slug):
        city = get_object_or_404(City, slug=slug, is_active=True)

        position = request.data.get("position")
        token = request.data.get("token")
        payment_method_id = request.data.get("payment_method_id")
        issuer_id = request.data.get("issuer_id")
        installments = request.data.get("installments", 1)
        identification_number = request.data.get("identification_number", "")

        if not all([position, token, payment_method_id]):
            return Response(
                {"error": "Faltan campos requeridos"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            position = int(position)
            installments = int(installments)
        except (TypeError, ValueError):
            return Response(
                {"error": "position e installments deben ser numéricos"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            purchase = create_paid_purchase(request.user, city, position)
        except ValueError as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_409_CONFLICT,
            )

        external_ref = f"visibility_{purchase.id}_{request.user.id}"

        payment = Payment.objects.create(
            payer=request.user,
            amount=purchase.price,
            currency=purchase.currency,
            payment_type="visibility",
            status=Payment.Status.PENDING,
            gateway="mercadopago",
            external_reference=external_ref,
            metadata={
                "purchase_id": purchase.id,
                "city_id": city.id,
                "position": position,
            },
        )
        purchase.payment = payment
        purchase.save(update_fields=["payment", "updated_at"])

        from creatorhub_core.payments_core.views import get_gateway

        gateway = get_gateway("mercadopago_bricks")

        try:
            mp_response = gateway.create_payment({
                "token": token,
                "payment_method_id": payment_method_id,
                "issuer_id": issuer_id,
                "installments": installments,
                "transaction_amount": float(purchase.price),
                "description": (
                    f"Zona Premium {city.name} — Posición #{position}"
                ),
                "external_reference": external_ref,
                "payer": {
                    "email": request.user.email,
                    "identification": {
                        "type": "DNI",
                        "number": identification_number,
                    },
                },
                "metadata": payment.metadata,
            })
        except Exception as exc:
            logger.exception("Error MP create_payment")
            payment.status = Payment.Status.FAILED
            payment.save(update_fields=["status", "updated_at"])
            purchase.status = VisibilityPurchase.Status.CANCELLED
            purchase.save(update_fields=["status", "updated_at"])
            return Response(
                {"error": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not mp_response:
            payment.status = Payment.Status.FAILED
            payment.save(update_fields=["status", "updated_at"])
            purchase.status = VisibilityPurchase.Status.CANCELLED
            purchase.save(update_fields=["status", "updated_at"])
            return Response(
                {"error": "MP no devolvió respuesta válida"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        mp_status = mp_response.get("status")
        mp_id = mp_response.get("id")

        payment.gateway_payment_id = str(mp_id) if mp_id else None
        payment.raw_gateway_response = mp_response

        status_map = {
            "approved": Payment.Status.COMPLETED,
            "pending": Payment.Status.PENDING,
            "in_process": Payment.Status.PENDING,
            "rejected": Payment.Status.FAILED,
            "cancelled": Payment.Status.FAILED,
        }

        payment.status = status_map.get(mp_status, Payment.Status.PENDING)
        payment.save()

        if payment.status == Payment.Status.COMPLETED:
            from marketplace.visibility.services import (
                activate_purchase_from_payment,
            )
            activate_purchase_from_payment(payment)

        return Response({
            "payment_id": payment.id,
            "status": payment.status,
            "mp_status": mp_status,
            "status_detail": mp_response.get("status_detail"),
            "purchase_id": purchase.id,
            "purchase_status": purchase.status,
        }, status=status.HTTP_201_CREATED)


class FeaturedSellersView(generics.ListAPIView):
    """
    GET /api/visibility/featured/

    Devuelve vendedores con visibilidad premium activa.

    Una entrada por VisibilityPurchase activa.
    Un vendedor puede aparecer una vez por cada ciudad.

    No devuelve listings: todavía no está definida la relación
    entre una VisibilityPurchase y un listing específico.
    """

    permission_classes = [AllowAny]
    serializer_class = FeaturedSellerSerializer

    def get_queryset(self):
        now = timezone.now()

        return (
            VisibilityPurchase.objects
            .select_related("seller", "city")
            .filter(
                status=VisibilityPurchase.Status.PAID,
                starts_at__lte=now,
                ends_at__gt=now,
            )
            .annotate(
                _listing_count=Count(
                    "seller__listings",
                    filter=Q(
                        seller__listings__status="active",
                    )
                )
            )
            .order_by(
                "city__name",
                "position",
                "starts_at",
            )
        )
