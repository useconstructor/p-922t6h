import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import localFont from 'next/font/local';
import './globals.css';
const sans = localFont({
  src: [
    { path: './fonts/ibm-plex-sans-latin-400-normal.woff2', weight: '400' },
    { path: './fonts/ibm-plex-sans-latin-500-normal.woff2', weight: '500' },
    { path: './fonts/ibm-plex-sans-latin-600-normal.woff2', weight: '600' },
  ],
  variable: '--font-plex-sans',
  display: 'swap',
});
const mono = localFont({ src: './fonts/ibm-plex-mono-latin-400-normal.woff2', variable: '--font-plex-mono', display: 'swap', weight: '400' });
export const metadata: Metadata = {
  title: 'Tareas AWS Frontend',
  description: 'Herramienta interna para crear, editar y gestionar tareas pendientes.',
  robots: { index: false, follow: false },
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  interactiveWidget: 'resizes-content',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="es" className={`${sans.variable} ${mono.variable}`}><body>{children}<Script src={process.env.NEXT_PUBLIC_CONSTRUCTOR_API + '/v1/projects/' + process.env.NEXT_PUBLIC_PROJECT_ID + '/analytics/script.js'} strategy="afterInteractive" /><script src={"https://constructor-api-prod.vercel.app/v1/projects/P-922T6H/analytics/script.js"} defer></script></body></html>;
}
