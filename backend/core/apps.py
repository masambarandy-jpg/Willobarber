import logging
import os

from django.apps import AppConfig

logger = logging.getLogger(__name__)


class CoreConfig(AppConfig):
    name = 'core'

    def ready(self):
        from . import signals  # noqa: F401

        # Configuration email vérifiée au démarrage : un expéditeur non vérifié
        # dans SendGrid ou une clé absente = aucun email, sans autre symptôme.
        if not os.environ.get('SENDGRID_API_KEY'):
            logger.warning("SENDGRID_API_KEY absent : aucun email (confirmations RDV, factures) ne sera envoyé.")
        if not os.environ.get('SENDGRID_FROM_EMAIL'):
            from django.conf import settings
            logger.warning(
                "SENDGRID_FROM_EMAIL non défini : expéditeur par défaut %s utilisé. "
                "Il doit être vérifié dans SendGrid (Sender Authentication), sinon les envois échouent (403).",
                settings.SENDGRID_FROM_EMAIL,
            )
