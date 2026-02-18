import { AppProviders } from '@/components/providers/AppProviders';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { appMono, appSans } from '@/app/fonts';
import { darkTheme } from '@/lib/theme';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v14-appRouter';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'LinkedIn Automator',
  description: 'Visual LinkedIn outreach automation with live Playwright execution and Supabase realtime logs.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={`${appSans.variable} ${appMono.variable}`}>
        <AppRouterCacheProvider>
          <ThemeProvider theme={darkTheme}>
            <CssBaseline />
            <AppProviders>
              <DashboardLayout>{children}</DashboardLayout>
            </AppProviders>
          </ThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
