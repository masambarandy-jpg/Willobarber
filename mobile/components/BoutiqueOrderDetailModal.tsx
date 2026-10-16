import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BagIcon, DownloadIcon, PhoneIcon } from '@/components/coiffeur/Icons';
import { CC, SERIF } from '@/components/coiffeur/theme';
import { useCoiffeurNotifications } from '@/contexts/CoiffeurNotificationsContext';
import { coiffeurBoutiqueApi } from '@/services/api';
import type {
  BoutiqueDeliveryType,
  BoutiqueOrderNotificationData,
  BoutiqueOrderStatus,
  StaffBoutiqueOrder,
} from '@/types';

export const ORDER_STATUS_LABELS: Record<BoutiqueOrderStatus, string> = {
  pending: 'En attente',
  confirmed: 'Confirmée',
  preparing: 'En préparation',
  ready: 'Prête à retirer',
  shipped: 'Expédiée',
  delivered: 'Livrée',
  picked_up: 'Retirée',
  completed: 'Complétée',
  cancelled: 'Annulée',
};

// Étapes proposées au coiffeur — mêmes valeurs que STAFF_STATUSES côté backend.
const STATUS_STEPS: Record<BoutiqueDeliveryType, BoutiqueOrderStatus[]> = {
  domicile: ['preparing', 'shipped', 'delivered'],
  retrait_salon: ['preparing', 'ready', 'picked_up'],
};

export const ORDER_STATUS_COLORS: Partial<Record<BoutiqueOrderStatus, { bg: string; text: string }>> = {
  preparing: { bg: 'rgba(201,168,76,0.15)', text: CC.goldDark },
  ready: { bg: 'rgba(58,106,138,0.15)', text: '#3a6a8a' },
  shipped: { bg: 'rgba(58,106,138,0.15)', text: '#3a6a8a' },
  delivered: { bg: CC.successBg, text: CC.successText },
  picked_up: { bg: CC.successBg, text: CC.successText },
};

export function fmtEur(n: number | string | undefined): string {
  const v = typeof n === 'string' ? parseFloat(n) : n ?? 0;
  return `${v.toFixed(2).replace('.', ',')} €`;
}

type DisplayOrder = {
  id: number;
  numero?: string;
  clientName?: string;
  clientPhone?: string;
  items: { name: string; qty: number; price: number }[];
  total?: number;
  deliveryType?: BoutiqueDeliveryType;
  deliveryAddress?: string;
  status?: BoutiqueOrderStatus;
  invoiceUrl?: string;
};

function fromNotification(id: number, d?: BoutiqueOrderNotificationData): DisplayOrder {
  return {
    id,
    numero: d?.numero,
    clientName: d?.client_name,
    clientPhone: d?.client_phone,
    items: d?.items ?? [],
    total: d?.total,
    deliveryType: d?.delivery_type,
    deliveryAddress: d?.delivery_address,
    status: d?.status,
    invoiceUrl: d?.invoice_url,
  };
}

function fromApi(o: StaffBoutiqueOrder): DisplayOrder {
  return {
    id: o.id,
    numero: o.numero,
    clientName: o.client_name,
    clientPhone: o.client_phone,
    items: o.items.map((i) => ({ name: i.product.nom, qty: i.quantite, price: parseFloat(i.prix_unitaire) })),
    total: parseFloat(o.total),
    deliveryType: o.delivery_type,
    deliveryAddress: o.delivery_address,
    status: o.status,
    invoiceUrl: o.invoice_url,
  };
}

type Props = {
  // null = modale fermée.
  orderId: number | null;
  // Snapshot de la notification / de la liste : affiché tout de suite, puis
  // remplacé par la commande rechargée (statut à jour).
  initial?: BoutiqueOrderNotificationData | StaffBoutiqueOrder;
  onClose: () => void;
  onUpdated?: (order: StaffBoutiqueOrder) => void;
};

