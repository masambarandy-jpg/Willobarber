import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
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
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/contexts/CartContext';
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

type Produit = {
  id: string;
  cat: string;
  popular: boolean;
  photo: string;
  nom: string;
  desc: string;
  contenance: string;
  prix: number;
};

const NOS_PRODUITS: Produit[] = [
  {
    id: 'cire',
    cat: 'COIFFANT',
    popular: true,
    photo: 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=600&q=80',
    nom: 'Cire Mate Signature',
    desc: 'Fixation forte, fini mat. Tient la journée sans effet carton.',
    contenance: '75 ml',
    prix: 18,
  },
  {
    id: 'huile',
    cat: 'SOIN BARBE',
    popular: false,
    photo: 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=600&q=80',
    nom: 'Huile Barbe Cèdre',
    desc: 'Nourrit, assouplit, parfume. Cèdre & bois de santal.',
    contenance: '30 ml',
    prix: 24,
  },
  {
    id: 'serum',
    cat: 'SOIN VISAGE',
    popular: true,
    photo: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=600&q=80',
    nom: 'Sérum Visage',
    desc: 'Hydratation profonde, teint réveillé. Matin et soir.',
    contenance: '30 ml',
    prix: 32,
  },
  {
    id: 'pommade',
    cat: 'STYLING',
    popular: false,
    photo: 'https://images.unsplash.com/photo-1594035910387-fea081e66b5d?w=600&q=80',
    nom: 'Pommade Brillance',
    desc: "Brillance soignée, coiffage souple, rework facile à l'eau.",
    contenance: '100 ml',
    prix: 22,
  },
];

