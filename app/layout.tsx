import { AppProviders } from '@/components/providers/AppProviders';
import type { Metadata } from 'next';
import { DM_Sans, JetBrains_Mono } from 'next/font/google';
import type { ReactNode } from 'react';
import './globals.css';

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'LinkedIn Automator',
  description: 'Visual LinkedIn outreach automation with live Playwright execution and Supabase realtime logs.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${jetBrainsMono.variable}`}>
      <body className="font-sans text-text-primary antialiased">
        <AppProviders>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