export default function BoutiqueOrderDetailModal({ orderId, initial, onClose, onUpdated }: Props) {
  const { ordersVersion } = useCoiffeurNotifications();
  const [order, setOrder] = useState<DisplayOrder | null>(null);
  const [saving, setSaving] = useState<BoutiqueOrderStatus | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (orderId == null) {
      setOrder(null);
      return;
    }
    if (initial && 'status_label' in initial) setOrder(fromApi(initial));
    else setOrder((prev) => (prev?.id === orderId ? prev : fromNotification(orderId, initial)));
    setError('');

    let cancelled = false;
    coiffeurBoutiqueApi.order(orderId)
      .then((o) => !cancelled && setOrder(fromApi(o)))
      .catch((e) => console.log('ERREUR COMMANDE — GET:', e));
    return () => {
      cancelled = true;
    };
    // ordersVersion : statut modifié depuis un autre écran/appareil.
  }, [orderId, ordersVersion]);

  const changeStatus = async (status: BoutiqueOrderStatus) => {
    if (!order || status === order.status) return;
    setSaving(status);
    setError('');
    try {
      const updated = await coiffeurBoutiqueApi.setStatus(order.id, status);
      setOrder(fromApi(updated));
      onUpdated?.(updated);
    } catch {
      setError("Le statut n'a pas pu être mis à jour.");
    } finally {
      setSaving(null);
    }
  };

  const call = () => {
    if (order?.clientPhone) Linking.openURL(`tel:${order.clientPhone.replace(/\s+/g, '')}`);
  };

  const steps = order?.deliveryType ? STATUS_STEPS[order.deliveryType] : [];
  const statusColor = order?.status ? ORDER_STATUS_COLORS[order.status] : undefined;

  return (
    <Modal visible={orderId != null} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={styles.card} activeOpacity={1} onPress={() => {}} testID="boutique-order-modal">
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>

          {!order ? (
            <ActivityIndicator color={CC.gold} style={{ marginVertical: 40 }} />
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.iconWrap}>
                <BagIcon color={CC.goldDark} size={26} />
              </View>
              <Text style={styles.title}>Commande boutique</Text>
              {!!order.numero && <Text style={styles.numero}>{order.numero}</Text>}
              {order.status && (
                <View style={[styles.statusPill, { backgroundColor: statusColor?.bg ?? CC.grayBg }]}>
                  <Text style={[styles.statusPillText, { color: statusColor?.text ?? CC.grayText }]}>
                    {ORDER_STATUS_LABELS[order.status]}
                  </Text>
                </View>
              )}

              <View style={styles.divider} />

              {/* Client */}
              <View style={styles.clientRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Client</Text>
                  <Text style={styles.value}>{order.clientName || 'Non renseigné'}</Text>
                  <Text style={styles.sub}>{order.clientPhone || 'Téléphone non renseigné'}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.callBtn, !order.clientPhone && { opacity: 0.4 }]}
                  onPress={call}
                  disabled={!order.clientPhone}
                >
                  <PhoneIcon color={CC.black} size={15} />
                  <Text style={styles.callBtnText}>Appeler</Text>
                </TouchableOpacity>
              </View>

              {/* Produits */}
              <Text style={[styles.label, { marginTop: 16 }]}>Produits</Text>
              {order.items.map((item, i) => (
                <View key={`${item.name}-${i}`} style={styles.itemRow}>
                  <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                  <Text style={styles.itemQty}>× {item.qty}</Text>
                  <Text style={styles.itemPrice}>{fmtEur(item.price * item.qty)}</Text>
                </View>
              ))}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total payé</Text>
                <Text style={styles.totalValue}>{fmtEur(order.total)}</Text>
              </View>

              {/* Livraison */}
              <View style={styles.deliveryBox}>
                {order.deliveryType === 'domicile' ? (
                  <>
                    <Text style={styles.deliveryTitle}>📦 Livraison à domicile</Text>
                    <Text style={styles.deliveryText}>{order.deliveryAddress || 'Adresse non renseignée'}</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.deliveryTitle}>🏪 Retrait au salon</Text>
                    <Text style={styles.deliveryText}>Rue Auguste Van Zande 78 · Bruxelles</Text>
                  </>
                )}
              </View>

              {/* Statut */}
              {steps.length > 0 && (
                <>
                  <Text style={[styles.label, { marginTop: 16 }]}>Changer le statut</Text>
                  <View style={styles.stepsRow}>
                    {steps.map((step) => {
                      const active = order.status === step;
                      return (
                        <TouchableOpacity
                          key={step}
                          style={[styles.stepBtn, active && styles.stepBtnActive]}
                          onPress={() => changeStatus(step)}
                          disabled={saving != null}
                          testID={`order-status-${step}`}
                        >
                          {saving === step ? (
                            <ActivityIndicator size="small" color={CC.black} />
                          ) : (
                            <Text style={[styles.stepBtnText, active && styles.stepBtnTextActive]}>
                              {ORDER_STATUS_LABELS[step]}
                            </Text>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}
              {!!error && <Text style={styles.error}>{error}</Text>}

              <View style={styles.divider} />

              <View style={styles.actionsRow}>
                <TouchableOpacity style={styles.btnOutline} onPress={onClose}>
                  <Text style={styles.btnOutlineText}>Fermer</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btnGold, !order.invoiceUrl && { opacity: 0.4 }]}
                  onPress={() => order.invoiceUrl && Linking.openURL(order.invoiceUrl)}
                  disabled={!order.invoiceUrl}
                >
                  <DownloadIcon color={CC.black} size={14} />
                  <Text style={styles.btnGoldText}>Facture PDF</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '90%',
    backgroundColor: CC.white,
    borderRadius: 20,
    padding: 24,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: CC.trackBg,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  closeBtnText: { fontSize: 16, color: CC.black, fontWeight: '600' },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    backgroundColor: 'rgba(201,168,76,0.15)',
  },
  title: { fontFamily: SERIF, fontWeight: '700', fontSize: 20, color: CC.black, textAlign: 'center' },
  numero: { fontSize: 12.5, color: CC.textSecondary, textAlign: 'center', marginTop: 4 },
  statusPill: { alignSelf: 'center', borderRadius: 100, paddingVertical: 5, paddingHorizontal: 12, marginTop: 10 },
  statusPillText: { fontSize: 12, fontWeight: '700' },
  divider: { height: 1, backgroundColor: CC.trackBg, marginVertical: 16 },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: CC.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  value: { fontSize: 15, fontWeight: '700', color: CC.black },
  sub: { fontSize: 13, color: CC.textSecondary, marginTop: 2 },
  clientRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: CC.inputBorder,
    borderRadius: 100,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  callBtnText: { fontSize: 13, fontWeight: '600', color: CC.black },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  itemName: { flex: 1, fontSize: 14, color: CC.black },
  itemQty: { fontSize: 13, color: CC.textSecondary, width: 36, textAlign: 'right' },
  itemPrice: { fontSize: 14, fontWeight: '600', color: CC.black, width: 72, textAlign: 'right' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: CC.trackBg,
    marginTop: 6,
    paddingTop: 10,
  },
  totalLabel: { fontSize: 14, fontWeight: '700', color: CC.black },
  totalValue: { fontFamily: SERIF, fontSize: 20, fontWeight: '700', color: CC.goldDark },
  deliveryBox: { backgroundColor: CC.cream, borderRadius: 12, padding: 12, marginTop: 14 },
  deliveryTitle: { fontSize: 14, fontWeight: '700', color: CC.black },
  deliveryText: { fontSize: 13, color: CC.textSecondary, marginTop: 4, lineHeight: 18 },
  stepsRow: { flexDirection: 'row', gap: 8 },
  stepBtn: {
    flex: 1,
    minHeight: 40,
    borderWidth: 1,
    borderColor: CC.inputBorder,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  stepBtnActive: { backgroundColor: CC.black, borderColor: CC.black },
  stepBtnText: { fontSize: 12, fontWeight: '600', color: CC.black, textAlign: 'center' },
  stepBtnTextActive: { color: CC.white },
  error: { fontSize: 12.5, color: CC.errorText, marginTop: 8 },
  actionsRow: { flexDirection: 'row', gap: 12 },
  btnOutline: {
    flex: 1,
    borderWidth: 1,
    borderColor: CC.border,
    borderRadius: 100,
    paddingVertical: 13,
    alignItems: 'center',
  },
  btnOutlineText: { fontSize: 14, fontWeight: '600', color: CC.black },
  btnGold: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    backgroundColor: CC.gold,
    borderRadius: 100,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGoldText: { fontSize: 14, fontWeight: '700', color: CC.black },
});
