import React from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Fonts } from '@/constants';
import { BARBERS, type BookingState, type StaticBarber } from './data';

const GOLD       = '#C9A84C';
const CARD       = '#1A1814';
const GREY       = '#6B6560';
const BORDER_MED = 'rgba(255,255,255,0.16)';

const ANY_BARBER: StaticBarber = {
  id: 'any',
  initial: '~',
  name: 'Peu importe — premier disponible',
  role: '',
  roleShort: '',
  avatarColor: '',
  rating: '',
  reviews: 0,
  desc: "Plus de créneaux disponibles, garantie qualité identique.",
};

interface Props {
  booking: BookingState;
  onSelect: (b: StaticBarber) => void;
}

export function Step2Barber({ booking, onSelect }: Props) {
  const selected = booking.barber;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.kicker}>RÉSERVATION</Text>
      <Text style={styles.title}>Choisissez votre barbier</Text>
      <Text style={styles.subtitle}>
        Une équipe formée à la même école. Trois personnalités, trois mains.
      </Text>

      {/* Barber cards */}
      {BARBERS.map((barber) => {
        const isOn = selected?.id === barber.id;
        const isWillo = barber.id === 'willo';
        return (
          <TouchableOpacity
            key={barber.id}
            style={[styles.card, isOn && styles.cardActive]}
            onPress={() => onSelect(barber)}
            activeOpacity={0.8}
          >
            <View style={styles.cardRow}>
              {/* Avatar with optional golden ring for Willo */}
              {isWillo ? (
                <View style={styles.willoRing}>
                  <View style={[styles.avatar, { backgroundColor: barber.avatarColor }]}>
                    <Text style={styles.avatarInitial}>{barber.initial}</Text>
                  </View>
                </View>
              ) : (
                <View style={[styles.avatar, { backgroundColor: barber.avatarColor }]}>
                  <Text style={styles.avatarInitial}>{barber.initial}</Text>
                </View>
              )}

              {/* Info */}
              <View style={styles.info}>
                <Text style={styles.barberName}>{barber.name}</Text>
                <Text style={styles.barberRole}>{barber.role}</Text>
                <Text style={styles.barberRating}>
                  ⭐ {barber.rating} · {barber.reviews} avis
                </Text>
                <Text style={styles.barberDesc}>{barber.desc}</Text>
              </View>

              {/* Radio */}
              <View style={[styles.radio, isOn && styles.radioActive]}>
                {isOn && <Text style={styles.radioCheck}>✓</Text>}
              </View>
            </View>
          </TouchableOpacity>
        );
      })}

      {/* Peu importe — premier disponible */}
      {(() => {
        const isOn = selected?.id === ANY_BARBER.id;
        return (
          <TouchableOpacity
            style={[styles.anyCard, isOn && styles.anyCardActive]}
            onPress={() => onSelect(ANY_BARBER)}
            activeOpacity={0.8}
          >
            <View style={styles.cardRow}>
              <View style={styles.anyIconCircle}>
                <Text style={styles.anyIcon}>👥</Text>
              </View>
              <View style={styles.info}>
                <Text style={styles.anyTitle}>{ANY_BARBER.name}</Text>
                <Text style={styles.anySubtitle}>{ANY_BARBER.desc}</Text>
              </View>
              <View style={[styles.radio, isOn && styles.radioActive]}>
                {isOn && <Text style={styles.radioCheck}>✓</Text>}
              </View>
            </View>
          </TouchableOpacity>
        );
      })()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 120,
  },

  kicker: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2,
    color: GOLD,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: Fonts.semiBold,
    fontSize: 24,
    color: '#FFFFFF',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: GREY,
    lineHeight: 19,
    marginBottom: 20,
  },

  // Barber card
  card: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: 'transparent',
    marginBottom: 12,
  },
  cardActive: {
    borderColor: GOLD,
    ...Platform.select({
      ios: {
        shadowColor: GOLD,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
      },
      android: { elevation: 6 },
    }),
  },

  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },

  // Avatar
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  willoRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    padding: 2,
  },
  avatarInitial: {
    fontFamily: Fonts.bold,
    fontSize: 22,
    color: '#FFFFFF',
  },

  // Info
  info: {
    flex: 1,
    gap: 2,
  },
  barberName: {
    fontFamily: Fonts.semiBold,
    fontSize: 19,
    color: '#FFFFFF',
  },
  barberRole: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
    color: GOLD,
    textTransform: 'uppercase',
  },
  barberRating: {
    fontSize: 12.5,
    color: GREY,
    marginTop: 3,
  },
  barberDesc: {
    fontSize: 12.5,
    color: GREY,
    lineHeight: 17,
    marginTop: 4,
  },

  // Radio
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  radioActive: {
    backgroundColor: GOLD,
    borderColor: GOLD,
  },
  radioCheck: {
    fontSize: 11,
    color: '#1a1208',
    fontWeight: '700',
  },

  // Peu importe card
  anyCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    borderStyle: 'dashed',
    marginBottom: 12,
  },
  anyCardActive: {
    borderStyle: 'solid',
    borderColor: GOLD,
    ...Platform.select({
      ios: {
        shadowColor: GOLD,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
      },
      android: { elevation: 6 },
    }),
  },
  anyIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(201,168,76,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  anyIcon: {
    fontSize: 18,
  },
  anyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 3,
  },
  anySubtitle: {
    fontSize: 12.5,
    color: GREY,
    lineHeight: 17,
  },
});
