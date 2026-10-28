"""Comando `release_expired_holds` (ADR-06, §9.5).

La expiración normal es perezosa: ocurre dentro de la transacción de creación de
una reserva. Este comando existe para el cron nocturno y para que el panel de
administración no dependa de que llegue una reserva nueva.
"""

from django.core.management.base import BaseCommand

from verticals.cleaning.bookings import services


class Command(BaseCommand):
    help = 'Marca como expiradas las reservas `requested` cuyo bloqueo venció (ADR-06).'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Cuenta las reservas vencidas sin modificar nada.',
        )

    def handle(self, *args, **options):
        if options['dry_run']:
            from django.utils import timezone

            from verticals.cleaning.bookings.models import Booking

            total = Booking.objects.filter(
                status=Booking.Status.REQUESTED,
                hold_expires_at__lt=timezone.now(),
            ).count()
            self.stdout.write(f'{total} reserva(s) vencerían (dry-run, sin cambios).')
            return

        total = services.expire_all_holds()
        self.stdout.write(self.style.SUCCESS(
            f'{total} reserva(s) marcadas como expiradas.',
        ))
