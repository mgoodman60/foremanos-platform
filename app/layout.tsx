import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import { SessionProvider } from '@/components/session-provider';
import { AnnouncerProvider } from '@/components/ui/announcer';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { ProgressBarProvider } from '@/components/ui/progress-bar';
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
  maximumScale: 5,
  userScalable: true,
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
        <Script
          src="https://apps.abacus.ai/chatllm/appllm-lib.js"
          strategy="lazyOnload"
        />
        <Script id="service-worker-registration" strategy="lazyOnload">
          {`
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
          `}
        </Script>
      </head>
      <body className={`${inter.variable} ${spaceGrotesk.variable} font-body antialiased`}>
        {/* Skip to main content link for keyboard users - WCAG 2.1 AA */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-orange-500 focus:text-white focus:rounded focus:outline-none focus:ring-2 focus:ring-orange-300"
        >
          Skip to main content
        </a>
        <SessionProvider>
          <ProgressBarProvider>
            <AnnouncerProvider>
              <ErrorBoundary>
                {children}
              </ErrorBoundary>
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
            </AnnouncerProvider>
          </ProgressBarProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
