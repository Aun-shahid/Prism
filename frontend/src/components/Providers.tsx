'use client';

import * as React from 'react';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { LazyMotion, domAnimation, MotionConfig } from 'motion/react';
import { Provider as ReduxProvider } from 'react-redux';
import theme from '../theme';
import { store } from '../store';
import { AuthProvider } from '../hooks/useAuth';
import AppToaster from './ui/AppToaster';
import { ConfirmProvider } from './ui/ConfirmDialog';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AppRouterCacheProvider>
      <ThemeProvider theme={theme} defaultMode="light">
        <CssBaseline />
        <ReduxProvider store={store}>
          <AuthProvider>
            <ConfirmProvider>
              <LazyMotion features={domAnimation} strict>
                <MotionConfig reducedMotion="user">{children}</MotionConfig>
              </LazyMotion>
            </ConfirmProvider>
          </AuthProvider>
          <AppToaster />
        </ReduxProvider>
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
