import { ScrollViewStyleReset } from 'expo-router/html';

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{
          __html: `
            /* Fix overlay blocking sidebar on web */
            div[style*="position: absolute"][style*="inset: 0px"] {
              pointer-events: none !important;
            }
          `
        }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
