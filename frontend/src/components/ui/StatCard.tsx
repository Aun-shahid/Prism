'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import AnimatedNumber from './AnimatedNumber';

interface StatCardProps {
  label: string;
  value: number | string;
  icon?: React.ReactNode;
  /** Small helper line under the value, e.g. "+3 this week". */
  delta?: string;
  /** 0-100; renders a thin meter bar under the value (use for rates/ratios). */
  meter?: number;
  format?: (n: number) => string;
}

export default function StatCard({ label, value, icon, delta, meter, format }: StatCardProps) {
  return (
    <Card sx={{ p: 2.5, height: '100%' }}>
      <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="overline"
            sx={{ color: 'text.secondary', fontWeight: 600, letterSpacing: '0.08em', lineHeight: 1.6 }}
          >
            {label}
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 700, mt: 0.5 }}>
            {typeof value === 'number' ? <AnimatedNumber value={value} format={format} /> : value}
          </Typography>
          {delta && (
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
              {delta}
            </Typography>
          )}
        </Box>
        {icon && (
          <Box
            sx={{
              width: 42,
              height: 42,
              borderRadius: 2.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'rgba(13, 148, 136, 0.10)',
              color: 'primary.main',
              flexShrink: 0,
            }}
          >
            {icon}
          </Box>
        )}
      </Stack>
      {typeof meter === 'number' && (
        <Box
          sx={{
            mt: 2,
            height: 6,
            borderRadius: 3,
            bgcolor: 'rgba(13, 148, 136, 0.12)',
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              height: '100%',
              width: `${Math.max(0, Math.min(100, meter))}%`,
              borderRadius: 3,
              bgcolor: 'primary.main',
              transition: 'width 400ms ease',
            }}
          />
        </Box>
      )}
    </Card>
  );
}
