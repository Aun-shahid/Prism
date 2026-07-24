'use client';

import { createTheme } from '@mui/material/styles';
import {
  BODY_FONT,
  CHART,
  DISPLAY_FONT,
  GLASS,
  STATUS,
  type ChartTokens,
  type GlassTokens,
  type StatusTokens,
} from './tokens';

declare module '@mui/material/styles' {
  interface Palette {
    chart: ChartTokens;
    appStatus: StatusTokens;
    glass: GlassTokens;
  }
  interface PaletteOptions {
    chart?: ChartTokens;
    appStatus?: StatusTokens;
    glass?: GlassTokens;
  }
}

const headingStyles = {
  fontFamily: DISPLAY_FONT,
  fontWeight: 700,
};

const theme = createTheme({
  cssVariables: {
    cssVarPrefix: 'prism',
    colorSchemeSelector: 'data',
  },
  colorSchemes: {
    light: {
      palette: {
        primary: {
          main: '#0d9488',
          light: '#14b8a6',
          dark: '#0f766e',
          contrastText: '#ffffff',
        },
        secondary: {
          main: '#d97706',
          light: '#f59e0b',
          dark: '#b45309',
          contrastText: '#ffffff',
        },
        error: { main: '#dc2626' },
        warning: { main: '#d97706' },
        info: { main: '#0891b2' },
        success: { main: '#059669' },
        background: { default: '#f7f6f2', paper: '#ffffff' },
        text: { primary: '#0f172a', secondary: '#475569' },
        divider: 'rgba(15, 23, 42, 0.08)',
        chart: CHART.light,
        appStatus: STATUS.light,
        glass: GLASS.light,
      },
    },
    dark: {
      palette: {
        primary: {
          main: '#2dd4bf',
          light: '#5eead4',
          dark: '#14b8a6',
          contrastText: '#042f2e',
        },
        secondary: {
          main: '#f59e0b',
          light: '#fbbf24',
          dark: '#d97706',
          contrastText: '#1c1204',
        },
        error: { main: '#f87171' },
        warning: { main: '#fbbf24' },
        info: { main: '#22d3ee' },
        success: { main: '#34d399' },
        background: { default: '#0e1514', paper: '#132120' },
        text: { primary: '#f0f4f3', secondary: '#94a3a0' },
        divider: 'rgba(255, 255, 255, 0.08)',
        chart: CHART.dark,
        appStatus: STATUS.dark,
        glass: GLASS.dark,
      },
    },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: BODY_FONT,
    h1: { ...headingStyles, letterSpacing: '-0.02em' },
    h2: { ...headingStyles, letterSpacing: '-0.02em' },
    h3: { ...headingStyles, letterSpacing: '-0.01em' },
    h4: { ...headingStyles, letterSpacing: '-0.01em' },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: (themeParam) => ({
        body: {
          // Soft teal mesh behind the glass chrome; last layer is the opaque base.
          backgroundImage: [
            'radial-gradient(600px 400px at 8% -5%, rgba(13, 148, 136, 0.10), transparent 60%)',
            'radial-gradient(500px 380px at 100% 0%, rgba(245, 158, 11, 0.06), transparent 55%)',
            'radial-gradient(700px 500px at 50% 110%, rgba(13, 148, 136, 0.05), transparent 60%)',
          ].join(', '),
          backgroundAttachment: 'fixed',
          backgroundColor: themeParam.vars.palette.background.default,
          ...themeParam.applyStyles('dark', {
            backgroundImage: [
              'radial-gradient(600px 400px at 8% -5%, rgba(45, 212, 191, 0.07), transparent 60%)',
              'radial-gradient(700px 500px at 50% 110%, rgba(13, 148, 136, 0.05), transparent 60%)',
            ].join(', '),
          }),
        },
      }),
    },
    MuiButton: {
      styleOverrides: {
        root: ({ theme: t }) => ({
          borderRadius: 10,
          padding: '8px 18px',
          '&.MuiButton-containedPrimary': {
            boxShadow: '0 1px 2px rgba(15, 23, 42, 0.08)',
            '&:hover': {
              backgroundColor: t.vars.palette.primary.light,
              boxShadow: '0 2px 6px rgba(15, 23, 42, 0.12)',
            },
            '&:active': {
              backgroundColor: t.vars.palette.primary.dark,
            },
          },
        }),
      },
    },
    MuiCard: {
      styleOverrides: {
        root: ({ theme: t }) => ({
          borderRadius: 14,
          backgroundImage: 'none',
          border: `1px solid ${t.vars.palette.divider}`,
          boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05)',
        }),
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 16,
          boxShadow: '0 24px 64px rgba(15, 23, 42, 0.18)',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 8, fontWeight: 600 },
        sizeSmall: { height: 24 },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: { height: 3, borderRadius: 3 },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 600 },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: ({ theme: t }) => ({
          borderRadius: 10,
          backgroundColor: t.vars.palette.background.paper,
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: t.vars.palette.primary.main,
          },
        }),
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: ({ theme: t }) => ({
          borderBottomColor: t.vars.palette.divider,
        }),
        head: ({ theme: t }) => ({
          fontSize: 12,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: t.vars.palette.text.secondary,
        }),
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: ({ theme: t }) => ({
          backgroundColor: '#0f172a',
          borderRadius: 8,
          fontSize: 12,
          ...t.applyStyles('dark', { backgroundColor: '#334155' }),
        }),
        arrow: ({ theme: t }) => ({
          color: '#0f172a',
          ...t.applyStyles('dark', { color: '#334155' }),
        }),
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: { borderRadius: 8 },
      },
    },
  },
});

export default theme;
