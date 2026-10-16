"""Après paiement d'une commande boutique : facture PDF, email, notifications.

Même chaîne que les RDV payés en ligne (cf. core.views.send_online_payment_invoice) :
PDF reportlab → email SendGrid avec PDF joint → notification client
« boutique_invoice » avec lien signé. Côté coiffeur : notification
« boutique_order » + événement SSE new_boutique_order.
"""
import io
import logging
from xml.sax.saxutils import escape

from django.core import signing
from django.db import connection, transaction
from django.urls import reverse
from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import HRFlowable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from core import sse
from core.emails import format_date_fr_short
from core.models import Notification
from core.recommendations import SALON_TZ, create_client_notification
from core.serializers import NotificationSerializer
from core.views import PayeStamp, fmt_eur, send_invoice_email
from .models import Order

logger = logging.getLogger(__name__)

TVA_RATE = 0.21
INVOICE_LINK_SALT = 'boutique-invoice-download'
INVOICE_LINK_MAX_AGE = 60 * 60 * 24 * 365


def boutique_invoice_number(order):
    return f"WB-BTQ-{order.created_at.year}-{order.id:05d}"


def boutique_invoice_url(order, site_root):
    # Ouvert hors de l'app (navigateur) : pas de JWT, l'accès est porté par la signature.
    token = signing.dumps(order.id, salt=INVOICE_LINK_SALT)
    return site_root.rstrip('/') + reverse('boutique-invoice-download', args=[token])


def order_from_invoice_token(token):
    """L'Order du lien signé, ou None si la signature est invalide/expirée."""
    try:
        order_id = signing.loads(token, salt=INVOICE_LINK_SALT, max_age=INVOICE_LINK_MAX_AGE)
        return Order.objects.select_related('user').prefetch_related('items__product').get(pk=order_id)
    except (signing.BadSignature, Order.DoesNotExist):
        return None


def client_name(user):
    return f"{user.first_name} {user.last_name}".strip() or user.username


def order_payload(order, site_root):
    """Payload de l'événement SSE new_boutique_order et de Notification.data."""
    return {
        'type': 'new_boutique_order',
        'order_id': order.id,
        'numero': order.numero,
        'client_name': client_name(order.user),
        'client_phone': order.user.phone or '',
        'items': [
            {'name': item.product.nom, 'qty': item.quantite, 'price': float(item.prix_unitaire)}
            for item in order.items.all()
        ],
        'total': float(order.total),
        'delivery_type': order.delivery_type,
        'delivery_address': order.delivery_address,
        'status': order.status,
        'invoice_url': boutique_invoice_url(order, site_root),
        'created_at': order.created_at.isoformat().replace('+00:00', 'Z'),
    }


def notify_coiffeur_new_order(order, site_root):
    """Notification coiffeur + SSE, publiée après le commit de la commande pour
    que le coiffeur qui recharge le dashboard y trouve bien la commande."""
    payload = order_payload(order, site_root)
    nb_articles = sum(item['qty'] for item in payload['items'])
    notification = Notification.objects.create(
        type='boutique_order',
        title='Nouvelle commande boutique',
        desc=f"{payload['client_name']} · {nb_articles} article{'s' if nb_articles > 1 else ''} · {fmt_eur(order.total)}",
        data=payload,
    )
    event = {**payload, 'notification': NotificationSerializer(notification).data}

    def publish():
        try:
            sse.publish('new_boutique_order', event)
        except Exception:
            logger.exception("SSE new_boutique_order non publié (commande %s)", order.numero)

    transaction.on_commit(publish)


