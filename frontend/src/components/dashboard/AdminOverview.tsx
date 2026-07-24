'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import PeopleIcon from '@mui/icons-material/People';
import SearchIcon from '@mui/icons-material/Search';
import LanguageIcon from '@mui/icons-material/Language';
import WorkIcon from '@mui/icons-material/Work';
import SpeedIcon from '@mui/icons-material/Speed';
import { useGetAdminStatsQuery } from '../../store/prismApi';
import PageHeader from '../ui/PageHeader';
import StatCard from '../ui/StatCard';

export default function AdminOverview() {
  const router = useRouter();
  const { data: adminStats, error } = useGetAdminStatsQuery();

  const cards = [
    {
      label: 'Registered users',
      count: adminStats?.total_users ?? 0,
      icon: <PeopleIcon fontSize="small" />,
      path: '/dashboard?tab=users',
    },
    {
      label: 'Scraped jobs (total)',
      count: adminStats?.total_jobs ?? 0,
      icon: <SearchIcon fontSize="small" />,
      path: '/dashboard/watchlist',
    },
    {
      label: 'General crawler feeds',
      count: adminStats?.total_sources ?? 0,
      icon: <LanguageIcon fontSize="small" />,
      path: '/dashboard/watchlist',
    },
    {
      label: 'Career targets',
      count: adminStats?.total_targets ?? 0,
      icon: <WorkIcon fontSize="small" />,
      path: '/dashboard/watchlist',
    },
  ];

  return (
    <Box>
      <PageHeader
        title="System Admin Overview"
        subtitle="Platform-wide configuration, scraper feeds, and user status monitoring."
        actions={
          <Button
            variant="contained"
            startIcon={<PeopleIcon />}
            onClick={() => router.push('/dashboard?tab=users')}
          >
            Manage Users
          </Button>
        }
      />

      {error && (
        <Alert severity="warning" sx={{ mb: 4 }}>
          Failed to load admin stats. Ensure the backend is running.
        </Alert>
      )}

      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        {cards.map((card) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={card.label}>
            <Box onClick={() => router.push(card.path)} sx={{ cursor: 'pointer', height: '100%' }}>
              <StatCard label={card.label} value={card.count} icon={card.icon} />
            </Box>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 2.5 }}>
                <Box
                  sx={{
                    p: 1,
                    borderRadius: 2,
                    bgcolor: 'rgba(8, 145, 178, 0.10)',
                    color: 'info.main',
                    display: 'flex',
                  }}
                >
                  <SpeedIcon fontSize="small" />
                </Box>
                <Typography variant="h6">Platform Administration</Typography>
              </Stack>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
                As an administrator, you configure the target locations and sources used by the
                global background scheduler. This avoids overloading search endpoints and prevents
                database bloating.
              </Typography>
              <Stack spacing={1.5}>
                <Button variant="outlined" fullWidth onClick={() => router.push('/dashboard/watchlist')}>
                  Configure Target Locations & RSS
                </Button>
                <Button variant="outlined" fullWidth onClick={() => router.push('/dashboard?tab=users')}>
                  Promote Users or Toggle Roles
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card
            sx={{
              height: '100%',
              bgcolor: 'rgba(13, 148, 136, 0.05)',
              border: '1px solid rgba(13, 148, 136, 0.18)',
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ color: 'primary.main', mb: 1 }}>
                Super Admin Console Active
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
                You have full write access to general search configurations, platform user roles,
                and database controls. Keep crawler presets configured with location filters to
                protect background worker resources.
              </Typography>
              <Chip
                label="Admin mode: Enabled"
                sx={{ bgcolor: 'rgba(13, 148, 136, 0.12)', color: 'primary.dark', fontWeight: 700 }}
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