const PRODUITS_CARD_W = 300;
const PRODUITS_CARD_GAP = 16;

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
  const { user, isAuthenticated } = useAuth();
  const { addItem, nbArticles } = useCart();
  const firstName = user?.first_name || user?.username || 'vous';
  const scrollRef = useRef<ScrollView>(null);
  const [servicesY, setServicesY] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [produitsIndex, setProduitsIndex] = useState(0);

  const handleAddToCart = (prod: Produit) => {
    addItem({
      product_id: NOS_PRODUITS.findIndex(p => p.id === prod.id) + 1,
      cat: prod.cat,
      nom: prod.nom,
      prix: prod.prix,
      contenance: prod.contenance,
      photo: prod.photo,
    });
    setAddedIds(prev => new Set(prev).add(prod.id));
    setTimeout(() => {
      setAddedIds(prev => {
        const next = new Set(prev);
        next.delete(prod.id);
        return next;
      });
    }, 1500);
  };

  const handleProduitsScroll = (e: any) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / (PRODUITS_CARD_W + PRODUITS_CARD_GAP));
    setProduitsIndex(Math.max(0, Math.min(NOS_PRODUITS.length - 1, idx)));
  };

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
          <TouchableOpacity style={styles.cartIconBtn} onPress={() => router.push('/cart' as any)}>
            <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
              <Path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
              <Line x1="3" y1="6" x2="21" y2="6" stroke="#fff" strokeWidth="1"/>
              <Path d="M16 10a4 4 0 0 1-8 0"/>
            </Svg>
            {nbArticles > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{nbArticles > 9 ? '9+' : nbArticles}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIcon} onPress={() => setMenuOpen(true)}>
            <Text style={styles.headerIconText}>☰</Text>
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

        {/* ── Nos Produits section (cream) ── */}
        <View style={styles.produitsSection}>
          <Text style={styles.produitsKicker}>NOS PRODUITS</Text>
          <Text style={styles.produitsTitle}>
            L'entretien, <Text style={styles.produitsTitleGold}>prolongé chez vous.</Text>
          </Text>
          <Text style={styles.produitsSub}>
            Les soins que nous utilisons au salon, sélectionnés pour durer.
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.produitsScrollContent}
            snapToInterval={PRODUITS_CARD_W + PRODUITS_CARD_GAP}
            decelerationRate="fast"
            scrollEventThrottle={16}
            onScroll={handleProduitsScroll}
          >
            {NOS_PRODUITS.map((prod) => {
              const added = addedIds.has(prod.id);
              return (
                <View key={prod.id} style={styles.prodCard2}>
                  <View style={styles.prodPhotoZone2}>
                    <Image source={{ uri: prod.photo }} style={styles.prodPhoto2} resizeMode="cover" />
                    <View style={styles.prodBadgesRow2}>
                      <View style={styles.prodBadgeCat2}>
                        <Text style={styles.prodBadgeText2}>{prod.cat}</Text>
                      </View>
                      {prod.popular && (
                        <View style={[styles.prodBadgeCat2, styles.prodBadgePopular2]}>
                          <Text style={styles.prodBadgeText2}>POPULAIRE</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={styles.prodContent2}>
                    <Text style={styles.prodName2}>{prod.nom}</Text>
                    <Text style={styles.prodDesc2}>{prod.desc}</Text>
                    <View style={styles.prodSep2} />
                    <View style={styles.prodMetaRow2}>
                      <View style={styles.prodMetaLeft2}>
                        <Svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <Circle cx="12" cy="12" r="9" />
                          <Path d="M12 7v5l3 3" />
                        </Svg>
                        <Text style={styles.prodContenance2}>{prod.contenance}</Text>
                      </View>
                      <Text style={styles.prodPrice2}>
                        {prod.prix}
                        <Text style={styles.prodPriceUnit2}> €</Text>
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.cartBtn2, added && styles.cartBtnAdded]}
                      activeOpacity={0.85}
                      onPress={() => handleAddToCart(prod)}
                    >
                      <Text style={styles.cartBtnText2}>
                        {added ? '✓ Ajouté' : 'Ajouter au panier →'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          <View style={styles.produitsDots}>
            {NOS_PRODUITS.map((_, i) => (
              <View key={i} style={[styles.dot, i === produitsIndex && styles.dotActive]} />
            ))}
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
  cartIconBtn: { position: 'relative', width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  cartBadge: { position: 'absolute', top: -4, right: -6, backgroundColor: '#C9A84C', borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  cartBadgeText: { fontSize: 9, fontWeight: '700', color: '#1A1208' },

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

  // Nos Produits section (cream)
  produitsSection: {
    backgroundColor: '#F5EFE7',
    paddingVertical: 40,
    paddingHorizontal: 0,
  },
  produitsKicker: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 4,
    color: '#C9A84C',
    textTransform: 'uppercase',
    textAlign: 'center',
    paddingHorizontal: 22,
  },
  produitsTitle: {
    fontFamily: Fonts.bold,
    fontSize: 30,
    fontWeight: '700',
    color: '#1A1614',
    textAlign: 'center',
    lineHeight: 40,
    marginTop: 10,
    paddingHorizontal: 22,
  },
  produitsTitleGold: {
    fontFamily: Fonts.semiBoldItalic,
    color: '#C9A84C',
    fontStyle: 'italic',
  },
  produitsSub: {
    fontSize: 14,
    color: '#6B6560',
    textAlign: 'center',
    maxWidth: 320,
    marginTop: 8,
    alignSelf: 'center',
    paddingHorizontal: 22,
  },
  produitsScrollContent: {
    paddingHorizontal: 20,
    gap: PRODUITS_CARD_GAP,
    marginTop: 24,
  },
  produitsDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 20,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D4CFC6',
  },
  dotActive: {
    width: 20,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#C9A84C',
  },

  // Product cards (v2)
  prodCard2: {
    width: PRODUITS_CARD_W,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  prodPhotoZone2: {
    height: 240,
    position: 'relative',
  },
  prodPhoto2: {
    width: '100%',
    height: 240,
  },
  prodBadgesRow2: {
    position: 'absolute',
    bottom: 14,
    left: 14,
    flexDirection: 'row',
  },
  prodBadgeCat2: {
    backgroundColor: '#C9A84C',
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  prodBadgePopular2: {
    backgroundColor: '#1A1614',
    marginLeft: 8,
  },
  prodBadgeText2: {
    fontFamily: Fonts.bold,
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  prodContent2: {
    padding: 18,
  },
  prodName2: {
    fontFamily: Fonts.bold,
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1614',
  },
  prodDesc2: {
    fontSize: 13,
    color: '#6B6560',
    lineHeight: 20,
    marginTop: 6,
    marginBottom: 14,
  },
  prodSep2: {
    height: 1,
    backgroundColor: '#E8E2D8',
  },
  prodMetaRow2: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  prodMetaLeft2: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  prodContenance2: {
    fontSize: 13,
    color: '#6B6560',
  },
  prodPrice2: {
    fontFamily: Fonts.bold,
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1614',
  },
  prodPriceUnit2: {
    fontSize: 16,
    fontWeight: '700',
  },
  cartBtn2: {
    backgroundColor: '#C9A84C',
    borderRadius: 100,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 14,
  },
  cartBtnAdded: {
    backgroundColor: '#4CAF50',
  },
  cartBtnText2: {
    fontFamily: Fonts.semiBold,
    color: '#1A1208',
    fontSize: 14,
    fontWeight: '600',
  },

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
