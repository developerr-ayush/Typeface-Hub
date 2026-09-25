import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { ToastProvider } from '@/components/ui';
import './globals.css';

const ui = Inter({ subsets: ['latin'], variable: '--font-ui', display: 'swap' });
const code = JetBrains_Mono({ subsets: ['latin'], variable: '--font-code', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Typeface Hub', template: '%s · Typeface Hub' },
  description: 'Add a font once. Every site, app and editor gets optimised files, generated CSS and only the weights each page needs.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${ui.variable} ${code.variable}`}>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
