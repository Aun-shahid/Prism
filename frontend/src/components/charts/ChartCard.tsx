'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  height?: number;
  /** First load — renders a skeleton block. */
  loading?: boolean;
  /** Background refetch — keeps the previous render, slightly dimmed. */
  refreshing?: boolean;
  /** When true, renders emptyState instead of children. */
  empty?: boolean;
  emptyState?: React.ReactNode;
  children: React.ReactNode;
}

export default function ChartCard({
  title,
  subtitle,
  height = 280,
  loading,
  refreshing,
  empty,
  emptyState,
  children,
}: ChartCardProps) {
  return (
    <Card sx={{ p: 2.5, height: '100%' }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
        {title}
      </Typography>
      {subtitle && (
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
          {subtitle}
        </Typography>
      )}
      <Box
        sx={{
          height,
          mt: 1.5,
          opacity: refreshing ? 0.55 : 1,
          transition: 'opacity 200ms ease',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        {loading ? (
          <Skeleton variant="rounded" height="100%" />
        ) : empty ? (
          emptyState ?? (
            <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
              No data yet
            </Typography>
          )
        ) : (
          children
        )}
      </Box>
    </Card>
  );
}
