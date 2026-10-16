import logging
import threading
from datetime import datetime, timedelta
from html import escape

import sendgrid
from django.conf import settings
from django.db import connection, transaction
from django.utils import timezone
from sendgrid.helpers.mail import Content, Email, Mail, To

logger = logging.getLogger(__name__)

JOURS_FR = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
MOIS_FR = [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
]


def format_date_fr(date):
    """Ex: "Jeudi 30 juillet 2026\""""
    return f"{JOURS_FR[date.weekday()]} {date.day} {MOIS_FR[date.month - 1]} {date.year}"


def format_date_fr_short(date):
    """Ex: "29 juillet 2026\" (sans le jour de la semaine)"""
    return f"{date.day} {MOIS_FR[date.month - 1]} {date.year}"


def format_heure_fr(time):
    """Ex: "10h30\""""
    return f"{time.hour}h{str(time.minute).zfill(2)}"


# ─── Emails de rendez-vous (confirmation, reprogrammation, annulation) ──────────
# Même chaîne que la facture boutique : SendGrid, envoi dans un thread après le
# commit de la réservation, échec journalisé sans jamais bloquer la résa.


SALON_ADDRESS = 'Rue Auguste Van Zande 78, 1082 Bruxelles'
SALON_PHONE = '+32 2 555 04 04'
SALON_EMAIL = 'contact@willobarber.be'
CANCELLATION_DELAY = timedelta(hours=24)



def is_secondary_child(reservation):
    """Réservations « enfants » : book.tsx crée une résa par enfant ; seule la
    1re porte le paiement et child_count. Les suivantes (sans PaymentIntent,
    amount_paid=0 explicite) ne déclenchent pas d'email en double."""
    return (
        not reservation.payment_intent_id
        and reservation.amount_paid is not None
        and float(reservation.amount_paid) == 0
        and (reservation.child_count or 1) == 1
    )

CREAM = '#FAF7F1'
GOLD = '#C9A84C'
GOLD_DARK = '#8B6914'
INK = '#1A1208'
MUTED = '#8A847C'
SERIF = "Georgia, 'Times New Roman', serif"
SANS = "-apple-system, 'Helvetica Neue', Arial, sans-serif"


def _eur(amount):
    amount = float(amount)
    return f"{amount:.0f} €" if amount == int(amount) else f"{amount:.2f} €".replace('.', ',')


def reservation_start(reservation):
    """Début du RDV, en heure du salon (date/heure naïves = heure de Bruxelles)."""
    from .recommendations import SALON_TZ
    return datetime.combine(reservation.date, reservation.time, tzinfo=SALON_TZ)


def is_late_cancellation(reservation, now=None):
    return reservation_start(reservation) - (now or timezone.now()) < CANCELLATION_DELAY


def _payment(reservation):
    """(total, payé en ligne) — le paiement n'est porté que par la 1re résa d'un groupe."""
    total = float(reservation.service.price) * (reservation.child_count or 1)
    paid = float(reservation.amount_paid or 0) if reservation.payment_intent_id else 0.0
    return total, paid


def _payment_sentence(reservation):
    total, paid = _payment(reservation)
    if paid >= total > 0:
        return f"Votre prestation a été intégralement réglée en ligne via Stripe ({_eur(paid)}). Aucun solde à régler au salon."
    if paid > 0:
        return (f"Un acompte de {_eur(paid)} a été payé via Stripe. "
                f"Le solde de {_eur(total - paid)} est à régler au salon.")
    return f"Le règlement de {_eur(total)} se fait au salon."


def _refund_sentence(reservation, late, by_salon):
    _, paid = _payment(reservation)
    if paid <= 0:
        return "Aucun paiement n'avait été effectué : vous n'avez rien à régler."
    if by_salon or not late:
        return (f"Votre acompte de {_eur(paid)} vous sera intégralement remboursé sur votre carte "
                "(délai bancaire de 5 à 10 jours ouvrés).")
    return (f"Annulation à moins de 24h du rendez-vous : conformément à nos conditions, "
            f"l'acompte de {_eur(paid)} est conservé.")


