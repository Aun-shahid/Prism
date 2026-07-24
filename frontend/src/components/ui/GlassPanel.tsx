'use client';

import * as React from 'react';
import Paper, { type PaperProps } from '@mui/material/Paper';

/**
 * Frosted-glass surface for app chrome (sidebar, topbar, floating cards).
 * Fallbacks for unsupported browsers / prefers-reduced-transparency live in
 * globals.css under the .prism-glass class.
 */
export default function GlassPanel({ sx, className, ...props }: PaperProps) {
  return (
    <Paper
      elevation={0}
      className={className ? `prism-glass ${className}` : 'prism-glass'}
      sx={[
        {
          background: 'var(--prism-palette-glass-bg)',
          backdropFilter: 'blur(12px) saturate(160%)',
          WebkitBackdropFilter: 'blur(12px) saturate(160%)',
          border: '1px solid var(--prism-palette-glass-border)',
          boxShadow: 'var(--prism-palette-glass-shadow)',
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...props}
    />
  );
}
