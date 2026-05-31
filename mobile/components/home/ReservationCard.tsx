import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, BorderRadius, FontSize, FontWeight, Spacing, Shadow } from '@/constants';
import { RESERVATION_STATUS } from '@/constants';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import type { Reservation } from '@/types';

interface ReservationCardProps {
  reservation: Reservation;
  compact?: boolean;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long' });
}

function formatTime(timeStr: string): string {
  return timeStr.substring(0, 5);
}

const statusVariantMap: Record<string, 'success' | 'warning' | 'info' | 'error' | 'neutral'> = {
  confirmed: 'success',
  pending: 'warning',
  completed: 'info',
  cancelled_client: 'error',
  cancelled_barber: 'error',
  no_show: 'neutral',
};

export function ReservationCard({ reservation, compact = false }: ReservationCardProps) {
  const router = useRouter();
  const statusInfo = RESERVATION_STATUS[reservation.status] ?? { label: reservation.status };
  const variant = statusVariantMap[reservation.status] ?? 'neutral';

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={() => router.push(`/(tabs)/reservations`)}
    >
      <View style={styles.topRow}>
        <Avatar name={reservation.barber_name} size={compact ? 38 : 46} />
        <View style={styles.info}>
          <Text style={styles.barberName}>{reservation.barber_name}</Text>
          <Text style={styles.serviceName}>{reservation.service_name}</Text>
        </View>
        <Badge label={statusInfo.label} variant={variant} />
      </View>

      {!compact && (
        <View style={styles.bottomRow}>
          <View style={styles.detailChip}>
            <Text style={styles.detailIcon}>📅</Text>
            <Text style={styles.detailText}>{formatDate(reservation.date)}</Text>
          </View>
          <View style={styles.detailChip}>
            <Text style={styles.detailIcon}>🕐</Text>
            <Text style={styles.detailText}>{formatTime(reservation.start_time)}</Text>
          </View>
          <View style={styles.detailChip}>
            <Text style={styles.detailIcon}>💶</Text>
            <Text style={styles.detailText}>{reservation.total_amount}€</Text>
          </View>
        </View>
      )}

      <View style={styles.refRow}>
        <Text style={styles.ref}>{reservation.reference}</Text>
        {compact && (
          <Text style={styles.compactDate}>
            {formatDate(reservation.date)} — {formatTime(reservation.start_time)}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: Spacing.base,
    gap: Spacing.md,
    ...Shadow.sm,
  },
  pressed: { opacity: 0.85 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  info: { flex: 1 },
  barberName: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semiBold,
    color: Colors.textPrimary,
  },
  serviceName: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  bottomRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceBorder,
    paddingTop: Spacing.md,
  },
  detailChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  detailIcon: { fontSize: 12 },
  detailText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  refRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ref: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontFamily: 'monospace',
  },
  compactDate: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
});
