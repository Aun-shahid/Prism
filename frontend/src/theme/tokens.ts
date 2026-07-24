/**
 * Design tokens shared by the MUI theme (where they become CSS variables,
 * e.g. --prism-palette-chart-c1) and plain JS consumers (Recharts needs
 * literal hexes because SVG presentation attributes can't resolve var()).
 *
 * Chart palettes were validated with the dataviz palette validator for both
 * surfaces (light #ffffff, dark #132120) — do not tweak values without
 * re-running it.
 */

export interface ChartTokens {
  c1: string;
  c2: string;
  c3: string;
  c4: string;
  c5: string;
  grid: string;
  funnel: string[];
}

export const CHART: { light: ChartTokens; dark: ChartTokens } = {
  light: {
    c1: '#0d9488',
    c2: '#d97706',
    c3: '#1d4ed8',
    c4: '#e11d48',
    c5: '#0891b2',
    grid: 'rgba(15, 23, 42, 0.06)',
    funnel: ['#14b8a6', '#0d9488', '#115e59', '#042f2e'],
  },
  dark: {
    c1: '#0d9488',
    c2: '#d97706',
    c3: '#3b82f6',
    c4: '#e11d48',
    c5: '#0891b2',
    grid: 'rgba(255, 255, 255, 0.06)',
    funnel: ['#5eead4', '#2dd4bf', '#0d9488', '#0f766e'],
  },
};

export interface StatusToken {
  fg: string;
  bg: string;
}

export interface StatusTokens {
  wishlist: StatusToken;
  applied: StatusToken;
  interviewing: StatusToken;
  offered: StatusToken;
  rejected: StatusToken;
  withdrawn: StatusToken;
}

export const STATUS: { light: StatusTokens; dark: StatusTokens } = {
  light: {
    wishlist: { fg: '#57534e', bg: '#f5f5f4' },
    applied: { fg: '#1d4ed8', bg: '#eff6ff' },
    interviewing: { fg: '#b45309', bg: '#fef3c7' },
    offered: { fg: '#0f766e', bg: '#ccfbf1' },
    rejected: { fg: '#b91c1c', bg: '#fee2e2' },
    withdrawn: { fg: '#64748b', bg: '#f1f5f9' },
  },
  dark: {
    wishlist: { fg: '#d6d3d1', bg: 'rgba(120, 113, 108, 0.15)' },
    applied: { fg: '#93c5fd', bg: 'rgba(59, 130, 246, 0.15)' },
    interviewing: { fg: '#fcd34d', bg: 'rgba(245, 158, 11, 0.15)' },
    offered: { fg: '#5eead4', bg: 'rgba(20, 184, 166, 0.15)' },
    rejected: { fg: '#fca5a5', bg: 'rgba(239, 68, 68, 0.15)' },
    withdrawn: { fg: '#cbd5e1', bg: 'rgba(100, 116, 139, 0.15)' },
  },
};

export type ApplicationStatusKey = keyof StatusTokens;

export interface GlassTokens {
  bg: string;
  border: string;
  shadow: string;
}

export const GLASS: { light: GlassTokens; dark: GlassTokens } = {
  light: {
    bg: 'rgba(255, 255, 255, 0.60)',
    border: 'rgba(255, 255, 255, 0.55)',
    shadow: '0 8px 32px rgba(15, 23, 42, 0.08)',
  },
  dark: {
    bg: 'rgba(19, 33, 32, 0.55)',
    border: 'rgba(255, 255, 255, 0.08)',
    shadow: '0 8px 32px rgba(0, 0, 0, 0.35)',
  },
};

/** Display font stack for headings; body text uses Inter Variable. */
export const DISPLAY_FONT =
  "'Bricolage Grotesque Variable', 'Inter Variable', system-ui, sans-serif";
export const BODY_FONT =
  "'Inter Variable', system-ui, -apple-system, 'Segoe UI', sans-serif";
