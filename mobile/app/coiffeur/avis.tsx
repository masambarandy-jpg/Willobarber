import { useEffect, useState } from 'react';
import { ActivityIndicator, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CoiffeurScreen from '@/components/coiffeur/CoiffeurScreen';
import Avatar from '@/components/coiffeur/Avatar';
import { StarIcon } from '@/components/coiffeur/Icons';
import { CC, SERIF } from '@/components/coiffeur/theme';
import { useIsTablet } from '@/components/coiffeur/useIsTablet';
import { API_BASE_URL } from '@/constants';
import type { Review } from '@/types';

const TABS = ['Tous', '5★', '4★', '3★ et -'] as const;

function avatarLetterFor(name: string): string {
  return (name.trim().charAt(0) || '?').toUpperCase();
}

function formatReviewDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function CoiffeurAvisScreen() {
  const isTablet = useIsTablet();
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>('Tous');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Le token du gérant est stocké sous 'coiffeur_token' (cf. app/coiffeur/index.tsx) —
        // distinct du JWT client géré par l'instance axios `http` (TokenStorage).
        const token = await AsyncStorage.getItem('coiffeur_token');
        if (!token) {
          console.log('[AVIS] aucun coiffeur_token en AsyncStorage');
          if (!cancelled) setError('Impossible de charger les avis.');
          return;
        }

        const url = `${API_BASE_URL}/reviews/`;
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        console.log('[AVIS] GET', url, '→', response.status, JSON.stringify(data));

        if (!response.ok) {
          if (!cancelled) setError('Impossible de charger les avis.');
          return;
        }
        if (!cancelled) setReviews(data as Review[]);
      } catch (err) {
        console.log('[AVIS] erreur fetch avis:', err);
        if (!cancelled) setError('Impossible de charger les avis.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  const filtered = reviews.filter((r) => {
    if (activeTab === 'Tous') return true;
    if (activeTab === '5★') return r.rating === 5;
    if (activeTab === '4★') return r.rating === 4;
    if (activeTab === '3★ et -') return r.rating <= 3;
    return true;
  });

  const totalReviews = reviews.length;
  const avgRating = totalReviews > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
    : 0;

  const distribution = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: reviews.filter((r) => r.rating === stars).length,
  }));
  const maxCount = Math.max(1, ...distribution.map((d) => d.count));

  return (
    <CoiffeurScreen active="avis">
      <Text style={styles.title}>Avis clients</Text>

      <View style={isTablet && styles.tabletRow}>
        <View style={isTablet ? styles.summaryColTablet : undefined}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryLeft}>
                <Text style={styles.ratingBig}>{totalReviews > 0 ? avgRating.toFixed(1).replace('.', ',') : '—'}</Text>
                <View style={styles.starsRow}>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <StarIcon key={i} filled={i < Math.round(avgRating)} />
                  ))}
                </View>
                <Text style={styles.reviewCount}>{totalReviews} avis</Text>
              </View>

              <View style={styles.summaryRight}>
                {distribution.map((d) => (
                  <View key={d.stars} style={styles.distRow}>
                    <Text style={styles.distLabel}>{d.stars}★</Text>
                    <View style={styles.distTrack}>
                      <View style={[styles.distFill, { width: `${(d.count / maxCount) * 100}%` }]} />
                    </View>
                    <Text style={styles.distCount}>{d.count}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>

        <View style={isTablet ? styles.listColTablet : undefined}>
          <View style={styles.tabsRow}>
            {TABS.map((tab) => {
              const active = tab === activeTab;
              return (
                <TouchableOpacity
                  key={tab}
                  style={[styles.tab, active && styles.tabActive]}
                  onPress={() => setActiveTab(tab)}
                >
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {isLoading ? (
            <ActivityIndicator color={CC.gold} size="large" style={{ marginVertical: 30 }} />
          ) : error ? (
            <Text style={styles.emptyText}>{error}</Text>
          ) : filtered.length === 0 ? (
            <Text style={styles.emptyText}>Aucun avis pour le moment.</Text>
          ) : (
            filtered.map((r) => (
              <View key={r.id} style={styles.reviewCard}>
                <View style={styles.reviewTopRow}>
                  <Avatar letter={avatarLetterFor(r.client_name)} size={38} />
                  <View style={styles.reviewIdentity}>
                    <Text style={styles.reviewName}>{r.client_name}</Text>
                    <Text style={styles.reviewMeta}>
                      {formatReviewDate(r.created_at)} · {r.service_name}
                    </Text>
                  </View>
                </View>

                <View style={styles.starsRow}>
                  {Array.from({ length: 5 }, (_, i) => (
                    <StarIcon key={i} filled={i < r.rating} />
                  ))}
                </View>

                {!!r.comment && <Text style={styles.reviewText}>{r.comment}</Text>}
              </View>
            ))
          )}
        </View>
      </View>
    </CoiffeurScreen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: SERIF,
    fontWeight: '600',
    fontSize: 30,
    color: CC.black,
    marginBottom: 18,
  },
  tabletRow: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-start',
  },
  summaryColTablet: {
    width: '34%',
  },
  listColTablet: {
    flex: 1,
    minWidth: 0,
  },
  summaryCard: {
    backgroundColor: CC.white,
    borderRadius: 16,
    padding: 18,
    marginBottom: 18,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 20,
  },
  summaryLeft: {
    alignItems: 'flex-start',
  },
  ratingBig: {
    fontFamily: SERIF,
    fontWeight: '700',
    fontSize: 52,
    color: CC.black,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 4,
    marginBottom: 8,
  },
  reviewCount: {
    fontSize: 11,
    color: CC.textSecondary,
  },
  summaryRight: {
    flex: 1,
    justifyContent: 'center',
    gap: 6,
  },
  distRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  distLabel: {
    fontSize: 11,
    color: CC.textSecondary,
    width: 20,
  },
  distTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: CC.trackBg,
  },
  distFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: CC.gold,
  },
  distCount: {
    fontSize: 11,
    color: CC.textSecondary,
    width: 26,
    textAlign: 'right',
  },
  tabsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  tab: {
    backgroundColor: CC.white,
    borderWidth: 1,
    borderColor: CC.border,
    borderRadius: 100,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  tabActive: {
    backgroundColor: CC.black,
    borderColor: CC.black,
  },
  tabText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: CC.textSecondary,
  },
  tabTextActive: {
    color: CC.white,
  },
  emptyText: {
    fontSize: 13.5,
    color: CC.textSecondary,
    textAlign: 'center',
    marginVertical: 30,
  },
  reviewCard: {
    backgroundColor: CC.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  reviewTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  reviewIdentity: {
    flex: 1,
  },
  reviewName: {
    fontSize: 14,
    fontWeight: '700',
    color: CC.black,
  },
  reviewMeta: {
    fontSize: 11,
    color: CC.textSecondary,
    marginTop: 1,
  },
  reviewText: {
    fontSize: 13.5,
    lineHeight: 21,
    color: CC.black,
    marginTop: 8,
  },
});
