// Datei: src/app/manifest.ts
// Next.js App Router erkennt diese Datei automatisch und generiert daraus
// die manifest.webmanifest für PWA-Unterstützung (Homescreen-Icon, Splash etc.)

import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Familienstammbaum',
    short_name: 'Stammbaum',
    description: 'Familienstammbaum App',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#0f172a',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
