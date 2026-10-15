from django.core.management.base import BaseCommand

from core.recommendations import run_daily_recommendations


class Command(BaseCommand):
    help = "Exécute la tâche quotidienne de recommandations (équivalent de POST /tasks/run-recommendations/)."

    def handle(self, *args, **options):
        self.stdout.write(str(run_daily_recommendations()))
