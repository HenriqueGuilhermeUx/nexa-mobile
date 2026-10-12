import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

const baseUrl = process.env.EXPO_BASE_URL || '/global-app';

export default function Root({ children }: PropsWithChildren) {
  const manifestHref = `${baseUrl}/manifest.webmanifest`;
  const serviceWorkerHref = `${baseUrl}/sw.js`;

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <meta name="theme-color" content="#06111F" />
        <meta name="application-name" content="Nexa Global" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Nexa Global" />
        <link rel="manifest" href={manifestHref} />
        <link rel="apple-touch-icon" href={`${baseUrl}/icon.png`} />
        <ScrollViewStyleReset />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function () {
                  navigator.serviceWorker
                    .register('${serviceWorkerHref}', { scope: '${baseUrl}/' })
                    .catch(function (error) {
                      console.warn('Nexa Global service worker registration failed', error);
                    });
                });
              }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