def build_boutique_invoice_pdf(order):
    """Facture d'une commande boutique, intégralement réglée en ligne (Stripe)."""
    user = order.user
    invoice_number = boutique_invoice_number(order)
    issued = format_date_fr_short(timezone.localtime(order.paid_at or order.created_at, SALON_TZ).date())

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4,
        rightMargin=20*mm, leftMargin=20*mm,
        topMargin=20*mm, bottomMargin=20*mm)

    gold = colors.HexColor('#C9A84C')
    dark = colors.HexColor('#1A1814')
    cream = colors.HexColor('#F5F0E8')
    green = colors.HexColor('#2D6A4F')
    grey = colors.HexColor('#888888')

    styles = getSampleStyleSheet()
    elements = []

    # Header
    header_data = [[
        Paragraph('<b>w willobarber</b><br/><font size=8 color=grey>SALON DE BARBIER · BERCHEM</font>', styles['Normal']),
        [
            Paragraph('<font size=26><i>Facture.</i></font>', ParagraphStyle('h', alignment=TA_RIGHT, leading=32, spaceAfter=8)),
            Paragraph(
                f'<font color=grey>N° {invoice_number}<br/>Commande {escape(order.numero)}<br/>Émise le {issued}</font>',
                ParagraphStyle('hmeta', alignment=TA_RIGHT, fontSize=10, leading=15),
            ),
        ],
    ]]
    header_table = Table(header_data, colWidths=[90*mm, 90*mm])
    header_table.setStyle(TableStyle([('VALIGN', (0,0), (-1,-1), 'TOP')]))
    elements.append(header_table)
    elements.append(HRFlowable(width="100%", thickness=1, color=dark))
    elements.append(Spacer(1, 10*mm))

    # Parties
    if order.delivery_type == 'domicile':
        address = escape(order.delivery_address).replace('\n', '<br/>')
        delivery_block = f'<br/><br/><font size=9 color=grey>LIVRAISON À DOMICILE</font><br/>{address}'
    else:
        delivery_block = '<br/><br/><font size=9 color=grey>RETRAIT AU SALON</font><br/>78 rue Auguste van Zande'
    phone = f'<br/>{escape(user.phone)}' if user.phone else ''
    parties_data = [[
        Paragraph('<font size=9 color=grey>ÉMETTEUR</font><br/><b>WilloBarber SRL</b><br/>78 rue Auguste van Zande<br/>1082 Bruxelles · Belgique<br/>contact@willobarber.be<br/>+32 2 555 04 04<br/><font size=9 color=grey>TVA BE 0789.123.456</font>', styles['Normal']),
        [
            Paragraph(
                f'<font size=9 color=grey>FACTURÉ À</font><br/><b>{escape(client_name(user))}</b><br/>{escape(user.email or "")}{phone}{delivery_block}',
                ParagraphStyle('right', alignment=TA_RIGHT),
            ),
            PayeStamp(label='PAYÉ'),
        ]
    ]]
    parties_table = Table(parties_data, colWidths=[90*mm, 90*mm])
    parties_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('ALIGN', (1,0), (1,0), 'RIGHT'),
    ]))
    elements.append(parties_table)
    elements.append(Spacer(1, 10*mm))

    # Tableau produits (prix boutique TTC, TVA 21 % incluse)
    data = [['PRODUIT', 'QTÉ', 'P.U. TTC', 'TVA', 'TOTAL TTC']]
    for item in order.items.all():
        unit = float(item.prix_unitaire)
        label = item.product.nom + (f' · {item.product.contenance}' if item.product.contenance else '')
        data.append([label, str(item.quantite), fmt_eur(unit), '21%', fmt_eur(unit * item.quantite)])
    t = Table(data, colWidths=[80*mm, 20*mm, 30*mm, 20*mm, 30*mm], repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), dark),
        ('TEXTCOLOR', (0,0), (-1,0), gold),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,-1), 10),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [cream, colors.white]),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#dddddd')),
        ('ALIGN', (1,1), (-1,-1), 'RIGHT'),
        ('PADDING', (0,0), (-1,-1), 8),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 8*mm))

    # Récap
    total_ttc = float(order.total)
    sous_total = float(order.subtotal)
    delivery_fee = float(order.delivery_fee)
    total_ht = total_ttc / (1 + TVA_RATE)
    recap_data = [
        ['Sous-total produits', fmt_eur(sous_total)],
        ['Livraison à domicile' if order.delivery_type == 'domicile' else 'Retrait au salon',
         fmt_eur(delivery_fee) if delivery_fee else 'Offert'],
        ['Total HT', fmt_eur(total_ht)],
        ['TVA 21% (incluse)', fmt_eur(total_ttc - total_ht)],
        ['Total TTC', fmt_eur(total_ttc)],
    ]
    recap_table = Table(recap_data, colWidths=[80*mm, 40*mm], hAlign='RIGHT')
    recap_table.setStyle(TableStyle([
        ('FONTSIZE', (0,0), (-1,-1), 10),
        ('TEXTCOLOR', (0,2), (-1,3), grey),
        ('FONTNAME', (0,4), (-1,4), 'Helvetica-Bold'),
        ('LINEABOVE', (0,4), (-1,4), 1, dark),
        ('ALIGN', (1,0), (1,-1), 'RIGHT'),
        ('PADDING', (0,0), (-1,-1), 6),
    ]))
    elements.append(recap_table)
    elements.append(Spacer(1, 6*mm))

    # Bloc PAYÉ VIA STRIPE
    regle_table = Table([['PAYÉ VIA STRIPE · Carte bancaire', fmt_eur(total_ttc)]], colWidths=[120*mm, 40*mm], hAlign='RIGHT')
    regle_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), dark),
        ('TEXTCOLOR', (0,0), (0,0), colors.white),
        ('TEXTCOLOR', (1,0), (1,0), gold),
        ('FONTNAME', (0,0), (-1,-1), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,-1), 11),
        ('ALIGN', (1,0), (1,0), 'RIGHT'),
        ('PADDING', (0,0), (-1,-1), 10),
        ('ROUNDEDCORNERS', [6, 6, 6, 6]),
    ]))
    elements.append(regle_table)
    elements.append(Spacer(1, 6*mm))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=grey))
    elements.append(Spacer(1, 4*mm))
    elements.append(Paragraph(
        f"Commande intégralement réglée en ligne via Stripe ({fmt_eur(total_ttc)}). "
        "Prix TTC, TVA belge de 21 % incluse. Aucun montant ne reste dû.",
        ParagraphStyle('note', fontSize=9, textColor=grey),
    ))
    elements.append(Spacer(1, 10*mm))

    # Bas de page : coordonnées du salon
    elements.append(Paragraph(
        "<b>WilloBarber SRL</b> · 78 rue Auguste van Zande, 1082 Bruxelles · "
        "+32 2 555 04 04 · contact@willobarber.be · TVA BE 0789.123.456",
        ParagraphStyle('footer', fontSize=8, textColor=grey, alignment=TA_CENTER),
    ))
    elements.append(Paragraph(
        "Merci pour votre commande.",
        ParagraphStyle('thanks', fontSize=10, textColor=green, alignment=TA_CENTER, spaceBefore=6),
    ))

    doc.build(elements)
    buffer.seek(0)
    return buffer.read(), invoice_number


