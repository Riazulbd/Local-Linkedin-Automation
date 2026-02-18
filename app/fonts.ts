import { JetBrains_Mono, Space_Grotesk } from 'next/font/google';

export const appSans = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-app-sans',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

export const appMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-app-mono',
  display: 'swap',
  weight: ['400', '500', '600'],
});
