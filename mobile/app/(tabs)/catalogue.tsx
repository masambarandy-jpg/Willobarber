import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path } from 'react-native-svg';
import { Fonts } from '@/constants';
import { SERVICES, type StaticService } from '@/components/booking/data';
import { useIsTablet } from '@/components/client/useIsTablet';
import { useLanguage } from '@/contexts/LanguageContext';
import type { TranslationKey } from '@/i18n/translations';
import { servicesApi } from '@/services/api';
import type { Service } from '@/types';

const API_CATEGORY_MAP: Record<string, string> = {
  coupe_homme: 'COUPE HOMME',
  barbe: 'BARBE',
  package: 'PACKAGE',
  coloration: 'COLORATION',
  soin: 'SOIN',
  enfant: 'ENFANT',
};

const PHOTO_BY_NAME: Record<string, string> = {
  'Signature WilloBarber': 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=800&q=80',
  "Taille & rasage à l'ancienne": 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=800&q=80',
  'Le Rituel': 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&q=80',
  'Coupe express': 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=800&q=80',
  'Camouflage gris': 'https://images.unsplash.com/photo-1518710843675-2540dd79065c?w=800&q=80',
  'Soin du visage': 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=800&q=80',
  'Coupe enfant −15 ans': 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80',
  'Coupe enfant +15 ans': 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80',
};

function mapApiService(s: Service): StaticService {
  return {
    id: String(s.id),
    cat: API_CATEGORY_MAP[s.category] ?? s.category.toUpperCase(),
    name: s.name,
    desc: s.description,
    dur: `${s.duration} min`,
    price: parseFloat(s.price),
    popular: s.is_popular,
    photo: PHOTO_BY_NAME[s.name],
  };
}

const GOLD  = '#C9A84C';
const CARD  = '#1A1814';
const GREY  = '#6B6560';
const SEP   = 'rgba(255,255,255,0.08)';

const FILTERS = ['all', 'coupe', 'barbe', 'package', 'soin', 'coloration', 'enfant'] as const;
type Filter = typeof FILTERS[number];

function matchesFilter(svc: StaticService, filter: Filter): boolean {
  if (filter === 'all') return true;
  if (filter === 'coupe') return svc.cat.includes('COUPE');
  if (filter === 'barbe') return svc.cat === 'BARBE';
  if (filter === 'package') return svc.cat === 'PACKAGE';
  if (filter === 'soin') return svc.cat === 'SOIN';
  if (filter === 'coloration') return svc.cat === 'COLORATION';
  if (filter === 'enfant') return svc.cat === 'ENFANT';
  return true;
}

