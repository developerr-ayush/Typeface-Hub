import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { ToastProvider } from '@/components/ui';
import { siteUrl } from '@/lib/site';
import './globals.css';

const ui = Inter({ subsets: ['latin'], variable: '--font-ui', display: 'swap' });
const code = JetBrains_Mono({ subsets: ['latin'], variable: '--font-code', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: 'Typeface Hub', template: '%s · Typeface Hub' },
  description: 'Add a font once. Every site, app and editor gets optimised files, generated CSS and only the weights each page needs.',
  applicationName: 'Typeface Hub',
  keywords: ['web fonts', 'font hosting', 'WOFF2 converter', 'icon font generator', 'Fontello alternative', 'self-host Google Fonts', 'variable fonts', 'typography tokens'],
  openGraph: { type: 'website', siteName: 'Typeface Hub' },
  twitter: { card: 'summary_large_image' },
};

export const viewport: Viewport = { themeColor: '#0f1117' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${ui.variable} ${code.variable}`}>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
