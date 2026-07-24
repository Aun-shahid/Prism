'use client';

import * as React from 'react';
import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Toolbar from '@mui/material/Toolbar';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAuth } from '../../hooks/useAuth';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { setSidebarCollapsed } from '../../store/uiSlice';
import {
  ADMIN_NAV_ITEMS,
  USER_NAV_ITEMS,
  SIDEBAR_EXPANDED,
  SIDEBAR_RAIL,
  SIDEBAR_STORAGE_KEY,
  SIDEBAR_TRANSITION,
  type NavItem,
} from './nav';

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export default function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();
  const collapsed = useAppSelector((s) => s.ui.sidebarCollapsed);

  // Hydrate the persisted preference after mount (SSR-safe)
  React.useEffect(() => {
    if (localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true') {
      dispatch(setSidebarCollapsed(true));
    }
  }, [dispatch]);

  const handleToggle = () => {
    const next = !collapsed;
    dispatch(setSidebarCollapsed(next));
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
  };

  const menuItems = user?.role === 'super_admin' ? ADMIN_NAV_ITEMS : USER_NAV_ITEMS;
  const width = collapsed ? SIDEBAR_RAIL : SIDEBAR_EXPANDED;

  const isSelected = (item: NavItem) => {
    const [itemPath, itemQuery] = item.path.split('?');
    const tabParam = searchParams.get('tab');
    if (itemQuery) {
      const wantedTab = new URLSearchParams(itemQuery).get('tab');
      return pathname === itemPath && tabParam === wantedTab;
    }
    if (itemPath === '/dashboard') {
      return pathname === '/dashboard' && !tabParam;
    }
    return pathname.startsWith(itemPath);
  };

  const handleNavigate = (item: NavItem) => {
    router.push(item.path);
    onMobileClose();
  };

  const navList = (showLabels: boolean) => (
    <List sx={{ px: 1.25, flex: 1 }}>
      {menuItems.map((item) => {
        const selected = isSelected(item);
        const button = (
          <ListItemButton
            selected={selected}
            onClick={() => handleNavigate(item)}
            sx={{
              minHeight: 44,
              mb: 0.25,
              justifyContent: showLabels ? 'flex-start' : 'center',
              px: showLabels ? 1.5 : 0,
              position: 'relative',
              '&.Mui-selected': {
                bgcolor: 'rgba(13, 148, 136, 0.10)',
                '&:hover': { bgcolor: 'rgba(13, 148, 136, 0.15)' },
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  left: 0,
                  top: '22%',
                  bottom: '22%',
                  width: 3,
                  borderRadius: 3,
                  bgcolor: 'primary.main',
                },
              },
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: showLabels ? 38 : 0,
                justifyContent: 'center',
                color: selected ? 'primary.main' : 'text.secondary',
              }}
            >
              <item.Icon fontSize="small" />
            </ListItemIcon>
            {showLabels && (
              <ListItemText
                primary={item.text}
                slotProps={{
                  primary: {
                    sx: {
                      fontSize: '0.875rem',
                      fontWeight: selected ? 700 : 500,
                      color: selected ? 'primary.main' : 'text.primary',
                    },
                  },
                }}
              />
            )}
          </ListItemButton>
        );
        return (
          <ListItem key={item.text} disablePadding sx={{ display: 'block' }}>
            {showLabels ? (
              button
            ) : (
              <Tooltip title={item.text} placement="right">
                {button}
              </Tooltip>
            )}
          </ListItem>
        );
      })}
    </List>
  );

  const drawerContent = (showLabels: boolean) => (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Toolbar sx={{ justifyContent: showLabels ? 'flex-start' : 'center', px: showLabels ? 2.5 : 0 }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <Image src="/prism_logo.png" alt="Prism" width={30} height={30} style={{ objectFit: 'contain' }} />
          {showLabels && (
            <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: -0.5 }}>
              Prism
            </Typography>
          )}
        </Stack>
      </Toolbar>
      <Divider />
      {navList(showLabels)}
      <Box sx={{ p: showLabels ? 2 : 1, pt: 1 }}>
        <Divider sx={{ mb: 1.5 }} />
        {showLabels ? (
          <>
            <Button
              fullWidth
              variant="outlined"
              color="error"
              size="small"
              startIcon={<LogoutIcon />}
              onClick={() => logout()}
              sx={{ mb: 1 }}
            >
              Sign Out
            </Button>
            <Button
              fullWidth
              size="small"
              color="inherit"
              startIcon={<ChevronLeftIcon />}
              onClick={handleToggle}
              sx={{ color: 'text.secondary', display: { xs: 'none', md: 'inline-flex' } }}
            >
              Collapse
            </Button>
          </>
        ) : (
          <Stack spacing={0.5} sx={{ alignItems: 'center' }}>
            <Tooltip title="Sign out" placement="right">
              <IconButton size="small" color="error" onClick={() => logout()}>
                <LogoutIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Expand sidebar" placement="right">
              <IconButton size="small" onClick={handleToggle} sx={{ color: 'text.secondary' }}>
                <ChevronRightIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        )}
      </Box>
    </Box>
  );

  return (
    <Box component="nav" sx={{ width: { md: width }, flexShrink: { md: 0 }, transition: SIDEBAR_TRANSITION }}>
      {/* Mobile: temporary drawer, always full width */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onMobileClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: SIDEBAR_EXPANDED,
            bgcolor: 'background.default',
          },
        }}
      >
        {drawerContent(true)}
      </Drawer>

      {/* Desktop: permanent drawer, collapsible to icon rail */}
      <Drawer
        variant="permanent"
        open
        sx={{
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width,
            overflowX: 'hidden',
            transition: SIDEBAR_TRANSITION,
            background: 'var(--prism-palette-glass-bg)',
            backdropFilter: 'blur(12px) saturate(160%)',
            WebkitBackdropFilter: 'blur(12px) saturate(160%)',
            borderRight: '1px solid',
            borderColor: 'divider',
          },
        }}
        slotProps={{ paper: { className: 'prism-glass' } }}
      >
        {drawerContent(!collapsed)}
      </Drawer>
    </Box>
  );
}
