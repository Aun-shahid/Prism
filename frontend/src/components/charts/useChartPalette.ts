'use client';

import { useColorScheme } from '@mui/material/styles';
import { CHART, type ChartTokens } from '../../theme/tokens';

export interface ChartPalette extends ChartTokens {
  axisText: string;
  labelText: string;
  tooltipBg: string;
  tooltipBorder: string;
}

/**
 * Literal hex palette for Recharts marks — SVG presentation attributes can't
 * resolve CSS var(), so charts read the same constants the theme's CSS vars
 * are generated from (they can't drift).
 */
export function useChartPalette(): ChartPalette {
  const { mode } = useColorScheme();
  const dark = mode === 'dark';
  return {
    ...(dark ? CHART.dark : CHART.light),
    axisText: dark ? '#94a3a0' : '#475569',
    labelText: dark ? '#f0f4f3' : '#0f172a',
    tooltipBg: dark ? '#132120' : '#ffffff',
    tooltipBorder: dark ? 'rgba(255, 255, 255, 0.10)' : 'rgba(15, 23, 42, 0.10)',
  };
}
