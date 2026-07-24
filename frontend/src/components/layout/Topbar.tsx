'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import AppBar from '@mui/material/AppBar';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import MenuIcon from '@mui/icons-material/Menu';
import { useAppSelector } from '../../store/hooks';
import ThemeToggle from '../ui/ThemeToggle';
import NotificationsBell from './NotificationsBell';
import UserMenu from './UserMenu';
import { getRouteTitle, SIDEBAR_EXPANDED, SIDEBAR_RAIL } from './nav';

interface TopbarProps {
  onMenuClick: () => void;
}

export default function Topbar({ onMenuClick }: TopbarProps) {
  const pathname = usePathname();
  const collapsed = useAppSelector((s) => s.ui.sidebarCollapsed);
  const sidebarWidth = collapsed ? SIDEBAR_RAIL : SIDEBAR_EXPANDED;

  return (
    <AppBar
      position="fixed"
      elevation={0}
      className="prism-glass"
      sx={{
        width: { md: `calc(100% - ${sidebarWidth}px)` },
        ml: { md: `${sidebarWidth}px` },
        transition: 'width 225ms cubic-bezier(0.4, 0, 0.2, 1), margin 225ms cubic-bezier(0.4, 0, 0.2, 1)',
        background: 'var(--prism-palette-glass-bg)',
        backdropFilter: 'blur(12px) saturate(160%)',
        WebkitBackdropFilter: 'blur(12px) saturate(160%)',
        borderBottom: '1px solid',
        borderColor: 'divider',
        color: 'text.primary',
      }}
    >
      <Toolbar sx={{ justifyContent: 'space-between' }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <IconButton
            aria-label="open navigation"
            edge="start"
            onClick={onMenuClick}
            sx={{ display: { md: 'none' }, color: 'text.primary' }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap sx={{ fontWeight: 700 }}>
            {getRouteTitle(pathname)}
          </Typography>
        </Stack>

        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <ThemeToggle />
          <NotificationsBell />
          <UserMenu />
        </Stack>
      </Toolbar>
    </AppBar>
  );
}