export default function CatalogueScreen() {
  const router = useRouter();
  const isTablet = useIsTablet();
  const { width } = useWindowDimensions();
  const { t } = useLanguage();
  const columns = !isTablet ? 1 : width >= 1024 ? 3 : 2;
  const [activeFilter, setActiveFilter] = useState<Filter>('all');
  const [apiServices, setApiServices] = useState<StaticService[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await servicesApi.list();
        if (!cancelled) setApiServices(data.map(mapApiService));
      } catch (e) {
        if (!cancelled) setApiServices(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const services = apiServices ?? SERVICES;

  const filteredServices = useMemo(
    () => services.filter(s => matchesFilter(s, activeFilter)),
    [services, activeFilter]
  );

  const svcName = (svc: StaticService) => {
    const key = `services.svc.${svc.id}.name` as TranslationKey;
    const translated = t(key);
    return translated === key ? svc.name : translated;
  };
  const svcDesc = (svc: StaticService) => {
    const key = `services.svc.${svc.id}.desc` as TranslationKey;
    const translated = t(key);
    return translated === key ? svc.desc : translated;
  };
  const svcCat  = (svc: StaticService) => t(`services.cat.${svc.cat}` as TranslationKey);

  const handleReserve = (svc: StaticService) => {
    router.push({ pathname: '/(tabs)/book', params: { serviceId: svc.id } });
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.kicker}>{t('services.kicker')}</Text>
          <Text style={[styles.title, isTablet && { fontSize: 38 }]}>{t('services.title')}</Text>
          <Text style={styles.subtitle}>{t('services.subtitle')}</Text>
        </View>

        {/* Filtres catégories */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {FILTERS.map(f => {
            const isActive = f === activeFilter;
            return (
              <TouchableOpacity
                key={f}
                style={[styles.pill, isActive && styles.pillActive]}
                onPress={() => setActiveFilter(f)}
                activeOpacity={0.85}
              >
                <Text style={[styles.pillText, isActive && styles.pillTextActive]}>{t(`services.filter.${f}` as TranslationKey)}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Liste des prestations */}
        {loading ? (
          <ActivityIndicator color={GOLD} size="large" style={styles.loader} />
        ) : (
        <View style={[styles.list, isTablet && styles.listGrid]}>
          {filteredServices.map(svc => (
            <View
              key={svc.id}
              style={isTablet ? { width: `${100 / columns}%`, paddingHorizontal: 8, marginBottom: 16 } : undefined}
            >
            <View style={[styles.card, isTablet && { marginHorizontal: 0, marginBottom: 0 }]}>
              {/* Zone photo */}
              <View style={styles.photoZone}>
                {svc.photo ? (
                  <Image source={{ uri: svc.photo }} style={styles.photo} resizeMode="cover" />
                ) : (
                  <View style={[styles.photo, { backgroundColor: '#2a1f10' }]} />
                )}
                <LinearGradient
                  colors={['transparent', 'rgba(26,24,20,0.85)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={styles.photoGradient}
                />
                <View style={styles.badgesRow}>
                  <View style={styles.catBadge}>
                    <Text style={styles.catBadgeText}>{svcCat(svc)}</Text>
                  </View>
                  {svc.popular && (
                    <View style={[styles.catBadge, styles.popularBadge]}>
                      <Text style={styles.catBadgeText}>{t('common.popular')}</Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Zone texte */}
              <View style={styles.textZone}>
                <Text style={styles.name}>{svcName(svc)}</Text>
                <Text style={styles.desc}>{svcDesc(svc)}</Text>

                <View style={styles.sep} />

                <View style={styles.metaRow}>
                  <View style={styles.metaLeft}>
                    <Svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <Circle cx="12" cy="12" r="9" />
                      <Path d="M12 7v5l3 3" />
                    </Svg>
                    <Text style={styles.dur}>{svc.dur}</Text>
                  </View>
                  <Text style={styles.price}>
                    {svc.price}
                    <Text style={styles.priceUnit}> €</Text>
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.reserveBtn}
                  activeOpacity={0.85}
                  onPress={() => handleReserve(svc)}
                >
                  <Text style={styles.reserveBtnText}>{t('common.select')}</Text>
                  <View style={styles.reserveBtnArrowCircle}>
                    <Text style={styles.reserveBtnArrowText}>→</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
            </View>
          ))}
        </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0D0C0A',
  },
  scrollContent: {
    paddingBottom: 120,
  },

  // Header
  header: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 8,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 3,
    color: GOLD,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: Fonts.bold,
    fontSize: 34,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: GREY,
    textAlign: 'center',
  },

  // Filtres
  filterRow: {
    gap: 10,
    paddingHorizontal: 20,
    marginTop: 20,
  },
  pill: {
    backgroundColor: '#1A1814',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 100,
    paddingVertical: 8,
    paddingHorizontal: 18,
  },
  pillActive: {
    backgroundColor: GOLD,
    borderColor: GOLD,
  },
  pillText: {
    fontSize: 13,
    color: GREY,
  },
  pillTextActive: {
    color: '#1A1208',
    fontWeight: '600',
  },

  // Liste
  loader: {
    marginTop: 60,
  },
  list: {
    marginTop: 24,
  },
  listGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    maxWidth: 1100,
    alignSelf: 'center',
    width: '100%',
  },

  // Card
  card: {
    backgroundColor: CARD,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    marginHorizontal: 20,
  },

  photoZone: {
    height: 200,
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: 200,
  },
  photoGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 90,
  },
  badgesRow: {
    position: 'absolute',
    bottom: 14,
    left: 14,
    flexDirection: 'row',
  },
  catBadge: {
    backgroundColor: GOLD,
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  popularBadge: {
    backgroundColor: '#1A1614',
    marginLeft: 8,
  },
  catBadgeText: {
    fontFamily: Fonts.bold,
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  textZone: {
    padding: 18,
  },
  name: {
    fontFamily: Fonts.bold,
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  desc: {
    fontSize: 13,
    color: GREY,
    lineHeight: 20,
    marginTop: 4,
    marginBottom: 12,
  },
  sep: {
    height: 1,
    backgroundColor: SEP,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  metaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dur: {
    fontSize: 13,
    color: GREY,
  },
  price: {
    fontFamily: Fonts.bold,
    fontSize: 24,
    fontWeight: '700',
    color: GOLD,
  },
  priceUnit: {
    fontSize: 16,
    fontWeight: '700',
  },

  reserveBtn: {
    flexDirection: 'row',
    backgroundColor: GOLD,
    borderRadius: 100,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 14,
  },
  reserveBtnText: {
    fontFamily: Fonts.semiBold,
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1208',
  },
  reserveBtnArrowCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reserveBtnArrowText: {
    fontSize: 13,
    color: '#1A1208',
    lineHeight: 16,
  },
});
