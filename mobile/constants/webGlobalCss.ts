import { Platform } from 'react-native';

// CSS global web. Injecté au runtime et pas via app/+html.tsx : avec
// web.output = "single" (app.json), +html.tsx n'est pas utilisé par Expo
// (vérifié sur `expo export --platform web` : son <style> n'est pas dans index.html).
const CSS = `
/* Contour bleu du navigateur au focus des champs : casse le design sombre. */
input:focus,
textarea:focus,
select:focus {
  outline: none !important;
}

/* Autofill Chrome : le navigateur force un fond clair (et une couleur de texte)
   en !important. On ne peut pas les surcharger, seulement retarder leur
   application indéfiniment : le champ garde son fond et sa couleur. */
input:-webkit-autofill,
input:-webkit-autofill:hover,
input:-webkit-autofill:focus,
textarea:-webkit-autofill,
select:-webkit-autofill {
  transition: background-color 600000s 0s, color 600000s 0s;
}
`;

export function injectWebGlobalCss() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (document.getElementById('wb-global-css')) return;
  const style = document.createElement('style');
  style.id = 'wb-global-css';
  style.textContent = CSS;
  document.head.appendChild(style);
}
