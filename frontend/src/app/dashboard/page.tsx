'use client';

import * as React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import { usersService, User } from '../../services/users';
import { applicationsService, JobApplication, ApplicationStats } from '../../services/applications';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Stack,
  Alert,
  CircularProgress,
  LinearProgress,
  Divider,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import WorkIcon from '@mui/icons-material/Work';
import StarIcon from '@mui/icons-material/Star';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CancelIcon from '@mui/icons-material/Cancel';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import InfoIcon from '@mui/icons-material/Info';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import AssessmentIcon from '@mui/icons-material/Assessment';
import SpeedIcon from '@mui/icons-material/Speed';
import PeopleIcon from '@mui/icons-material/People';
import LanguageIcon from '@mui/icons-material/Language';
import SearchIcon from '@mui/icons-material/Search';

export default function DashboardPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const currentTab = searchParams.get('tab') || 'overview';

  // Stats and applications state
  const [stats, setStats] = React.useState<ApplicationStats | null>(null);
  const [recentApps, setRecentApps] = React.useState<JobApplication[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // User Management State (Admin only)
  const [usersList, setUsersList] = React.useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = React.useState(false);
  const [adminError, setAdminError] = React.useState<string | null>(null);

  const [adminStats, setAdminStats] = React.useState({
    total_users: 0,
    total_targets: 0,
    total_jobs: 0,
    total_sources: 0
  });

  const fetchDashboardData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (user?.role === 'super_admin') {
        const [statsData, appsData, adminStatsData] = await Promise.all([
          applicationsService.getStats(),
          applicationsService.listApplications(),
          usersService.getAdminStats()
        ]);
        setStats(statsData);
        setAdminStats(adminStatsData);
        const sorted = [...appsData].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setRecentApps(sorted.slice(0, 5));
      } else {
        const [statsData, appsData] = await Promise.all([
          applicationsService.getStats(),
          applicationsService.listApplications()
        ]);
        setStats(statsData);
        const sorted = [...appsData].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setRecentApps(sorted.slice(0, 5));
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load dashboard data. Ensure backend is running.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchUsers = React.useCallback(async () => {
    if (user?.role !== 'super_admin') return;
    setLoadingUsers(true);
    setAdminError(null);
    try {
      const data = await usersService.listUsers();
      setUsersList(data);
    } catch (err: any) {
      setAdminError(err.response?.data?.detail || 'Failed to retrieve users');
    } finally {
      setLoadingUsers(false);
    }
  }, [user]);

  React.useEffect(() => {
    if (currentTab === 'users') {
      fetchUsers();
    } else {
      fetchDashboardData();
    }
  }, [currentTab, fetchDashboardData, fetchUsers]);

  // Admin user actions
  const handleToggleAdminStatus = async (userId: string, currentStatus: boolean) => {
    try {
      await usersService.updateUser(userId, { is_active: !currentStatus });
      fetchUsers();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to update user status');
    }
  };

  const handleToggleAdminRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'super_admin' ? 'user' : 'super_admin';
    try {
      await usersService.updateUser(userId, { role: newRole as 'super_admin' | 'user' });
      fetchUsers();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to update user role');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      await usersService.deleteUser(userId);
      fetchUsers();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to delete user');
    }
  };

  const handleDeleteApp = async (id: string) => {
    if (!confirm('Are you sure you want to delete this application?')) return;
    try {
      await applicationsService.deleteApplication(id);
      fetchDashboardData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to delete application');
    }
  };

  const getStatusChipColor = (status: string) => {
    switch (status) {
      case 'wishlist': return 'default';
      case 'applied': return 'primary';
      case 'interviewing': return 'warning';
      case 'offered': return 'success';
      case 'rejected': return 'error';
      case 'withdrawn': return 'secondary';
      default: return 'default';
    }
  };

  // --- RENDERS ---

  // Admin Panel Tab View
  if (currentTab === 'users' && user?.role === 'super_admin') {
    return (
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 4 }}>
          User Management
        </Typography>

        {adminError && <Alert severity="error" sx={{ mb: 3 }}>{adminError}</Alert>}

        {loadingUsers ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer component={Paper} sx={{ border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Username</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Email</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Role</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {usersList.map((usr) => (
                  <TableRow key={usr.id}>
                    <TableCell>{usr.name}</TableCell>
                    <TableCell>{usr.username || '-'}</TableCell>
                    <TableCell>{usr.email}</TableCell>
                    <TableCell>
                      <Chip 
                        label={usr.role} 
                        color={usr.role === 'super_admin' ? 'secondary' : 'default'}
                        size="small" 
                      />
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={usr.is_active ? 'Active' : 'Inactive'} 
                        color={usr.is_active ? 'success' : 'error'} 
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                        <Button 
                          size="small" 
                          variant="outlined" 
                          onClick={() => handleToggleAdminRole(usr.id, usr.role)}
                        >
                          Role
                        </Button>
                        <Button 
                          size="small" 
                          variant="outlined"
                          color={usr.is_active ? 'warning' : 'success'}
                          onClick={() => handleToggleAdminStatus(usr.id, usr.is_active)}
                        >
                          {usr.is_active ? 'Block' : 'Activate'}
                        </Button>
                        <IconButton 
                          color="error" 
                          disabled={usr.id === user?.id} 
                          onClick={() => handleDeleteUser(usr.id)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
    );
  }

  // Dashboard Overview View
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (user?.role === 'super_admin' && currentTab === 'overview') {
    return (
      <Box>
        <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: -0.5 }}>
              System Admin Overview
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
              Welcome back, Administrator. Platform-wide configuration, scraper feeds, and user status monitoring.
            </Typography>
          </Box>
          <Button 
            variant="contained" 
            startIcon={<PeopleIcon />} 
            onClick={() => router.push('/dashboard?tab=users')}
            sx={{ 
              background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
              boxShadow: '0 4px 12px rgba(236,72,153,0.3)'
            }}
          >
            Manage Users
          </Button>
        </Stack>

        {error && <Alert severity="warning" sx={{ mb: 4 }}>{error}</Alert>}

        {/* Admin Stats Grid */}
        <Grid container spacing={3} sx={{ mb: 5 }}>
          {[
            { label: 'Registered Users', count: adminStats.total_users, color: '#ec4899', icon: <PeopleIcon />, path: '/dashboard?tab=users' },
            { label: 'Scraped Jobs (Total)', count: adminStats.total_jobs, color: '#3b82f6', icon: <SearchIcon />, path: '/dashboard/watchlist' },
            { label: 'General Crawler Feeds', count: adminStats.total_sources, color: '#f59e0b', icon: <LanguageIcon />, path: '/dashboard/watchlist' },
            { label: 'Career Targets', count: adminStats.total_targets, color: '#10b981', icon: <WorkIcon />, path: '/dashboard/watchlist' }
          ].map((card) => (
            <Grid size={{ xs: 12, sm: 6, md: 3 }} key={card.label}>
              <Card 
                sx={{ 
                  borderLeft: `4px solid ${card.color}`, 
                  bgcolor: 'rgba(255, 255, 255, 0.01)',
                  cursor: 'pointer',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' }
                }}
                onClick={() => router.push(card.path)}
              >
                <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 3 }}>
                  <Box>
                    <Typography variant="subtitle2" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                      {card.label}
                    </Typography>
                    <Typography variant="h3" sx={{ fontWeight: 800, mt: 1 }}>
                      {card.count}
                    </Typography>
                  </Box>
                  <Box sx={{ p: 1.5, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.04)', color: card.color }}>
                    {card.icon}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        <Grid container spacing={3} sx={{ mb: 5 }}>
          {/* Scraper controls and diagnostic card */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ p: 3 }}>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 3 }}>
                  <Box sx={{ p: 1, borderRadius: 1, bgcolor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
                    <SpeedIcon />
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Platform Administration
                  </Typography>
                </Stack>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
                  As an administrator, you configure the target locations and sources used by the global background scheduler. This avoids overloading search endpoints (e.g. LinkedIn API) and prevents database bloating.
                </Typography>
                
                <Stack spacing={2}>
                  <Button 
                    variant="outlined" 
                    fullWidth 
                    onClick={() => router.push('/dashboard/watchlist')}
                  >
                    Configure Target Locations & RSS
                  </Button>
                  <Button 
                    variant="outlined" 
                    fullWidth 
                    onClick={() => router.push('/dashboard?tab=users')}
                  >
                    Promote Users or Toggle Roles
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {/* System Info card */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card sx={{ height: '100%', background: 'linear-gradient(145deg, rgba(17, 24, 39, 0.8) 0%, rgba(9, 13, 22, 0.9) 100%)' }}>
              <CardContent sx={{ p: 4 }}>
                <Typography variant="h5" sx={{ fontWeight: 800, mb: 1, color: '#ec4899' }}>
                  Super Admin Console Active
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
                  You have full write access to general search configurations, platform user roles, and database controls. Ensure that crawler presets remain configured with location filters (e.g., United Kingdom) to protect background worker resources.
                </Typography>
                <Chip label="Admin mode: Enabled" color="secondary" sx={{ fontWeight: 700 }} />
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    );
  }

  const wishlistCount = stats?.wishlist || 0;
  const appliedCount = stats?.applied || 0;
  const interviewingCount = stats?.interviewing || 0;
  const offeredCount = stats?.offered || 0;
  const rejectedCount = stats?.rejected || 0;
  const responseRate = stats?.response_rate || 0;
  const offerRate = stats?.offer_rate || 0;

  return (
    <Box>
      <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: -0.5 }}>
            Overview Dashboard
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            Welcome back! Here is a summary of your job hunting progress.
          </Typography>
        </Box>
        <Button 
          variant="contained" 
          startIcon={<WorkIcon />} 
          onClick={() => router.push('/dashboard/applications')}
          sx={{ 
            background: 'linear-gradient(135deg, #7c3aed 0%, #10b981 100%)',
            boxShadow: '0 4px 12px rgba(124,58,237,0.3)'
          }}
        >
          Manage Applications
        </Button>
      </Stack>

      {error && <Alert severity="warning" sx={{ mb: 4 }}>{error}</Alert>}

      {/* Pipeline Stats Grid */}
      <Grid container spacing={3} sx={{ mb: 5 }}>
        {[
          { label: 'Wishlist', count: wishlistCount, color: '#9ca3af', icon: <StarIcon /> },
          { label: 'Applied', count: appliedCount, color: '#3b82f6', icon: <HourglassEmptyIcon /> },
          { label: 'Interviewing', count: interviewingCount, color: '#f59e0b', icon: <VisibilityIcon /> },
          { label: 'Offered', count: offeredCount, color: '#10b981', icon: <CheckCircleIcon /> }
        ].map((card) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={card.label}>
            <Card sx={{ borderLeft: `4px solid ${card.color}` }}>
              <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 3 }}>
                <Box>
                  <Typography variant="subtitle2" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                    {card.label}
                  </Typography>
                  <Typography variant="h3" sx={{ fontWeight: 800, mt: 1 }}>
                    {card.count}
                  </Typography>
                </Box>
                <Box sx={{ p: 1.5, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.04)', color: card.color }}>
                  {card.icon}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Metrics and Rates Card */}
      <Grid container spacing={3} sx={{ mb: 5 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ p: 3 }}>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 3 }}>
                <Box sx={{ p: 1, borderRadius: 1, bgcolor: 'rgba(167, 139, 250, 0.1)', color: 'primary.main' }}>
                  <SpeedIcon />
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Pipeline Success Rates
                </Typography>
              </Stack>

              <Box sx={{ mb: 3 }}>
                <Stack direction="row" sx={{ justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>Response Rate</Typography>
                  <Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 700 }}>
                    {responseRate.toFixed(1)}%
                  </Typography>
                </Stack>
                <LinearProgress 
                  variant="determinate" 
                  value={responseRate} 
                  sx={{ height: 8, borderRadius: 4, bgcolor: 'rgba(255,255,255,0.05)' }} 
                />
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
                  Percentage of applied roles that turned into interviews or offers.
                </Typography>
              </Box>

              <Box>
                <Stack direction="row" sx={{ justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>Offer Rate</Typography>
                  <Typography variant="body2" sx={{ color: 'secondary.main', fontWeight: 700 }}>
                    {offerRate.toFixed(1)}%
                  </Typography>
                </Stack>
                <LinearProgress 
                  variant="determinate" 
                  value={offerRate} 
                  color="secondary"
                  sx={{ height: 8, borderRadius: 4, bgcolor: 'rgba(255,255,255,0.05)' }} 
                />
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
                  Percentage of total pipeline applications resulting in offers.
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%', background: 'linear-gradient(145deg, rgba(17, 24, 39, 0.8) 0%, rgba(9, 13, 22, 0.9) 100%)', position: 'relative', overflow: 'hidden' }}>
            <Box 
              sx={{ 
                position: 'absolute', 
                top: -50, 
                right: -50, 
                width: 150, 
                height: 150, 
                borderRadius: '50%', 
                background: 'radial-gradient(circle, rgba(167,139,250,0.15) 0%, rgba(0,0,0,0) 70%)' 
              }} 
            />
            <CardContent sx={{ p: 4, display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center' }}>
              <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>
                Setup API Keys to Tailor Resumes
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
                Prism uses your own AI providers (OpenAI, Gemini, Claude) directly so you don't pay subscription fees. Add your keys in Settings to unlock automated resume tailoring and cover letter builders.
              </Typography>
              <Button 
                variant="outlined" 
                color="primary"
                onClick={() => router.push('/dashboard/settings')}
                endIcon={<ArrowForwardIcon />}
                sx={{ alignSelf: 'flex-start' }}
              >
                Go to Settings
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Recent Applications Table */}
      <Card sx={{ mb: 4 }}>
        <CardContent sx={{ p: 0 }}>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Recent Applications
            </Typography>
            <Button 
              size="small" 
              onClick={() => router.push('/dashboard/applications')}
              endIcon={<ArrowForwardIcon />}
            >
              View All
            </Button>
          </Stack>
          <Divider />
          <TableContainer component={Box}>
            <Table>
              <TableHead sx={{ bgcolor: 'rgba(255,255,255,0.01)' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Company</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Position</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Location</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Salary Range</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {recentApps.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                      <Stack spacing={1} sx={{ alignItems: 'center' }}>
                        <InfoIcon sx={{ color: 'text.secondary', fontSize: 36 }} />
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          No applications in your tracker yet.
                        </Typography>
                        <Button 
                          variant="text" 
                          size="small" 
                          onClick={() => router.push('/dashboard/applications')}
                        >
                          Add one now
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ) : (
                  recentApps.map((app) => (
                    <TableRow key={app.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                      <TableCell sx={{ fontWeight: 600 }}>{app.company}</TableCell>
                      <TableCell>{app.position}</TableCell>
                      <TableCell>{app.location || 'Remote/Not specified'}</TableCell>
                      <TableCell>
                        <Chip 
                          label={app.status.toUpperCase()} 
                          color={getStatusChipColor(app.status)}
                          size="small" 
                          sx={{ fontWeight: 600 }}
                        />
                      </TableCell>
                      <TableCell>
                        {app.salary_min !== undefined || app.salary_max !== undefined ? (
                          `$${(app.salary_min || 0).toLocaleString()} - $${(app.salary_max || 0).toLocaleString()}`
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <IconButton color="error" size="small" onClick={() => handleDeleteApp(app.id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
}
