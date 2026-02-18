'use client';

import { useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  AppBar,
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
} from '@mui/material';
import {
  AssessmentRounded,
  AccountTreeRounded,
  CampaignRounded,
  DashboardRounded,
  GroupRounded,
  InboxRounded,
  Menu as MenuIcon,
  ScienceRounded,
  SettingsRounded,
  ChevronLeft,
} from '@mui/icons-material';

const DRAWER_WIDTH = 240;

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: DashboardRounded },
  { href: '/campaigns', label: 'Campaigns', icon: CampaignRounded },
  { href: '/workflows', label: 'Flow Builder', icon: AccountTreeRounded },
  { href: '/leads', label: 'Leads', icon: GroupRounded },
  { href: '/unibox', label: 'Unibox', icon: InboxRounded },
  { href: '/monitor', label: 'Monitor', icon: AssessmentRounded },
  { href: '/test', label: 'Test Lab', icon: ScienceRounded },
  { href: '/settings', label: 'Settings', icon: SettingsRounded },
];

function isItemActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/' || pathname.startsWith('/dashboard');
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const drawer = (
    <Box>
      <Toolbar sx={{ justifyContent: 'space-between', borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6" fontWeight={700}>
          <Box component="span" color="primary.main">
            LN
          </Box>{' '}
          Outreach
        </Typography>
        <IconButton onClick={() => setMobileOpen(false)} sx={{ display: { sm: 'none' } }}>
          <ChevronLeft />
        </IconButton>
      </Toolbar>

      <List sx={{ px: 1, py: 2 }}>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isItemActive(pathname, item.href);

          return (
            <ListItem key={item.href} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                selected={active}
                onClick={() => {
                  setMobileOpen(false);
                  router.push(item.href);
                }}
                sx={{
                  borderRadius: 1,
                  '&.Mui-selected': {
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    '&:hover': { bgcolor: 'primary.dark' },
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 40, color: active ? 'inherit' : 'text.secondary' }}>
                  <Icon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: '0.875rem' }} />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
      <Divider />
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar position="fixed" sx={{ display: { sm: 'none' }, zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <IconButton color="inherit" edge="start" onClick={() => setMobileOpen(!mobileOpen)}>
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap>
            LN Outreach
          </Typography>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { sm: DRAWER_WIDTH }, flexShrink: { sm: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: DRAWER_WIDTH },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          open
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: DRAWER_WIDTH,
              border: 0,
              borderRight: 1,
              borderColor: 'divider',
            },
          }}
        >
          {drawer}
        </Drawer>
      </Box>

      <Box component="main" sx={{ flexGrow: 1, bgcolor: 'background.default', minHeight: '100vh' }}>
        <Toolbar sx={{ display: { sm: 'none' } }} />
        {children}
      </Box>
    </Box>
  );
}
