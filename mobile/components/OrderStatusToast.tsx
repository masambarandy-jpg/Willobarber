import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ORDER_STATUS_COLORS } from '@/components/BoutiqueOrderDetailModal';
import type { OrderStatusEvent } from '@/types';

const VISIBLE_MS = 4500;

type Props = {
  event: OrderStatusEvent | null;
  onHide: () => void;
  onPress: () => void;
};

// Toast en haut d'écran, affiché par ClientNotificationsProvider à la
// réception d'un événement SSE order_status_changed.
export function OrderStatusToast({ event, onHide, onPress }: Props) {
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!event) return;
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }).start(onHide);
    }, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [event, anim, onHide]);

  if (!event) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        { top: insets.top + 10 },
        { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] },
      ]}
    >
      <TouchableOpacity style={styles.toast} onPress={onPress} activeOpacity={0.9} testID="order-status-toast">
        {/* Pastille : or = en préparation, bleu = en route / prête, vert = terminée (couleurs de l'espace coiffeur). */}
        <View style={[styles.dot, { backgroundColor: ORDER_STATUS_COLORS[event.status]?.text }]} />
        <View style={styles.body}>
          <Text style={styles.message}>{event.message}</Text>
          <Text style={styles.numero}>Commande {event.order_number}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center', zIndex: 1000, elevation: 1000 },
  toast: {
    width: '100%',
    maxWidth: 480,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1A1814',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.35)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  body: { flex: 1 },
  message: { color: '#fff', fontSize: 14.5, fontWeight: '600' },
  numero: { color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 3 },
});
