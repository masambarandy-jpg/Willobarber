import React from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Fonts } from '@/constants';
import { TERMS_TEXT, PRIVACY_TEXT } from '@/constants/legal';

export type LegalModalType = 'terms' | 'privacy' | null;

export function LegalModal({
  type,
  onClose,
  isTablet,
  termsTitle = "Conditions d'utilisation",
  privacyTitle = 'Politique de confidentialité',
  closeLabel = 'Fermer',
}: {
  type: LegalModalType;
  onClose: () => void;
  isTablet?: boolean;
  termsTitle?: string;
  privacyTitle?: string;
  closeLabel?: string;
}) {
  return (
    <Modal visible={type !== null} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.legalOverlay, isTablet && styles.overlayTablet]}>
        <View style={[styles.legalModalBox, isTablet && styles.legalModalBoxTablet]}>
          <View style={styles.modalHeader}>
            <Text style={styles.legalTitle}>
              {type === 'terms' ? termsTitle : privacyTitle}
            </Text>
            <Pressable onPress={onClose}><Text style={styles.legalClose}>✕</Text></Pressable>
          </View>
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            <Text style={styles.legalBodyText}>
              {type === 'terms' ? TERMS_TEXT : PRIVACY_TEXT}
            </Text>
          </ScrollView>
          <TouchableOpacity style={styles.legalCloseBtn} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.legalCloseBtnText}>{closeLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlayTablet: { justifyContent: 'center', alignItems: 'center' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },

  legalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  legalModalBox: {
    backgroundColor: '#0D0C0A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    // Hauteur fixe plutôt que maxHeight : le ScrollView enfant (flex: 1) a
    // besoin d'une base de calcul non ambiguë. maxHeight seul (sans height ni
    // flex sur ce conteneur) laisse Yoga résoudre la dépendance circulaire
    // "hauteur du parent dépend du flex:1 de l'enfant" en hauteur 0 sur iOS —
    // le texte (bien réel) du modal Conditions/Politique s'affichait "vide".
    height: '70%',
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  legalModalBoxTablet: {
    borderRadius: 24,
    width: '90%',
    maxWidth: 620,
    height: '80%',
    paddingBottom: 24,
  },
  legalTitle: { fontFamily: Fonts.semiBold, fontSize: 22, fontWeight: '600', color: '#FFFFFF', flex: 1, paddingRight: 12 },
  legalClose: { fontSize: 18, color: 'rgba(255,255,255,0.45)', padding: 4 },
  legalBodyText: { fontSize: 14, lineHeight: 22, color: '#FFFFFF', paddingBottom: 8 },
  legalCloseBtn: {
    backgroundColor: '#C9A84C',
    borderRadius: 100,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 16,
  },
  legalCloseBtnText: { color: '#1A1208', fontWeight: '700', fontSize: 15 },
});