def send_boutique_invoice(order_id, site_root):
    """PDF → email au client → notification « boutique_invoice » (SSE client).
    Tourne dans un thread après le commit de la commande, pour ne pas rallonger
    la réponse de POST /boutique/commandes/."""
    try:
        order = Order.objects.select_related('user').prefetch_related('items__product').get(pk=order_id)
        if order.invoice_sent_at:
            return

        pdf_bytes, invoice_number = build_boutique_invoice_pdf(order)
        invoice_url = boutique_invoice_url(order, site_root)
        first_name = order.user.first_name or order.user.username

        try:
            send_invoice_email(
                order.user,
                subject=f'📦 Votre facture WilloBarber — commande {order.numero}',
                heading=f"Merci pour votre commande {first_name} ✂️",
                body=(
                    f"Votre paiement de {fmt_eur(order.total)} est confirmé. "
                    "Vous trouverez votre facture en pièce jointe."
                ),
                pdf_bytes=pdf_bytes,
                filename=f'Facture_WilloBarber_{invoice_number}.pdf',
            )
            Order.objects.filter(pk=order.pk).update(invoice_sent_at=timezone.now())
            print(f"[FACTURE BOUTIQUE] {invoice_number} envoyée à {order.user.email}")
        except Exception as e:
            print(f"[EMAIL ERROR] Facture boutique {invoice_number}: {str(e)}")

        nb_articles = sum(item.quantite for item in order.items.all())
        create_client_notification(
            order.user, 'boutique_invoice',
            title='📦 Votre facture est prête',
            desc=f"Commande {order.numero} · {nb_articles} article{'s' if nb_articles > 1 else ''} · {fmt_eur(order.total)}",
            data={
                'order_id': order.id,
                'order_numero': order.numero,
                'invoice_number': invoice_number,
                'invoice_url': invoice_url,
                'amount_paid': float(order.total),
            },
        )
    except Exception as e:
        import traceback
        print(f"[FACTURE BOUTIQUE ERROR] commande {order_id}: {str(e)}")
        print(traceback.format_exc())
    finally:
        connection.close()
