from django.core.management.base import BaseCommand

from core.sms import send_reminders_for_tomorrow


class Command(BaseCommand):
    help = "Envoie un rappel SMS à chaque client ayant un RDV demain."

    def handle(self, *args, **options):
        result = send_reminders_for_tomorrow()
        self.stdout.write(self.style.SUCCESS(
            f"Rappels SMS : {result['sent']} envoyés, {result['failed']} échecs, "
            f"{result['skipped']} sans téléphone (sur {result['total']} RDV demain)."
        ))