def _row(label, value, strike=False):
    style = f"text-decoration:line-through;color:{MUTED};" if strike else f"color:{INK};font-weight:bold;"
    return (
        f'<tr><td style="padding:9px 0;color:{MUTED};font-family:{SANS};font-size:13px;'
        f'border-bottom:1px solid #EFE8DA;">{label}</td>'
        f'<td align="right" style="padding:9px 0;font-family:{SANS};font-size:14px;'
        f'border-bottom:1px solid #EFE8DA;{style}">{value}</td></tr>'
    )


def render_reservation_email(reservation, kind, app_url, previous=None, late=False):
    """(sujet, html) pour kind = 'confirmed' | 'rescheduled' | 'cancelled'.
    previous : {'date', 'time'} de l'ancien créneau (reprogrammation)."""
    user = reservation.user
    first_name = escape(user.first_name or user.username)
    service = escape(reservation.service.name)
    if (reservation.child_count or 1) > 1:
        service += f" × {reservation.child_count}"
    date_fr = format_date_fr(reservation.date)
    heure_fr = format_heure_fr(reservation.time)
    by_salon = reservation.status == 'cancelled'

    if kind == 'confirmed':
        subject = 'Votre rendez-vous WilloBarber est confirmé 💈'
        kicker, title = 'RÉSERVATION CONFIRMÉE', 'Votre rendez-vous est confirmé.'
        intro = 'Merci pour votre réservation, nous avons hâte de vous accueillir.'
        rows = [_row('Prestation', service), _row('Barbier', escape(reservation.barber)),
                _row('Date', date_fr), _row('Heure', heure_fr), _row('Adresse', SALON_ADDRESS)]
        note = _payment_sentence(reservation)
    elif kind == 'rescheduled':
        subject = 'Votre rendez-vous WilloBarber a été reprogrammé 💈'
        kicker, title = 'RENDEZ-VOUS REPROGRAMMÉ', 'Votre rendez-vous a été déplacé.'
        intro = 'Voici votre nouveau créneau. Votre paiement reste associé à ce rendez-vous.'
        rows = [_row('Prestation', service), _row('Barbier', escape(reservation.barber))]
        if previous:
            rows.append(_row('Ancien créneau', f"{format_date_fr(previous['date'])} · {format_heure_fr(previous['time'])}", strike=True))
        rows += [_row('Nouvelle date', date_fr), _row('Nouvelle heure', heure_fr), _row('Adresse', SALON_ADDRESS)]
        note = _payment_sentence(reservation)
    elif kind == 'cancelled':
        subject = 'Votre rendez-vous WilloBarber a été annulé'
        kicker, title = 'RENDEZ-VOUS ANNULÉ', 'Votre rendez-vous a été annulé.'
        intro = ("Le salon a dû annuler votre rendez-vous. Toutes nos excuses pour ce contretemps."
                 if by_salon else "Nous confirmons l'annulation de votre rendez-vous.")
        rows = [_row('Prestation', service), _row('Date', date_fr, strike=True), _row('Heure', heure_fr, strike=True)]
        note = _refund_sentence(reservation, late, by_salon)
    else:
        raise ValueError(f"Type d'email inconnu : {kind}")

    cta_label = 'Reprendre rendez-vous' if kind == 'cancelled' else 'Voir mon RDV'
    policy = ("Annulation ou modification gratuite jusqu'à 24h avant le rendez-vous. "
              "Passé ce délai, l'acompte est conservé.")

    html = f"""<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{escape(subject)}</title></head>
<body style="margin:0;padding:0;background:{CREAM};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{CREAM};">
<tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
    <tr><td style="padding:0 4px 24px;">
      <span style="font-family:{SERIF};font-size:22px;color:{GOLD};">{{w}}</span>
      <span style="font-family:{SERIF};font-size:20px;color:{INK};font-weight:bold;"> willobarber</span>
      <div style="font-family:{SANS};font-size:10px;letter-spacing:2.5px;color:{MUTED};margin-top:4px;">SALON DE BARBIER · BRUXELLES</div>
    </td></tr>
    <tr><td style="background:#FFFFFF;border-radius:16px;padding:32px 28px;border:1px solid #EFE8DA;">
      <div style="font-family:{SANS};font-size:10px;font-weight:bold;letter-spacing:2.5px;color:{GOLD_DARK};">— {kicker}</div>
      <h1 style="margin:10px 0 0;font-family:{SERIF};font-size:28px;line-height:1.2;color:{INK};font-weight:normal;">{title}</h1>
      <p style="margin:18px 0 0;font-family:{SANS};font-size:15px;color:{INK};">Bonjour {first_name},</p>
      <p style="margin:8px 0 0;font-family:{SANS};font-size:15px;line-height:1.55;color:#4A443C;">{intro}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px;border-top:2px solid {GOLD};">
        {''.join(rows)}
      </table>
      <div style="margin-top:22px;padding:14px 16px;background:{CREAM};border-left:3px solid {GOLD};border-radius:6px;font-family:{SANS};font-size:14px;line-height:1.5;color:{INK};">{note}</div>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:26px;"><tr>
        <td style="background:{GOLD};border-radius:100px;">
          <a href="{escape(app_url)}" style="display:inline-block;padding:14px 30px;font-family:{SANS};font-size:15px;font-weight:bold;color:{INK};text-decoration:none;">{cta_label} →</a>
        </td></tr></table>
      <p style="margin:24px 0 0;font-family:{SANS};font-size:12px;line-height:1.5;color:{MUTED};">{policy}</p>
    </td></tr>
    <tr><td align="center" style="padding:24px 8px 0;font-family:{SANS};font-size:12px;line-height:1.6;color:{MUTED};">
      <span style="font-family:{SERIF};color:{INK};font-weight:bold;">WilloBarber</span><br>
      {SALON_ADDRESS}<br>{SALON_PHONE} · <a href="mailto:{SALON_EMAIL}" style="color:{GOLD_DARK};">{SALON_EMAIL}</a>
    </td></tr>
  </table>
</td></tr></table>
</body></html>"""
    return subject, html


