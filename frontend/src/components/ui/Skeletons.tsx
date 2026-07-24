'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';

export function StatRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <Grid container spacing={2.5} sx={{ mb: 3 }}>
      {Array.from({ length: count }, (_, i) => (
        <Grid key={i} size={{ xs: 12, sm: 6, md: 12 / count }}>
          <Card sx={{ p: 2.5 }}>
            <Skeleton width="55%" height={18} />
            <Skeleton width="35%" height={40} sx={{ mt: 1 }} />
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}

export function TableSkeleton({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <Card sx={{ p: 2.5 }}>
      <Skeleton width="30%" height={26} sx={{ mb: 2 }} />
      {Array.from({ length: rows }, (_, r) => (
        <Stack key={r} direction="row" spacing={2} sx={{ py: 1.25 }}>
          {Array.from({ length: columns }, (_, c) => (
            <Skeleton key={c} height={20} sx={{ flex: c === 0 ? 2 : 1 }} />
          ))}
        </Stack>
      ))}
    </Card>
  );
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <Grid container spacing={2.5}>
      {Array.from({ length: count }, (_, i) => (
        <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}>
          <Card sx={{ p: 2.5 }}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 2 }}>
              <Skeleton variant="circular" width={40} height={40} />
              <Box sx={{ flex: 1 }}>
                <Skeleton width="60%" height={22} />
                <Skeleton width="40%" height={16} />
              </Box>
            </Stack>
            <Skeleton height={16} />
            <Skeleton height={16} width="80%" />
            <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
              <Skeleton variant="rounded" width={64} height={24} />
              <Skeleton variant="rounded" width={64} height={24} />
            </Stack>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}

export function FeedSkeleton({ count = 4 }: { count?: number }) {
  return (
    <Stack spacing={2}>
      {Array.from({ length: count }, (_, i) => (
        <Card key={i} sx={{ p: 2.5 }}>
          <Skeleton width="45%" height={24} />
          <Skeleton width="25%" height={18} sx={{ mb: 1 }} />
          <Skeleton height={16} />
          <Skeleton height={16} width="70%" />
        </Card>
      ))}
    </Stack>
  );
}

export function ChartSkeleton({ height = 280 }: { height?: number }) {
  return (
    <Card sx={{ p: 2.5 }}>
      <Skeleton width="35%" height={24} sx={{ mb: 2 }} />
      <Skeleton variant="rounded" height={height - 70} />
    </Card>
  );
}

export function PageSkeleton() {
  return (
    <Box>
      <Skeleton width={260} height={42} sx={{ mb: 0.5 }} />
      <Skeleton width={380} height={22} sx={{ mb: 4 }} />
      <StatRowSkeleton />
      <TableSkeleton />
    </Box>
  );
}
