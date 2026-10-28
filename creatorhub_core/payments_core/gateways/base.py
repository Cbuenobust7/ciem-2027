from abc import ABC, abstractmethod


class PaymentGateway(ABC):
    """Interfaz común para gateways de pago."""

    @abstractmethod
    def create_preference(self, payment_data, user):
        """Crea una preferencia de pago en el gateway."""
        raise NotImplementedError

    @abstractmethod
    def get_payment_status(self, gateway_payment_id):
        """Obtiene el estado actual de un pago."""
        raise NotImplementedError

    @abstractmethod
    def verify_webhook_signature(self, request) -> bool:
        """
        Valida que la notificación de webhook realmente proviene del
        gateway (no un POST falsificado). Debe devolver False —nunca
        lanzar una excepción no controlada— ante cualquier firma
        ausente, mal formada o inválida.
        """
        raise NotImplementedError
