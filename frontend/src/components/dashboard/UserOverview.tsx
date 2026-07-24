'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import WorkIcon from '@mui/icons-material/Work';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import VisibilityIcon from '@mui/icons-material/Visibility';
import SpeedIcon from '@mui/icons-material/Speed';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import InfoIcon from '@mui/icons-material/InfoOutlined';
import {
  useDeleteApplicationMutation,
  useGetApplicationStatsQuery,
  useGetApplicationsQuery,
} from '../../store/prismApi';
import { useAppDispatch } from '../../store/hooks';
import { showToast } from '../../store/uiSlice';
import type { JobApplication } from '../../services/applications';
import PageHeader from '../ui/PageHeader';
import StatCard from '../ui/StatCard';
import StatusChip from '../ui/StatusChip';
import DataTable, { type DataTableColumn } from '../ui/DataTable';
import EmptyState from '../ui/EmptyState';
import { useConfirm } from '../ui/ConfirmDialog';
import { ChartSkeleton } from '../ui/Skeletons';

const ApplicationsOverTime = dynamic(() => import('../charts/ApplicationsOverTime'), {
  ssr: false,
  loading: () => <ChartSkeleton />,
});
const PipelineFunnel = dynamic(() => import('../charts/PipelineFunnel'), {
  ssr: false,
  loading: () => <ChartSkeleton height={248} />,
});

export default function UserOverview() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const confirm = useConfirm();

  const {
    data: stats,
    isLoading: statsLoading,
    isFetching: statsFetching,
    error: statsError,
  } = useGetApplicationStatsQuery();
  const {
    data: applications,
    isLoading: appsLoading,
    isFetching: appsFetching,
  } = useGetApplicationsQuery();
  const [deleteApplication] = useDeleteApplicationMutation();

  const recentApps = React.useMemo(() => {
    if (!applications) return [];
    return [...applications]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5);
  }, [applications]);

  const handleDeleteApp = async (app: JobApplication) => {
    const ok = await confirm({
      title: 'Delete application?',
      body: `"${app.position}" at ${app.company} will be removed permanently.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteApplication(app.id).unwrap();
      dispatch(showToast({ message: 'Application deleted', severity: 'success' }));
    } catch {
      dispatch(showToast({ message: 'Failed to delete application', severity: 'error' }));
    }
  };

  const columns: DataTableColumn<JobApplication>[] = [
    {
      key: 'company',
      header: 'Company',
      render: (app) => (
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {app.company}
        </Typography>
      ),
    },
    { key: 'position', header: 'Position' },
    {
      key: 'location',
      header: 'Location',
      render: (app) => app.location || 'Remote / not specified',
    },
    {
      key: 'status',
      header: 'Status',
      render: (app) => <StatusChip status={app.status} />,
    },
    {
      key: 'salary',
      header: 'Salary range',
      render: (app) =>
        app.salary_min !== undefined || app.salary_max !== undefined
          ? `$${(app.salary_min || 0).toLocaleString()} - $${(app.salary_max || 0).toLocaleString()}`
          : '-',
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (app) => (
        <IconButton
          color="error"
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            handleDeleteApp(app);
          }}
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      ),
    },
  ];

  const responseRate = stats?.response_rate ?? 0;
  const offerRate = stats?.offer_rate ?? 0;

  return (
    <Box>
      <PageHeader
        title="Overview"
        subtitle="Welcome back! Here is a summary of your job hunting progress."
        actions={
          <Button
            variant="contained"
            startIcon={<WorkIcon />}
            onClick={() => router.push('/dashboard/applications')}
          >
            Manage Applications
          </Button>
        }
      />

      {statsError && (
        <Alert severity="warning" sx={{ mb: 4 }}>
          Failed to load dashboard data. Ensure the backend is running.
        </Alert>
      )}

      {/* KPI row */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            label="Total applications"
            value={stats?.total ?? 0}
            icon={<WorkIcon fontSize="small" />}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            label="Interviewing"
            value={stats?.interviewing ?? 0}
            icon={<VisibilityIcon fontSize="small" />}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            label="Response rate"
            value={`${responseRate.toFixed(1)}%`}
            meter={responseRate}
            icon={<SpeedIcon fontSize="small" />}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            label="Offers"
            value={stats?.offered ?? 0}
            delta={`${offerRate.toFixed(1)}% offer rate`}
            icon={<CheckCircleIcon fontSize="small" />}
          />
        </Grid>
      </Grid>

      {/* Charts */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 7 }}>
          <ApplicationsOverTime
            applications={applications}
            loading={appsLoading}
            refreshing={appsFetching && !appsLoading}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <PipelineFunnel
            stats={stats}
            loading={statsLoading}
            refreshing={statsFetching && !statsLoading}
          />
        </Grid>
      </Grid>

      {/* AI assistant promo */}
      <Card
        sx={{
          mb: 3,
          p: 3,
          bgcolor: 'rgba(13, 148, 136, 0.05)',
          border: '1px solid rgba(13, 148, 136, 0.18)',
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          sx={{ alignItems: { md: 'center' }, justifyContent: 'space-between' }}
        >
          <Box>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
              <AutoAwesomeIcon sx={{ color: 'primary.main' }} fontSize="small" />
              <Typography variant="h6">Meet your AI career assistant</Typography>
            </Stack>
            <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 560 }}>
              It knows your experience, researches companies live, and drafts tailored emails and
              cover letters. Bring your own AI key (OpenAI, Gemini or Claude) — no subscription fees.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1.5} sx={{ flexShrink: 0 }}>
            <Button
              variant="contained"
              endIcon={<ArrowForwardIcon />}
              onClick={() => router.push('/dashboard/assistant')}
            >
              Open Assistant
            </Button>
            <Button variant="outlined" onClick={() => router.push('/dashboard/settings')}>
              Add API Key
            </Button>
          </Stack>
        </Stack>
      </Card>

      {/* Recent applications */}
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Typography variant="h6">Recent Applications</Typography>
        <Button
          size="small"
          onClick={() => router.push('/dashboard/applications')}
          endIcon={<ArrowForwardIcon />}
        >
          View All
        </Button>
      </Stack>
      <DataTable
        columns={columns}
        rows={recentApps}
        getRowKey={(app) => app.id}
        loading={appsLoading}
        emptyState={
          <EmptyState
            dense
            icon={<InfoIcon />}
            title="No applications yet"
            description="Start tracking your job hunt by adding your first application."
            action={
              <Button variant="outlined" size="small" onClick={() => router.push('/dashboard/applications')}>
                Add one now
              </Button>
            }
          />
        }
      />
    </Box>
  );
}