def send_html_email(to_email, subject, html):
    """Envoi SendGrid. Lève une exception si SendGrid refuse (clé absente,
    expéditeur non vérifié → 403, etc.)."""
    api_key = getattr(settings, 'SENDGRID_API_KEY', None)
    if not api_key:
        raise RuntimeError('SENDGRID_API_KEY absent')
    message = Mail(
        from_email=Email(settings.SENDGRID_FROM_EMAIL, settings.SENDGRID_FROM_NAME),
        to_emails=To(to_email),
        subject=subject,
        html_content=Content('text/html', html),
    )
    return sendgrid.SendGridAPIClient(api_key=api_key).send(message)


def send_reservation_email(reservation_id, kind, app_url, previous=None, late=False):
    """Cible du thread : relit la résa, rend le template, envoie. Ne lève jamais."""
    from .models import Reservation
    try:
        reservation = Reservation.objects.select_related('user', 'service').get(pk=reservation_id)
        if is_secondary_child(reservation):
            return
        if not reservation.user.email:
            logger.warning("Email RDV %s non envoyé : client %s sans adresse email", kind, reservation.user_id)
            return
        subject, html = render_reservation_email(reservation, kind, app_url, previous=previous, late=late)
        response = send_html_email(reservation.user.email, subject, html)
        logger.info("Email RDV %s envoyé (réservation %s) — SendGrid status=%s", kind, reservation_id, response.status_code)
    except Exception:
        # Body SendGrid (ex. « The from address does not match a verified Sender
        # Identity ») inclus dans l'exception HTTPError → visible dans les logs.
        logger.exception("Échec email RDV %s (réservation %s)", kind, reservation_id)
    finally:
        connection.close()


def queue_reservation_email(reservation, kind, app_url, **context):
    """Envoie après le commit, dans un thread : la réponse HTTP n'attend pas SendGrid."""
    transaction.on_commit(lambda: threading.Thread(
        target=send_reservation_email,
        args=(reservation.id, kind, app_url),
        kwargs=context,
        daemon=True,
    ).start())
