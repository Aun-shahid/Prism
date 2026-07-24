'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Chip, { type ChipProps } from '@mui/material/Chip';
import type { ApplicationStatus } from '../../services/applications';

const LABELS: Record<ApplicationStatus, string> = {
  wishlist: 'Wishlist',
  applied: 'Applied',
  interviewing: 'Interviewing',
  offered: 'Offered',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

interface StatusChipProps extends Omit<ChipProps, 'label' | 'color'> {
  status: ApplicationStatus;
}

/** Application-status pill fed by the palette.appStatus tokens (theme-aware). */
export default function StatusChip({ status, size = 'small', sx, ...props }: StatusChipProps) {
  const label = LABELS[status] ?? status;
  return (
    <Chip
      size={size}
      label={label}
      icon={
        <Box
          component="span"
          sx={(t) => {
            const pal = (t.vars ?? t).palette;
            return {
              width: 7,
              height: 7,
              borderRadius: '50%',
              ml: 0.75,
              bgcolor: pal.appStatus[status]?.fg ?? pal.text.secondary,
            };
          }}
        />
      }
      sx={[
        (t) => {
          const pal = (t.vars ?? t).palette;
          return {
            bgcolor: pal.appStatus[status]?.bg ?? pal.action.hover,
            color: pal.appStatus[status]?.fg ?? pal.text.secondary,
            '& .MuiChip-icon': { color: 'inherit' },
          };
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...props}
    />
  );
}
