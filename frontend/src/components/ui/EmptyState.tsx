'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  /** Compact spacing for use inside cards/popovers. */
  dense?: boolean;
}

export default function EmptyState({ icon, title, description, action, dense }: EmptyStateProps) {
  return (
    <Box
      sx={{
        py: dense ? 4 : 8,
        px: 3,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
      }}
    >
      {icon && (
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'rgba(13, 148, 136, 0.10)',
            color: 'primary.main',
            mb: 2,
            '& svg': { fontSize: 28 },
          }}
        >
          {icon}
        </Box>
      )}
      <Typography variant="h6" sx={{ mb: description ? 0.5 : 0 }}>
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
          {description}
        </Typography>
      )}
      {action && <Box sx={{ mt: 2.5 }}>{action}</Box>}
    </Box>
  );
}
