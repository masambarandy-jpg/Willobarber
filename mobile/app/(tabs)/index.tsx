import React, { useRef, useState } from 'react';
import {
  Dimensions,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableNativeFeedback,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/hooks/useAuth';
import { ServiceCarousel } from '@/components/home/ServiceCarousel';
import { HamburgerMenu } from '@/components/HamburgerMenu';
import { Fonts } from '@/constants';

const { width: SCREEN_W } = Dimensions.get('window');

// Static team data matching design
const BARBERS = [
  { id: 'willo', initial: 'W', name: 'Willo', role: 'FONDATEUR & MASTER BARBER', color: '#C9A84C', ringColor: '#C9A84C', rating: '4,9', reviews: 312, desc: '30 ans de passion pour la coiffure. Spécialiste des coupes texturées et des fondus ultra-précis.', tags: ['Fade', 'Texturé', 'Rasoir'] },
  { id: 'malik', initial: 'M', name: 'Malik', role: 'BARBIER SENIOR', color: '#d8a06a', ringColor: '#8a5a35', rating: '4,9', reviews: 184, desc: "L'œil pour la barbe ciselée. Patience d'orfèvre, geste vif, résultat impeccable.", tags: ['Barbe', 'Rasage', 'Classique'] },
  { id: 'idris', initial: 'I', name: 'Idris', role: 'BARBIER & COLORISTE', color: '#6fc191', ringColor: '#2D6A4F', rating: '4,8', reviews: 96, desc: 'Le réflexe pour les coupes contemporaines et la couleur masculine la plus discrète.', tags: ['Color', 'Crop', 'Soin'] },
];

const REVIEWS = [
  { name: 'Thomas L.', color: '#6fc191', ring: '#2D6A4F', stars: 5, quote: 'Le meilleur barbier de Bruxelles, sans hésiter. On ressort avec dix ans de moins.', service: 'Signature WilloBarber' },
  { name: 'Karim B.', color: '#d8a06a', ring: '#8a5a35', stars: 5, quote: 'Un vrai rituel. La serviette chaude, le rasoir droit… on prend le temps.', service: 'Taille & rasage' },
  { name: 'Noé V.', color: '#b69ae0', ring: '#6b4fa0', stars: 5, quote: 'Idris a compris exactement ce que je voulais. Couleur impeccable et naturelle.', service: 'Camouflage gris' },
  { name: 'Antoine R.', color: '#C9A84C', ring: '#8B6914', stars: 5, quote: 'Réservation en deux clics, accueil parfait, résultat au-dessus de mes attentes.', service: 'Le Rituel' },
];

function PrimaryBookButton({ label, onPress }: { label: string; onPress: () => void }) {
  const inner = (
    <View style={styles.btnPrimaryInner}>
      <Text style={styles.btnPrimaryText}>{label}</Text>
      <View style={styles.btnArrowCircle}>
        <Text style={styles.btnArrowText}>→</Text>
      </View>
    </View>
  );
  if (Platform.OS === 'android') {
    return (
      <View style={[styles.btnPrimary, { overflow: 'hidden', paddingVertical: 0, paddingHorizontal: 0 }]}>
        <TouchableNativeFeedback onPress={onPress} background={TouchableNativeFeedback.Ripple('rgba(26,18,8,0.2)', false)}>
          <View style={{ paddingVertical: 14, paddingHorizontal: 20 }}>{inner}</View>
        </TouchableNativeFeedback>
      </View>
    );
  }
  return (
    <TouchableOpacity style={styles.btnPrimary} onPress={onPress} activeOpacity={0.85}>
      {inner}
    </TouchableOpacity>
  );
}

function Stars({ n }: { n: number }) {
  return <Text style={styles.stars}>{'★'.repeat(n)}{'☆'.repeat(5 - n)}</Text>;
}

function Avatar({ initial, color, ring, size = 44 }: { initial: string; color: string; ring: string; size?: number }) {
  return (
    <View style={[styles.avatarBase, { width: size, height: size, borderRadius: size / 2, backgroundColor: color + '22', borderColor: ring }]}>
      <Text style={[styles.avatarInitial, { fontSize: size * 0.38, color }]}>{initial}</Text>
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const firstName = user?.first_name || user?.username || 'vous';
  const scrollRef = useRef<ScrollView>(null);
  const [servicesY, setServicesY] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <View style={styles.root}>
      <HamburgerMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />

      {/* Fixed header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerLogo}>{'{w}'}</Text>
          <Text style={styles.headerBrand}>willobarber</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerIcon} onPress={() => setMenuOpen(true)}>
            <Text style={styles.headerIconText}>☰</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/(tabs)/profile')}>
            <Avatar initial={(firstName[0] ?? 'U').toUpperCase()} color="#C9A84C" ring="#8B6914" size={32} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView ref={scrollRef} style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* ── Hero dark section ── */}
        <LinearGradient
          colors={['#221c12', '#141009', '#0D0C0A']}
          start={{ x: 0.8, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.hero}
        >
          <Text style={styles.heroKicker}>BARBER PRIVÉ · RUE AUGUSTE VAN ZANDE 78</Text>
          <Text style={styles.heroTitle}>
            L'art de la{'\n'}
            <Text style={styles.heroTitleGold}>coupe,{'\n'}</Text>
            l'esprit du{'\n'}
            <Text style={styles.heroTitleGold}>détail.</Text>
          </Text>
          <Text style={styles.heroSub}>
            WilloBarber élève la coupe masculine au rang de rituel. Une heure suspendue, un geste précis, un résultat sur mesure.
          </Text>
          <View style={styles.heroBtns}>
            <PrimaryBookButton label="Réserver maintenant" onPress={() => router.push('/(tabs)/book')} />
            <TouchableOpacity style={styles.btnOutline} onPress={() => scrollRef.current?.scrollTo({ y: servicesY, animated: true })} activeOpacity={0.85}>
              <Text style={styles.btnOutlineText}>↓  Nos prestations</Text>
            </TouchableOpacity>
          </View>

          {/* Social proof card */}
          <View style={styles.proofCard}>
            <View style={styles.proofAvatars}>
              {['#C9A84C', '#8a5a35', '#2D6A4F'].map((c, i) => (
                <View key={i} style={[styles.proofAvatar, { backgroundColor: c + '33', borderColor: c, marginLeft: i ? -8 : 0 }]}>
                  <Text style={{ fontSize: 10, color: c }}>W</Text>
                </View>
              ))}
              <Text style={styles.proofCount}>2.4k+</Text>
            </View>
            <Text style={styles.proofText}>
              Plus de 2 400 clients fidèles nous confient leur image chaque année  ·  4.9★ sur Google.
            </Text>
          </View>
        </LinearGradient>

        {/* ── Services section (cream) ── */}
        <View style={styles.creamSection} onLayout={e => setServicesY(e.nativeEvent.layout.y)}>
          <Text style={styles.sectionKicker}>NOS PRESTATIONS</Text>
          <Text style={styles.sectionTitleDark}>
            Une carte courte, <Text style={styles.sectionTitleGold}>une exigence longue.</Text>
          </Text>
          <Text style={styles.sectionSub}>Six prestations choisies, exécutées avec la même rigueur.</Text>
          <View style={{ marginHorizontal: -22, marginTop: 6 }}>
            <ServiceCarousel />
          </View>
        </View>

        {/* ── Team section (dark) ── */}
        <View style={styles.darkSection}>
          <Text style={styles.sectionKicker}>L'ÉQUIPE</Text>
          <Text style={styles.sectionTitleLight}>
            Trois mains, <Text style={styles.sectionTitleGold}>une même école.</Text>
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
            {BARBERS.map(b => (
              <View key={b.id} style={styles.barberCard}>
                <Avatar initial={b.initial} color={b.color} ring={b.ringColor} size={72} />
                <Text style={styles.barberName}>{b.name}</Text>
                <Text style={styles.barberRole}>{b.role}</Text>
                <Text style={styles.barberDesc}>{b.desc}</Text>
                <View style={styles.tagRow}>
                  {b.tags.map(t => (
                    <View key={t} style={styles.tag}>
                      <Text style={styles.tagText}>{t}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* ── Reviews section (cream) ── */}
        <View style={styles.creamSection}>
          <Text style={styles.sectionKicker}>ILS EN PARLENT</Text>
          <Text style={[styles.sectionTitleGold, { fontFamily: Fonts.italic, fontSize: 26, marginBottom: 20, textAlign: 'center' }]}>
            4,9 / 5 sur 720 avis vérifiés.
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
            {REVIEWS.map((r, i) => (
              <View key={i} style={styles.reviewCard}>
                <Stars n={r.stars} />
                <Text style={styles.reviewQuote}>« {r.quote} »</Text>
                <View style={styles.reviewAuthorRow}>
                  <Avatar initial={r.name[0]} color={r.color} ring={r.ring} size={36} />
                  <View>
                    <Text style={styles.reviewAuthor}>{r.name}</Text>
                    <Text style={styles.reviewService}>{r.service}</Text>
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* ── CTA final (dark) ── */}
        <View style={[styles.darkSection, { paddingVertical: 40, alignItems: 'center' }]}>
          <Text style={[styles.sectionTitleLight, { textAlign: 'center', fontSize: 30, marginBottom: 12, fontFamily: Fonts.light }]}>
            Votre prochain rendez-vous <Text style={[styles.sectionTitleGold, { fontFamily: Fonts.lightItalic }]}>commence ici.</Text>
          </Text>
          <Text style={[styles.sectionSub, { color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: 24, maxWidth: 280 }]}>
            Plage horaire en quelques clics. Acompte sécurisé. Confirmation immédiate.
          </Text>
          <PrimaryBookButton label="Réserver une plage" onPress={() => router.push('/(tabs)/book')} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0D0C0A' },

  // Fixed header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 52 : (StatusBar.currentHeight ?? 0),
    paddingBottom: 12,
    backgroundColor: 'rgba(13,12,10,0.9)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  headerLogo: { fontFamily: Fonts.bold, fontSize: 22, fontWeight: '700', color: '#C9A84C', letterSpacing: 1 },
  headerBrand: { fontFamily: Fonts.semiBold, fontSize: 19, fontWeight: '600', color: '#fff' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  headerIcon: {},
  headerIconText: { fontSize: 20, color: '#fff' },

  scroll: { flex: 1 },

  // Avatar
  avatarBase: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  avatarInitial: { fontFamily: Fonts.semiBold, fontWeight: '600' },

  // Hero dark section
  hero: {
    paddingHorizontal: 22,
    paddingTop: 30,
    paddingBottom: 34,
  },
  heroKicker: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2,
    color: '#C9A84C',
    textTransform: 'uppercase',
    marginBottom: 18,
  },
  heroTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: 50,
    fontWeight: '600',
    color: '#fff',
    lineHeight: 54,
    letterSpacing: 0.3,
  },
  heroTitleGold: { fontFamily: Fonts.semiBoldItalic, color: '#C9A84C', fontStyle: 'italic' },
  heroSub: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 21,
    marginTop: 20,
    marginBottom: 24,
    maxWidth: 320,
  },
  heroBtns: { gap: 12, marginBottom: 26 },
  btnPrimary: {
    backgroundColor: '#C9A84C',
    borderRadius: 100,
    paddingVertical: 14,
    paddingHorizontal: 20,
    shadowColor: '#C9A84C',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 6,
  },
  btnPrimaryInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  btnPrimaryText: {
    fontFamily: Fonts.semiBold,
    color: '#1A1208',
    fontSize: 17,
    fontWeight: '600',
  },
  btnArrowCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(26,18,8,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnArrowText: { color: '#1A1208', fontSize: 13, lineHeight: 16 },
  btnOutline: {
    borderRadius: 100,
    paddingVertical: 15,
    paddingHorizontal: 26,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
  },
  btnOutlineText: { fontFamily: Fonts.semiBold, color: 'rgba(255,255,255,0.8)', fontWeight: '600', fontSize: 16 },

  // Social proof card
  proofCard: {
    backgroundColor: '#1A1814',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.18)',
    borderRadius: 16,
    padding: 16,
  },
  proofAvatars: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  proofAvatar: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  proofCount: { fontFamily: Fonts.bold, fontSize: 22, fontWeight: '700', color: '#C9A84C' },
  proofText: { fontSize: 12.5, color: 'rgba(255,255,255,0.5)', lineHeight: 19 },

  // Sections
  creamSection: { backgroundColor: '#F5F0E8', paddingHorizontal: 22, paddingTop: 34, paddingBottom: 30 },
  darkSection: { backgroundColor: '#0D0C0A', paddingHorizontal: 22, paddingTop: 34, paddingBottom: 30 },

  sectionKicker: { fontSize: 11, fontWeight: '600', letterSpacing: 3, color: '#C9A84C', textTransform: 'uppercase', textAlign: 'center', marginBottom: 12 },
  sectionTitleDark: { fontFamily: Fonts.semiBold, fontSize: 28, fontWeight: '600', color: '#1A1208', textAlign: 'center', marginBottom: 8, lineHeight: 34 },
  sectionTitleLight: { fontFamily: Fonts.semiBold, fontSize: 28, fontWeight: '600', color: '#fff', textAlign: 'center', marginBottom: 20, lineHeight: 34 },
  sectionTitleGold: { fontFamily: Fonts.semiBoldItalic, color: '#C9A84C', fontStyle: 'italic' },
  sectionSub: { fontSize: 13.5, color: '#6B6560', textAlign: 'center', lineHeight: 20, marginBottom: 20 },

  // Horizontal scroll
  hScroll: { paddingHorizontal: 0, gap: 14, paddingBottom: 4 },

  // Barber cards
  barberCard: {
    width: 248,
    backgroundColor: '#1A1814',
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
    gap: 6,
  },
  barberName: { fontFamily: Fonts.semiBold, fontSize: 22, fontWeight: '600', color: '#fff', marginTop: 8 },
  barberRole: { fontSize: 10, fontWeight: '600', letterSpacing: 2, color: '#C9A84C', textTransform: 'uppercase', textAlign: 'center' },
  barberDesc: { fontSize: 12.5, color: 'rgba(255,255,255,0.55)', lineHeight: 19, textAlign: 'center', marginTop: 4 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, justifyContent: 'center', marginTop: 6 },
  tag: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', borderRadius: 100, paddingHorizontal: 12, paddingVertical: 5 },
  tagText: { fontSize: 11, color: 'rgba(255,255,255,0.7)' },

  // Review cards
  reviewCard: {
    width: 262,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    gap: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 3,
  },
  stars: { fontSize: 14, color: '#C9A84C', marginBottom: 12 },
  reviewQuote: { fontFamily: Fonts.italic, fontStyle: 'italic', fontSize: 17, color: '#2a2118', lineHeight: 24, marginBottom: 16 },
  reviewAuthorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reviewAuthor: { fontSize: 13.5, fontWeight: '600', color: '#1A1208' },
  reviewService: { fontSize: 11.5, color: '#a89f93', marginTop: 1 },
});
