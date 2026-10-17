import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const VISIBLE_MS = 4500;
const GOLD = '#C9A84C';

export type ToastData = {
  message: string;
  subtitle?: string;
  // Pastille de couleur (ex. statut de commande) — or par défaut.
  color?: string;
  // Route ouverte au toucher du toast.
  href: string;
  testID?: string;
};

type Props = {
  toast: ToastData | null;
  onHide: () => void;
  onPress: (toast: ToastData) => void;
};

// Toast en haut d'écran pour les événements SSE temps réel (statut de
// commande, réponse du barbier côté client ; nouveau message côté coiffeur).
export function NotificationToast({ toast, onHide, onPress }: Props) {
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!toast) return;
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }).start(onHide);
    }, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [toast, anim, onHide]);

  if (!toast) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        { top: insets.top + 10 },
        { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] },
      ]}
    >
      <TouchableOpacity
        style={styles.toast}
        onPress={() => onPress(toast)}
        activeOpacity={0.9}
        testID={toast.testID ?? 'notification-toast'}
      >
        <View style={[styles.dot, { backgroundColor: toast.color ?? GOLD }]} />
        <View style={styles.body}>
          <Text style={styles.message}>{toast.message}</Text>
          {!!toast.subtitle && <Text style={styles.subtitle} numberOfLines={2}>{toast.subtitle}</Text>}
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
  subtitle: { color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 3 },
});
