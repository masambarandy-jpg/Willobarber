import { useWindowDimensions } from 'react-native';

export function useIsTablet() {
  const { width } = useWindowDimensions();
  return width >= 768;
}

export function useSidebarWidth() {
  const { width } = useWindowDimensions();
  if (width >= 1024) return 280; // iPad paysage
  if (width >= 768) return 240; // iPad portrait
  return 0; // mobile
}
