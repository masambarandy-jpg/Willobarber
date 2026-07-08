import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Path, Circle, Rect, Line } from 'react-native-svg';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/hooks/useAuth';
import { useAuthModal } from '@/contexts/AuthModalContext';
import { Fonts } from '@/constants';

export default function CartScreen() {
  const router = useRouter();
  const { items, removeItem, updateQte, total, nbArticles, isLoading, checkout, lastOrder, clearLastOrder } = useCart();
  const { isAuthenticated } = useAuth();
  const { showLoginModal } = useAuthModal();
  const [checkoutError, setCheckoutError] = useState('');

  const handleCheckout = async () => {
    if (!isAuthenticated) {
      showLoginModal(handleCheckout, 'Connectez-vous pour finaliser votre commande.');
      return;
    }
    setCheckoutError('');
    try {
      await checkout();
    } catch {
      setCheckoutError('Une erreur est survenue. Veuillez réessayer.');
    }
  };

  // ── Confirmation screen ──────────────────────────────────────────────────────
  if (lastOrder) {
    return (
      <View style={styles.root}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => { clearLastOrder(); router.push('/(tabs)' as any); }} style={styles.backBtn}>
            <Text style={styles.backText}>← Retour</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerLogoMark}>{'{w}'}</Text>
            <Text style={styles.headerLogoBrand}>willobarber</Text>
          </View>
          <View style={{ width: 70 }} />
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.confirmContainer} showsVerticalScrollIndicator={false}>
          {/* Halo doré */}
          <View style={styles.haloOuter}>
            <View style={styles.haloInner}>
              <Svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <Path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                <Line x1="3" y1="6" x2="21" y2="6" stroke="#fff" strokeWidth="1.5"/>
                <Path d="M16 10a4 4 0 0 1-8 0"/>
              </Svg>
              <View style={styles.haloCheck}>
                <Text style={styles.haloCheckText}>✓</Text>
              </View>
            </View>
          </View>

          <Text style={styles.confirmKicker}>— BOUTIQUE</Text>
          <Text style={styles.confirmTitle}>
            Commande{' '}
            <Text style={styles.confirmTitleGold}>confirmée !</Text>
          </Text>
          <Text style={styles.confirmSubtitle}>
            Merci pour votre confiance. Un email de suivi vient de vous être envoyé.
          </Text>

          {/* Numéro de commande */}
          <View style={styles.orderNumCard}>
            <View style={styles.orderNumTop}>
              <Text style={styles.orderNumKicker}>NUMÉRO DE COMMANDE</Text>
              <View style={styles.emailBadge}>
                <Text style={styles.emailBadgeText}>✉ Email envoyé</Text>
              </View>
            </View>
            <Text style={styles.orderNumText}>{lastOrder.numero}</Text>
          </View>

          {/* Carte commande */}
          <View style={styles.orderCard}>
            <Text style={styles.orderCardTitle}>Votre commande</Text>
            {lastOrder.items.map((item) => (
              <View key={item.id} style={styles.orderItemRow}>
                {item.product.photo_url ? (
                  <Image source={{ uri: item.product.photo_url }} style={styles.orderItemPhoto} resizeMode="cover" />
                ) : (
                  <View style={[styles.orderItemPhoto, { backgroundColor: '#2A2520' }]} />
                )}
                <View style={styles.orderItemInfo}>
                  <Text style={styles.orderItemNom}>{item.product.nom}</Text>
                  <Text style={styles.orderItemMeta}>
                    Qté {item.quantite}{item.product.contenance ? ` · ${item.product.contenance}` : ''}
                  </Text>
                </View>
                <Text style={styles.orderItemPrix}>{parseFloat(item.prix_unitaire).toFixed(0)} €</Text>
              </View>
            ))}
            <View style={styles.orderCardSep} />
            <View style={styles.orderTotalRow}>
              <Text style={styles.orderTotalLabel}>TOTAL PAYÉ</Text>
              <Text style={styles.orderTotalAmount}>{parseFloat(lastOrder.total).toFixed(2)} €</Text>
            </View>
          </View>

          {/* Carte retrait */}
          <View style={styles.retraitCard}>
            <View style={styles.retraitIconCircle}>
              <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <Rect x="9" y="12" width="6" height="10" stroke="#C9A84C" strokeWidth="1.5"/>
              </Svg>
            </View>
            <View>
              <Text style={styles.retraitTitle}>Retrait en salon</Text>
              <Text style={styles.retraitAddr}>Rue Auguste Van Zande 78 · Bruxelles</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.continueBtn}
            activeOpacity={0.85}
            onPress={() => { clearLastOrder(); router.push('/(tabs)' as any); }}
          >
            <Text style={styles.continueBtnText}>Continuer mes achats →</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ── Cart screen ──────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Retour</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerLogoMark}>{'{w}'}</Text>
          <Text style={styles.headerLogoBrand}>willobarber</Text>
        </View>
        <View style={{ width: 70 }} />
      </View>

      <View style={styles.titleSection}>
        <Text style={styles.titleKicker}>— BOUTIQUE</Text>
        <Text style={styles.pageTitle}>Mon Panier</Text>
        <Text style={styles.pageSubtitle}>
          {nbArticles === 0
            ? 'Votre panier est vide'
            : `${nbArticles} produit${nbArticles > 1 ? 's' : ''} sélectionné${nbArticles > 1 ? 's' : ''}`}
        </Text>
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyState}>
          <Svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
            <Path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
            <Line x1="3" y1="6" x2="21" y2="6" stroke="rgba(255,255,255,0.2)" strokeWidth="1"/>
            <Path d="M16 10a4 4 0 0 1-8 0"/>
          </Svg>
          <Text style={styles.emptyText}>Aucun produit dans le panier</Text>
          <TouchableOpacity style={styles.continueBtn} activeOpacity={0.85} onPress={() => router.push('/(tabs)' as any)}>
            <Text style={styles.continueBtnText}>Découvrir nos produits →</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView style={styles.scroll} contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 12, paddingBottom: 160 }} showsVerticalScrollIndicator={false}>
            {items.map(item => (
              <View key={item.id} style={styles.itemCard}>
                <Image source={{ uri: item.photo }} style={styles.itemPhoto} resizeMode="cover" />
                <View style={styles.itemBody}>
                  <View style={styles.itemBadgeRow}>
                    <View style={styles.itemBadge}>
                      <Text style={styles.itemBadgeText}>{item.cat}</Text>
                    </View>
                  </View>
                  <Text style={styles.itemNom}>{item.nom}</Text>
                  <Text style={styles.itemPrix}>{item.prix.toFixed(0)} €</Text>
                  <View style={styles.itemQteRow}>
                    <TouchableOpacity style={styles.qteBtn} onPress={() => updateQte(item.id, item.qte - 1)}>
                      <Text style={styles.qteBtnTextMinus}>−</Text>
                    </TouchableOpacity>
                    <Text style={styles.qteVal}>{item.qte}</Text>
                    <TouchableOpacity style={styles.qteBtnPlus} onPress={() => updateQte(item.id, item.qte + 1)}>
                      <Text style={styles.qteBtnTextPlus}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => removeItem(item.id)}>
                  <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EF5350" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <Rect x="3" y="6" width="18" height="2"/>
                    <Path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <Path d="M10 11v6M14 11v6"/>
                    <Path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                  </Svg>
                </TouchableOpacity>
              </View>
            ))}

            {/* Récapitulatif */}
            <View style={styles.recapCard}>
              <Text style={styles.recapKicker}>RÉCAPITULATIF</Text>
              <View style={styles.recapRow}>
                <Text style={styles.recapLabel}>Sous-total</Text>
                <Text style={styles.recapValue}>{total.toFixed(2)} €</Text>
              </View>
              <View style={styles.recapRow}>
                <Text style={styles.recapLabel}>Retrait en salon</Text>
                <Text style={styles.recapFree}>Gratuit</Text>
              </View>
              <View style={styles.recapSep} />
              <View style={styles.recapRow}>
                <Text style={styles.recapTotalLabel}>Total</Text>
                <Text style={styles.recapTotalAmount}>{total.toFixed(2)} €</Text>
              </View>
            </View>

            {!!checkoutError && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{checkoutError}</Text>
              </View>
            )}
          </ScrollView>

          {/* CTA fixe bas */}
          <View style={styles.ctaFixed}>
            <TouchableOpacity
              style={[styles.ctaBtn, isLoading && { opacity: 0.7 }]}
              activeOpacity={0.85}
              onPress={handleCheckout}
              disabled={isLoading}
            >
              {isLoading
                ? <ActivityIndicator color="#1A1208" size="small" />
                : <Text style={styles.ctaBtnText}>Commander — {total.toFixed(0)} € →</Text>
              }
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0D0C0A' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 52 : (StatusBar.currentHeight ?? 0) + 12,
    paddingBottom: 14,
    backgroundColor: '#0D0C0A',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  backBtn: { width: 70 },
  backText: { color: '#fff', fontSize: 14, fontWeight: '500' },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  headerLogoMark: { fontFamily: Fonts.bold, fontSize: 18, fontWeight: '700', color: '#C9A84C', letterSpacing: 1 },
  headerLogoBrand: { fontFamily: Fonts.semiBold, fontSize: 16, fontWeight: '600', color: '#fff' },

  scroll: { flex: 1 },

  // Title section
  titleSection: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 6 },
  titleKicker: { fontSize: 11, fontWeight: '600', letterSpacing: 3, color: '#C9A84C', textTransform: 'uppercase', marginBottom: 6 },
  pageTitle: { fontFamily: Fonts.bold, fontSize: 32, fontWeight: '700', color: '#fff', marginBottom: 4 },
  pageSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.45)' },

  // Empty state
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 40 },
  emptyText: { fontSize: 14, color: 'rgba(255,255,255,0.4)', textAlign: 'center' },

  // Item card
  itemCard: {
    backgroundColor: '#1A1814',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  itemPhoto: { width: 80, height: 80, borderRadius: 12 },
  itemBody: { flex: 1, gap: 4 },
  itemBadgeRow: { flexDirection: 'row', marginBottom: 2 },
  itemBadge: { backgroundColor: 'rgba(201,168,76,0.18)', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(201,168,76,0.35)' },
  itemBadgeText: { fontSize: 9, fontWeight: '700', color: '#C9A84C', letterSpacing: 1 },
  itemNom: { fontFamily: Fonts.bold, fontSize: 18, fontWeight: '700', color: '#fff' },
  itemPrix: { fontFamily: Fonts.bold, fontSize: 20, fontWeight: '700', color: '#C9A84C' },
  itemQteRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  qteBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#2A2520', alignItems: 'center', justifyContent: 'center' },
  qteBtnPlus: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#C9A84C', alignItems: 'center', justifyContent: 'center' },
  qteBtnTextMinus: { color: '#fff', fontSize: 18, lineHeight: 22 },
  qteBtnTextPlus: { color: '#1A1208', fontSize: 18, lineHeight: 22, fontWeight: '700' },
  qteVal: { fontSize: 16, fontWeight: '700', color: '#fff', minWidth: 20, textAlign: 'center' },
  deleteBtn: { padding: 6 },

  // Récapitulatif
  recapCard: {
    backgroundColor: '#1A1814',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
  },
  recapKicker: { fontSize: 10, fontWeight: '700', letterSpacing: 2.5, color: '#C9A84C', textTransform: 'uppercase', marginBottom: 14 },
  recapRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  recapLabel: { fontSize: 14, color: 'rgba(255,255,255,0.55)' },
  recapValue: { fontSize: 14, color: '#fff', fontWeight: '600' },
  recapFree: { fontSize: 14, color: '#4CAF50', fontWeight: '600' },
  recapSep: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 12 },
  recapTotalLabel: { fontFamily: Fonts.bold, fontSize: 16, fontWeight: '700', color: '#fff' },
  recapTotalAmount: { fontFamily: Fonts.bold, fontSize: 28, fontWeight: '700', color: '#C9A84C' },

  // Error
  errorBox: { backgroundColor: 'rgba(192,57,43,0.15)', borderRadius: 10, borderWidth: 1, borderColor: '#C0392B', padding: 12, marginBottom: 12 },
  errorText: { fontSize: 13, color: '#FF6B6B', lineHeight: 18 },

  // CTA fixe
  ctaFixed: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 18,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    paddingTop: 16,
    backgroundColor: '#0D0C0A',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },
  ctaBtn: {
    backgroundColor: '#C9A84C',
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#C9A84C',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 6,
  },
  ctaBtnText: { fontFamily: Fonts.semiBold, color: '#1A1208', fontSize: 17, fontWeight: '700' },

  // ── Confirmation screen ──────────────────────────────────────────────────────
  confirmContainer: { paddingHorizontal: 18, paddingTop: 32, paddingBottom: 40, alignItems: 'center' },

  haloOuter: { marginBottom: 24 },
  haloInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#C9A84C',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: '#C9A84C',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 8,
  },
  haloCheck: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0D0C0A',
  },
  haloCheckText: { color: '#fff', fontSize: 12, fontWeight: '700', lineHeight: 16 },

  confirmKicker: { fontSize: 11, fontWeight: '600', letterSpacing: 3, color: '#C9A84C', textTransform: 'uppercase', marginBottom: 10, textAlign: 'center' },
  confirmTitle: { fontFamily: Fonts.bold, fontSize: 34, fontWeight: '700', color: '#fff', textAlign: 'center', marginBottom: 10 },
  confirmTitleGold: { fontFamily: Fonts.semiBoldItalic, color: '#C9A84C', fontStyle: 'italic' },
  confirmSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 20, marginBottom: 28, maxWidth: 280 },

  orderNumCard: {
    width: '100%',
    backgroundColor: '#1A1814',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
  },
  orderNumTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  orderNumKicker: { fontSize: 10, fontWeight: '700', letterSpacing: 2, color: '#C9A84C', textTransform: 'uppercase' },
  emailBadge: { backgroundColor: 'rgba(76,175,80,0.15)', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(76,175,80,0.4)' },
  emailBadgeText: { fontSize: 11, color: '#4CAF50', fontWeight: '600' },
  orderNumText: { fontSize: 16, color: '#fff', fontFamily: 'monospace', fontWeight: '600', letterSpacing: 1 },

  orderCard: {
    width: '100%',
    backgroundColor: '#1A1814',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
  },
  orderCardTitle: { fontFamily: Fonts.semiBold, fontSize: 20, fontWeight: '600', color: '#fff', marginBottom: 14 },
  orderItemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  orderItemPhoto: { width: 52, height: 52, borderRadius: 10 },
  orderItemInfo: { flex: 1 },
  orderItemNom: { fontSize: 14, fontWeight: '600', color: '#fff', marginBottom: 2 },
  orderItemMeta: { fontSize: 12, color: 'rgba(255,255,255,0.45)' },
  orderItemPrix: { fontSize: 14, fontWeight: '700', color: '#C9A84C' },
  orderCardSep: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 12 },
  orderTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderTotalLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 2, color: '#C9A84C', textTransform: 'uppercase' },
  orderTotalAmount: { fontFamily: Fonts.bold, fontSize: 22, fontWeight: '700', color: '#C9A84C' },

  retraitCard: {
    width: '100%',
    backgroundColor: '#1A1814',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 28,
  },
  retraitIconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#2A2520', alignItems: 'center', justifyContent: 'center' },
  retraitTitle: { fontSize: 15, fontWeight: '600', color: '#fff', marginBottom: 2 },
  retraitAddr: { fontSize: 13, color: 'rgba(255,255,255,0.45)' },

  continueBtn: {
    backgroundColor: '#C9A84C',
    borderRadius: 100,
    paddingVertical: 16,
    paddingHorizontal: 28,
    alignItems: 'center',
    shadowColor: '#C9A84C',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 6,
  },
  continueBtnText: { fontFamily: Fonts.semiBold, color: '#1A1208', fontSize: 16, fontWeight: '700' },
});
