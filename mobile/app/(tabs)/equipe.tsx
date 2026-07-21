import React from 'react';
import {
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Fonts } from '@/constants';
import { useLanguage } from '@/contexts/LanguageContext';

const GOLD = '#C9A84C';
const GREY = '#6B6560';

const BARBERS = [
  {
    initial: 'W',
    nom: 'Willo',
    color: '#C9A84C',
    role: 'FONDATEUR & MASTER BARBER',
    note: '4,9',
    avis: 312,
    desc: "30 ans de passion pour la coiffure, dont 10 ans d'excellence. Une précision chirurgicale.",
    tags: ['Dégradé', 'Rasage', 'Styling'],
  },
  {
    initial: 'M',
    nom: 'Malik',
    color: '#7A3B1E',
    role: 'BARBIER SENIOR',
    note: '4,9',
    avis: 184,
    desc: "L'œil pour la barbe ciselée. Précis, rapide, efficace.",
    tags: ['Coloration', 'Dégradé', 'Barbe'],
  },
  {
    initial: 'I',
    nom: 'Idris',
    color: '#1A6B4A',
    role: 'BARBIER & COLORISTE',
    note: '4,8',
    avis: 96,
    desc: "La relève. Passionné de coupes classiques et de rasage à l'ancienne.",
    tags: ['Rasage', 'Coupe classique', 'Barbe'],
  },
] as const;

export default function EquipeScreen() {
  const router = useRouter();
  const { t } = useLanguage();

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerCenter} onPress={() => router.push('/(tabs)' as any)} activeOpacity={0.7}>
          <Text style={styles.headerLogoMark}>{'{w}'}</Text>
          <Text style={styles.headerLogoBrand}>willobarber</Text>
        </TouchableOpacity>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Titre */}
        <View style={styles.titleSection}>
          <Text style={styles.kicker}>— NOTRE ÉQUIPE</Text>
          <Text style={styles.title}>Trois mains, une école.</Text>
        </View>

        {/* Cartes barbiers */}
        {BARBERS.map((b) => (
          <View key={b.initial} style={styles.card}>
            <View style={[styles.avatar, { backgroundColor: b.color + '22', borderColor: b.color }]}>
              <Text style={[styles.avatarInitial, { color: b.color }]}>{b.initial}</Text>
            </View>
            <Text style={styles.nom}>{b.nom}</Text>
            <Text style={styles.role}>{b.role}</Text>
            <Text style={styles.note}>⭐ {b.note} · {b.avis} avis</Text>
            <Text style={styles.desc}>{b.desc}</Text>
            <View style={styles.tagRow}>
              {b.tags.map(t => (
                <View key={t} style={styles.tag}>
                  <Text style={styles.tagText}>{t}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}

        {/* Bouton réserver */}
        <TouchableOpacity
          style={styles.reserveBtn}
          activeOpacity={0.85}
          onPress={() => router.push('/(tabs)/book')}
        >
          <Text style={styles.reserveBtnText}>Réserver avec l'un d'eux →</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0D0C0A',
  },

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
  headerLogoMark: { fontFamily: Fonts.bold, fontSize: 18, fontWeight: '700', color: GOLD, letterSpacing: 1 },
  headerLogoBrand: { fontFamily: Fonts.semiBold, fontSize: 16, fontWeight: '600', color: '#fff' },

  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 60 },

  // Titre
  titleSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 3,
    color: GOLD,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    fontFamily: Fonts.bold,
    fontSize: 30,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Carte barbier
  card: {
    backgroundColor: '#1A1814',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    marginHorizontal: 20,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarInitial: {
    fontFamily: Fonts.semiBold,
    fontSize: 24,
    fontWeight: '600',
  },
  nom: {
    fontFamily: Fonts.bold,
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  role: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2,
    color: GOLD,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  note: {
    fontSize: 13,
    color: GREY,
    marginTop: 8,
  },
  desc: {
    fontSize: 14,
    color: GREY,
    lineHeight: 22,
    marginTop: 10,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  tag: {
    backgroundColor: '#2A2520',
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tagText: {
    fontSize: 11,
    color: GOLD,
  },

  // Bouton réserver
  reserveBtn: {
    backgroundColor: GOLD,
    borderRadius: 100,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
    marginHorizontal: 20,
  },
  reserveBtnText: {
    fontFamily: Fonts.semiBold,
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1208',
  },
});
