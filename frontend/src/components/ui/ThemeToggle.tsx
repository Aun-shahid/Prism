'use client';

import * as React from 'react';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import { useColorScheme } from '@mui/material/styles';

const emptySubscribe = () => () => {};

export default function ThemeToggle() {
  const { mode, setMode } = useColorScheme();
  // true after hydration, false during SSR — without a cascading effect render
  const mounted = React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  // mode is undefined during SSR; render a stable placeholder until mounted
  if (!mounted || !mode) {
    return (
      <IconButton size="small" disabled aria-label="Toggle theme">
        <LightModeOutlinedIcon fontSize="small" />
      </IconButton>
    );
  }

  const isDark = mode === 'dark';
  return (
    <Tooltip title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
      <IconButton
        size="small"
        aria-label="Toggle theme"
        onClick={() => setMode(isDark ? 'light' : 'dark')}
        sx={{ color: 'text.secondary' }}
      >
        {isDark ? (
          <LightModeOutlinedIcon fontSize="small" />
        ) : (
          <DarkModeOutlinedIcon fontSize="small" />
        )}
      </IconButton>
    </Tooltip>
  );
}
