import { useCallback, useRef, useState } from 'react';
import {
  LayoutAnimation,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '@/contexts/LanguageContext';

// Éléments visibles d'une liste d'historique repliée.
export const HISTORY_PREVIEW_COUNT = 3;
const GOLD = '#C9A84C';
const TOGGLE_MS = 200;

// Android (ancienne architecture) : LayoutAnimation est désactivé par défaut.
if (Platform.OS === 'android') UIManager.setLayoutAnimationEnabledExperimental?.(true);

// ScrollView dont on suit la position, pour la corriger au repli d'une liste.
export function useTrackedScroll() {
  const ref = useRef<ScrollView>(null);
  const offset = useRef(0);
  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    offset.current = e.nativeEvent.contentOffset.y;
  }, []);
  return { ref, offset, onScroll };
}

type TrackedScroll = ReturnType<typeof useTrackedScroll>;

// Accordéon d'une liste : replié par défaut (non persisté). Au repli, la liste
// rétrécit au-dessus du bouton : on remonte le scroll d'autant pour que le
// bouton reste à la même place à l'écran au lieu de la page qui « saute ».
export function useListAccordion(scroll: TrackedScroll) {
  const [expanded, setExpanded] = useState(false);
  const listHeight = useRef(0);
  const pendingCollapse = useRef<{ offset: number; height: number } | null>(null);

  const onListLayout = useCallback((e: LayoutChangeEvent) => {
    const height = e.nativeEvent.layout.height;
    const pending = pendingCollapse.current;
    if (pending && height < pending.height) {
      pendingCollapse.current = null;
      scroll.ref.current?.scrollTo({ y: Math.max(0, pending.offset - (pending.height - height)), animated: false });
    }
    listHeight.current = height;
  }, [scroll]);

  const toggle = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.create(TOGGLE_MS, 'easeInEaseOut', 'opacity'));
    if (expanded) pendingCollapse.current = { offset: scroll.offset.current, height: listHeight.current };
    setExpanded((v) => !v);
  }, [expanded, scroll]);

  return { expanded, setExpanded, toggle, onListLayout };
}

type ToggleProps = {
  expanded: boolean;
  // Nombre d'éléments masqués quand la liste est repliée.
  hiddenCount: number;
  // « RDV », « opérations »… (déjà traduit).
  unit: string;
  onPress: () => void;
  testID?: string;
  // Libellés propres à une liste autre que l'historique (ex. RDV à venir).
  collapsedLabel?: string;
  expandedLabel?: string;
};

export function HistoryToggleButton({
  expanded, hiddenCount, unit, onPress, testID, collapsedLabel, expandedLabel,
}: ToggleProps) {
  const { t } = useLanguage();
  return (
    <TouchableOpacity
      style={styles.button}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      aria-expanded={expanded}
      testID={testID}
    >
      <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={GOLD} />
      <Text style={styles.text}>
        {expanded
          ? expandedLabel ?? t('reservations.hideHistory')
          : collapsedLabel ?? `${t('reservations.viewAllHistoryPrefix')} (${hiddenCount} ${unit})`}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: GOLD,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  text: { color: GOLD, fontSize: 13.5, fontWeight: '600' },
});
