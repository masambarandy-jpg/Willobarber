import { router, type Href } from 'expo-router';

// Bouton « Retour » : revient à l'écran précédent s'il existe, sinon ouvre
// `fallback`. Sans ce garde-fou, router.back() sur une pile vide (URL ouverte
// directement, page rafraîchie sur le web) lève « The action 'GO_BACK' was
// not handled » et ne fait rien.
export function goBackOr(fallback: Href) {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
