'use client';

import * as React from 'react';
import Card, { type CardProps } from '@mui/material/Card';

/** Card with an opt-in hover lift (CSS-only — cheaper than a motion component). */
export default function HoverCard({ sx, ...props }: CardProps) {
  return (
    <Card
      sx={[
        {
          transition: 'transform 150ms ease, box-shadow 150ms ease',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: '0 8px 24px rgba(15, 23, 42, 0.10)',
          },
          '@media (prefers-reduced-motion: reduce)': {
            transition: 'none',
            '&:hover': { transform: 'none' },
          },
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...props}
    />
  );
}
