import { useWindowDimensions } from 'react-native';

export function useIsTablet() {
  const { width } = useWindowDimensions();
  return width >= 768;
}

export function useClientSidebarWidth() {
  const { width } = useWindowDimensions();
  if (width >= 1024) return 260; // iPad paysage
  if (width >= 768) return 220; // iPad portrait
  return 0; // mobile
}
