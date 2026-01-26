import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import './globals.css';
import { SessionProvider } from '@/components/session-provider';
import { Toaster } from 'sonner';

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
});

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL || 'https://foremanos.site'),
  title: 'ForemanOS - Field Operations Intelligence',
  description: 'Document-based AI assistant for construction teams. Get accurate answers from your project documents instantly.',
  icons: {
    icon: [
      { url: '/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-48.png', sizes: '48x48', type: 'image/png' },
    ],
    shortcut: '/favicon-32.png',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ForemanOS',
  },
  openGraph: {
    title: 'ForemanOS - Field Operations Intelligence',
    description: 'Document-based AI assistant for construction teams. Get accurate answers from your project documents instantly.',
    images: ['/og-image.png'],
    type: 'website',
    siteName: 'ForemanOS',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ForemanOS - Field Operations Intelligence',
    description: 'Document-based AI assistant for construction teams.',
    images: ['/og-image.png'],
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#1F2328',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <script src="https://apps.abacus.ai/chatllm/appllm-lib.js"></script>
        <script dangerouslySetInnerHTML={{
          __html: `
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/service-worker.js').then(
                  function(registration) {
                    console.log('ServiceWorker registration successful');
                  },
                  function(err) {
                    console.log('ServiceWorker registration failed: ', err);
                  }
                );
              });
            }
          `
        }} />
      </head>
      <body className={`${inter.variable} ${spaceGrotesk.variable} font-body antialiased`}>
        <SessionProvider>
          {children}
          <Toaster 
            position="top-right" 
            richColors 
            closeButton 
            duration={3000}
            toastOptions={{
              style: {
                fontFamily: 'Roboto Mono, monospace',
              },
            }}
          />
        </SessionProvider>
      </body>
    </html>
  );
}
