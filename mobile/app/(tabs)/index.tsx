import React, { useEffect, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/hooks/useAuth';
import { useReservations } from '@/hooks/useReservations';
import { settingsApi } from '@/services/api';
import { ReservationCard } from '@/components/home/ReservationCard';
import { ServiceCarousel } from '@/components/home/ServiceCarousel';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadow } from '@/constants';
import type { SalonSettingsPublic } from '@/types';

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Bonjour';
  if (h < 18) return 'Bon après-midi';
  return 'Bonsoir';
}

const QUICK_ACTIONS = [
  { icon: '✂️', label: 'Réserver', route: '/(tabs)/book' as const },
  { icon: '📋', label: 'Mes RDV', route: '/(tabs)/reservations' as const },
  { icon: '⭐', label: 'Services', route: '/(tabs)/book' as const },
  { icon: '👤', label: 'Profil', route: '/(tabs)/profile' as const },
];

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { upcoming, isLoading, refetch } = useReservations();
  const [salonSettings, setSalonSettings] = useState<SalonSettingsPublic | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    settingsApi.get().then(setSalonSettings).catch(() => {});
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const nextReservation = upcoming[0] ?? null;
  const firstName = user?.first_name || user?.username || 'vous';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.gold}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>{getGreeting()},</Text>
            <Text style={styles.userName}>{firstName} 👋</Text>
          </View>
          <View style={styles.loyaltyBadge}>
            <Text style={styles.loyaltyIcon}>⭐</Text>
            <Text style={styles.loyaltyPoints}>{user?.loyalty_points ?? 0} pts</Text>
          </View>
        </View>

        {/* Rush / Closed alert */}
        {salonSettings?.rush_mode_active && (
          <View style={styles.alertBanner}>
            <Text style={styles.alertIcon}>⚡</Text>
            <Text style={styles.alertText}>Mode rush actif — réservations suspendues</Text>
          </View>
        )}
        {salonSettings && !salonSettings.bookings_open && (
          <View style={[styles.alertBanner, styles.alertClosed]}>
            <Text style={styles.alertIcon}>🔒</Text>
            <Text style={styles.alertText}>Les réservations sont actuellement fermées</Text>
          </View>
        )}

        {/* Hero card — next appointment */}
        <LinearGradient
          colors={['#1A1400', '#2A2000', '#1A1A1A']}
          style={styles.heroCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.heroTop}>
            <Text style={styles.heroEmoji}>💈</Text>
            <Badge label="WilloBarber" variant="gold" size="md" />
          </View>

          {nextReservation ? (
            <View style={styles.heroContent}>
              <Text style={styles.heroLabel}>Prochain rendez-vous</Text>
              <Text style={styles.heroService}>{nextReservation.service_name}</Text>
              <Text style={styles.heroBarber}>avec {nextReservation.barber_name}</Text>
              <View style={styles.heroDate}>
                <Text style={styles.heroDateText}>
                  📅{' '}
                  {new Date(nextReservation.date).toLocaleDateString('fr-BE', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                </Text>
                <Text style={styles.heroDateText}>
                  🕐 {nextReservation.start_time.substring(0, 5)}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.heroContent}>
              <Text style={styles.heroLabel}>Pas de rendez-vous à venir</Text>
              <Text style={styles.heroService}>Prenez soin de vous !</Text>
              <Pressable
                style={styles.heroBtn}
                onPress={() => router.push('/(tabs)/book')}
              >
                <Text style={styles.heroBtnText}>Réserver maintenant →</Text>
              </Pressable>
            </View>
          )}
        </LinearGradient>

        {/* Quick actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions rapides</Text>
          <View style={styles.quickGrid}>
            {QUICK_ACTIONS.map((action) => (
              <Pressable
                key={action.label}
                style={({ pressed }) => [styles.quickAction, pressed && styles.quickActionPressed]}
                onPress={() => router.push(action.route)}
              >
                <Text style={styles.quickIcon}>{action.icon}</Text>
                <Text style={styles.quickLabel}>{action.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Nos Prestations — carousel animé */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Nos Prestations</Text>
            <Text style={styles.sectionLink}>5 services</Text>
          </View>
          <ServiceCarousel />
        </View>

        {/* Upcoming reservations */}
        {upcoming.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Prochains rendez-vous</Text>
              <Pressable onPress={() => router.push('/(tabs)/reservations')}>
                <Text style={styles.sectionLink}>Voir tout →</Text>
              </Pressable>
            </View>
            <View style={styles.cardList}>
              {upcoming.slice(0, 3).map((res) => (
                <ReservationCard key={res.id} reservation={res} compact />
              ))}
            </View>
          </View>
        )}

        {/* Loyalty section */}
        <Card style={styles.loyaltyCard} padded>
          <View style={styles.loyaltyRow}>
            <View>
              <Text style={styles.loyaltyCardTitle}>Points fidélité</Text>
              <Text style={styles.loyaltyCardSub}>Cumulez des points à chaque visite</Text>
            </View>
            <View style={styles.loyaltyPoints2}>
              <Text style={styles.loyaltyNum}>{user?.loyalty_points ?? 0}</Text>
              <Text style={styles.loyaltyPts}>pts</Text>
            </View>
          </View>
        </Card>

        <View style={styles.bottomPad} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.xl, gap: Spacing.xl },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerLeft: { gap: 2 },
  greeting: { fontSize: FontSize.base, color: Colors.textSecondary },
  userName: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },

  loyaltyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.goldSubtle,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.3)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  loyaltyIcon: { fontSize: 14 },
  loyaltyPoints: { fontSize: FontSize.sm, color: Colors.gold, fontWeight: FontWeight.semiBold },

  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.warningSubtle,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.warning,
    padding: Spacing.md,
  },
  alertClosed: {
    backgroundColor: Colors.errorSubtle,
    borderColor: Colors.error,
  },
  alertIcon: { fontSize: 18 },
  alertText: { fontSize: FontSize.sm, color: Colors.textPrimary, flex: 1 },

  heroCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    gap: Spacing.base,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.2)',
    ...Shadow.gold,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroEmoji: { fontSize: 28 },
  heroContent: { gap: Spacing.sm },
  heroLabel: { fontSize: FontSize.sm, color: Colors.textMuted, letterSpacing: 0.5 },
  heroService: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  heroBarber: { fontSize: FontSize.base, color: Colors.gold },
  heroDate: { flexDirection: 'row', gap: Spacing.lg, marginTop: Spacing.xs },
  heroDateText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  heroBtn: {
    alignSelf: 'flex-start',
    marginTop: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.base,
    backgroundColor: Colors.gold,
    borderRadius: BorderRadius.md,
  },
  heroBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semiBold,
    color: Colors.textInverse,
  },

  section: { gap: Spacing.md },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  sectionLink: {
    fontSize: FontSize.sm,
    color: Colors.gold,
    fontWeight: FontWeight.medium,
  },

  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  quickAction: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: Spacing.lg,
  },
  quickActionPressed: { opacity: 0.75, backgroundColor: Colors.surfaceElevated },
  quickIcon: { fontSize: 28 },
  quickLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },

  cardList: { gap: Spacing.sm },

  loyaltyCard: { borderColor: 'rgba(201,168,76,0.25)', borderWidth: 1 },
  loyaltyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  loyaltyCardTitle: { fontSize: FontSize.base, fontWeight: FontWeight.semiBold, color: Colors.textPrimary },
  loyaltyCardSub: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },
  loyaltyPoints2: { alignItems: 'flex-end' },
  loyaltyNum: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.gold },
  loyaltyPts: { fontSize: FontSize.sm, color: Colors.textSecondary },

  bottomPad: { height: Spacing.xl },
});
