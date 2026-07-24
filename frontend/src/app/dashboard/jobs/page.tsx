'use client';

import * as React from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Pagination from '@mui/material/Pagination';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import SearchIcon from '@mui/icons-material/Search';
import AddTaskIcon from '@mui/icons-material/AddTask';
import DoneIcon from '@mui/icons-material/Done';
import LaunchIcon from '@mui/icons-material/Launch';
import DeleteIcon from '@mui/icons-material/Delete';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import FilterListIcon from '@mui/icons-material/FilterList';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import WorkOutlineIcon from '@mui/icons-material/WorkOutlined';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import type { ScrapedJob } from '../../../services/scraper';
import {
  useDeleteJobFeedJobMutation,
  useGetJobsFeedQuery,
  useGetProfileQuery,
  useGetScraperTargetsQuery,
  useImportJobFeedJobMutation,
  useMarkJobFeedReadMutation,
} from '../../../store/prismApi';
import { useAppDispatch } from '../../../store/hooks';
import { showToast } from '../../../store/uiSlice';
import PageHeader from '../../../components/ui/PageHeader';
import JobCard from '../../../components/ui/JobCard';
import EmptyState from '../../../components/ui/EmptyState';
import { useConfirm } from '../../../components/ui/ConfirmDialog';
import { FeedSkeleton } from '../../../components/ui/Skeletons';

type WorkMode = 'remote' | 'hybrid' | 'onsite';

const MODE_LABEL: Record<WorkMode, string> = { remote: 'Remote', hybrid: 'Hybrid', onsite: 'On-site' };

const PAGE_SIZE = 25;

export default function BrowseJobsPage() {
  const dispatch = useAppDispatch();
  const confirm = useConfirm();

  // Server-side filter state
  const [page, setPage] = React.useState(1);
  const [dbSearch, setDbSearch] = React.useState('');
  const [serverSearch, setServerSearch] = React.useState('');
  const [unreadFilter, setUnreadFilter] = React.useState<'all' | 'unread' | 'read'>('all');
  // Client-side heuristics, applied within the current page
  const [modeFilters, setModeFilters] = React.useState<Set<WorkMode>>(new Set());
  const [locationFilters, setLocationFilters] = React.useState<Set<string>>(new Set());
  const [filtersExpanded, setFiltersExpanded] = React.useState(false);

  // Debounce the search box into the server query; new searches restart at page 1
  React.useEffect(() => {
    const handle = setTimeout(() => {
      setServerSearch(dbSearch.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(handle);
  }, [dbSearch]);

  const {
    data: jobsPage,
    isLoading: jobsLoading,
    error,
  } = useGetJobsFeedQuery({
    page,
    limit: PAGE_SIZE,
    search: serverSearch || undefined,
    isNew: unreadFilter === 'all' ? undefined : unreadFilter === 'unread',
  });
  const jobs = React.useMemo(() => jobsPage?.jobs ?? [], [jobsPage]);
  const total = jobsPage?.total ?? 0;
  const totalPages = jobsPage?.pages ?? 1;

  const { data: targets = [] } = useGetScraperTargetsQuery();
  const { data: profile } = useGetProfileQuery();
  const [markRead] = useMarkJobFeedReadMutation();
  const [importJob] = useImportJobFeedJobMutation();
  const [deleteJob] = useDeleteJobFeedJobMutation();

  // Import dialog state
  const [importingJob, setImportingJob] = React.useState<ScrapedJob | null>(null);
  const [importStatus, setImportStatus] = React.useState('wishlist');
  const [importNotes, setImportNotes] = React.useState('');

  const [feedRef] = useAutoAnimate<HTMLDivElement>();

  const getJobWorkMode = React.useCallback((job: ScrapedJob): WorkMode => {
    const text = `${job.title} ${job.description_snippet || ''}`.toLowerCase();
    if (
      text.includes('remote') ||
      text.includes('wfh') ||
      text.includes('work from home') ||
      text.includes('telecommute')
    ) {
      return 'remote';
    }
    if (text.includes('hybrid') || text.includes('flexible')) {
      return 'hybrid';
    }
    return 'onsite';
  }, []);

  const getCompany = React.useCallback(
    (job: ScrapedJob) => {
      if (job.target_id.startsWith('general_')) {
        const platform = job.target_id.split('_').slice(1).join(' ');
        const platformName = platform
          .split(' ')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');
        const descPart = job.description_snippet?.split(' | ')[0];
        return descPart && descPart !== platformName ? `${descPart} (${platformName})` : platformName;
      }
      return targets.find((t) => t.id === job.target_id)?.company_name || 'Scraper Target';
    },
    [targets]
  );

  const handleMarkRead = async (jobId: string) => {
    try {
      await markRead(jobId).unwrap();
    } catch {
      dispatch(showToast({ message: 'Failed to mark job as read', severity: 'error' }));
    }
  };

  const handleDeleteJob = async (job: ScrapedJob) => {
    const ok = await confirm({
      title: 'Dismiss this job listing?',
      body: `"${job.title}" will be removed from your feed.`,
      confirmLabel: 'Dismiss',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteJob(job.id).unwrap();
      dispatch(showToast({ message: 'Job dismissed', severity: 'success' }));
    } catch {
      dispatch(showToast({ message: 'Failed to dismiss job listing', severity: 'error' }));
    }
  };

  const handleOpenImport = (job: ScrapedJob) => {
    setImportingJob(job);
    setImportStatus('wishlist');
    setImportNotes(`Imported from Browse Jobs. Matches query: ${job.matched_keywords.join(', ')}`);
  };

  const handleImportJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importingJob) return;
    try {
      await importJob({
        jobId: importingJob.id,
        payload: { status: importStatus, notes: importNotes },
      }).unwrap();
      dispatch(showToast({ message: 'Job imported to your applications pipeline', severity: 'success' }));
      setImportingJob(null);
    } catch (err) {
      const detail = (err as { data?: { detail?: string } })?.data?.detail;
      dispatch(showToast({ message: detail || 'Failed to import job listing', severity: 'error' }));
    }
  };

  const toggleMode = (mode: WorkMode) => {
    setModeFilters((prev) => {
      const next = new Set(prev);
      if (next.has(mode)) next.delete(mode);
      else next.add(mode);
      return next;
    });
  };

  const toggleLocation = (loc: string) => {
    setLocationFilters((prev) => {
      const next = new Set(prev);
      if (next.has(loc)) next.delete(loc);
      else next.add(loc);
      return next;
    });
  };

  const locationOptions = React.useMemo(() => {
    if (!profile?.job_preferences) return [] as { loc: string; mode: WorkMode }[];
    const result: { loc: string; mode: WorkMode }[] = [];
    (['onsite', 'remote', 'hybrid'] as const).forEach((mode) => {
      (profile.job_preferences[mode] || []).forEach((loc) => {
        if (!result.some((r) => r.loc === loc)) result.push({ loc, mode });
      });
    });
    return result;
  }, [profile]);

  const matchesLocation = React.useCallback(
    (job: ScrapedJob): boolean => {
      if (locationFilters.size === 0) return true;
      const text = `${job.title} ${job.description_snippet || ''}`.toLowerCase();
      return [...locationFilters].some((loc) => {
        const parts = loc.toLowerCase().split(',').map((p) => p.trim());
        return parts.some((p) => text.includes(p));
      });
    },
    [locationFilters]
  );

  // Search + read-state are filtered server-side; only the work-mode/location
  // heuristics (which the backend can't evaluate) run client-side per page.
  const filteredJobs = React.useMemo(() => {
    return jobs.filter((job) => {
      const modeMatch = modeFilters.size === 0 || modeFilters.has(getJobWorkMode(job));
      return modeMatch && matchesLocation(job);
    });
  }, [jobs, modeFilters, getJobWorkMode, matchesLocation]);

  return (
    <Box>
      <PageHeader
        title="Browse Jobs"
        subtitle="Discover positions from targeted career sites and live job board searches."
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to fetch job feed. Verify your API backend is running.
        </Alert>
      )}

      {/* Filters bar */}
      <Paper sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', p: 2 }}>
          <TextField
            placeholder="Search title, company, tags…"
            value={dbSearch}
            onChange={(e) => setDbSearch(e.target.value)}
            size="small"
            sx={{ minWidth: 220, flexGrow: 1 }}
            slotProps={{
              input: { startAdornment: <SearchIcon sx={{ color: 'text.secondary', mr: 1 }} /> },
            }}
          />

          {locationOptions.length > 0 && (
            <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', alignItems: 'center', gap: 0.5 }}>
              {locationOptions.map(({ loc }) => {
                const active = locationFilters.has(loc);
                return (
                  <Chip
                    key={loc}
                    label={loc.split(',')[0]}
                    size="small"
                    variant={active ? 'filled' : 'outlined'}
                    color={active ? 'primary' : 'default'}
                    onClick={() => toggleLocation(loc)}
                    onDelete={active ? () => toggleLocation(loc) : undefined}
                    sx={{ height: 24, fontSize: '0.7rem' }}
                  />
                );
              })}
            </Stack>
          )}

          <Stack direction="row" spacing={0.5}>
            {(['all', 'unread', 'read'] as const).map((v) => (
              <Button
                key={v}
                size="small"
                variant={unreadFilter === v ? 'contained' : 'outlined'}
                onClick={() => {
                  setUnreadFilter(v);
                  setPage(1);
                }}
                sx={{ textTransform: 'capitalize', minWidth: 64 }}
              >
                {v === 'all' ? 'All' : v === 'unread' ? 'New' : 'Read'}
              </Button>
            ))}
          </Stack>
          <Button
            size="small"
            startIcon={<FilterListIcon />}
            onClick={() => setFiltersExpanded((v) => !v)}
            variant={modeFilters.size > 0 ? 'contained' : 'outlined'}
            endIcon={filtersExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            sx={{ ml: 'auto' }}
          >
            Work Mode {modeFilters.size > 0 ? `(${modeFilters.size})` : ''}
          </Button>
        </Box>

        <Collapse in={filtersExpanded}>
          <Divider />
          <Box sx={{ px: 2.5, py: 1.5 }}>
            <Typography
              variant="caption"
              sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 1 }}
            >
              Work Mode
            </Typography>
            <Stack direction="row" spacing={1}>
              {(['remote', 'hybrid', 'onsite'] as const).map((mode) => (
                <FormControlLabel
                  key={mode}
                  control={
                    <Checkbox
                      checked={modeFilters.has(mode)}
                      onChange={() => toggleMode(mode)}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {MODE_LABEL[mode]}
                    </Typography>
                  }
                />
              ))}
            </Stack>
            {(modeFilters.size > 0 || locationFilters.size > 0) && (
              <Button
                size="small"
                sx={{ mt: 1 }}
                onClick={() => {
                  setModeFilters(new Set());
                  setLocationFilters(new Set());
                }}
              >
                Clear all filters
              </Button>
            )}
          </Box>
        </Collapse>
      </Paper>

      {(modeFilters.size > 0 || locationFilters.size > 0) && (
        <Alert severity="info" icon={<LocationOnIcon />} sx={{ mb: 2 }}>
          Showing {filteredJobs.length} jobs
          {modeFilters.size > 0 && <> · work mode: {[...modeFilters].map((m) => MODE_LABEL[m]).join(', ')}</>}
          {locationFilters.size > 0 && <> · locations: {[...locationFilters].join(', ')}</>}
        </Alert>
      )}

      {/* Job feed */}
      {jobsLoading ? (
        <FeedSkeleton />
      ) : (
        <Stack spacing={2} ref={feedRef}>
          <Typography variant="overline" sx={{ color: 'text.secondary', pl: 0.5 }}>
            {filteredJobs.length < jobs.length
              ? `${filteredJobs.length} of ${jobs.length} on this page match · ${total} total`
              : `${total} job${total !== 1 ? 's' : ''}${totalPages > 1 ? ` · page ${page} of ${totalPages}` : ''}`}
          </Typography>
          {filteredJobs.length === 0 ? (
            <EmptyState
              icon={<WorkOutlineIcon />}
              title="No jobs match the current filters"
              description="Try clearing filters, or add companies to your Career Watchlist to discover more positions."
            />
          ) : (
            filteredJobs.map((job) => (
              <JobCard
                key={job.id}
                title={job.title}
                company={getCompany(job)}
                isNew={job.is_new}
                experience={job.years_experience_display}
                snippet={job.description_snippet}
                keywords={job.matched_keywords}
                discoveredAt={new Date(job.discovered_at).toLocaleDateString()}
                read={!job.is_new}
                actions={
                  <>
                    {job.url && (
                      <IconButton
                        size="small"
                        href={job.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        color="primary"
                      >
                        <LaunchIcon fontSize="small" />
                      </IconButton>
                    )}
                    <Tooltip title="Track position">
                      <IconButton size="small" color="success" onClick={() => handleOpenImport(job)}>
                        <AddTaskIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {job.is_new && (
                      <Tooltip title="Mark read">
                        <IconButton size="small" onClick={() => handleMarkRead(job.id)}>
                          <DoneIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title="Dismiss">
                      <IconButton size="small" color="error" onClick={() => handleDeleteJob(job)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </>
                }
              />
            ))
          )}
          {totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1 }}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(_, val) => setPage(val)}
                color="primary"
              />
            </Box>
          )}
        </Stack>
      )}

      {/* Import dialog */}
      <Dialog open={Boolean(importingJob)} onClose={() => setImportingJob(null)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={handleImportJob}>
          <DialogTitle>Track Position in Board</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={3} sx={{ mt: 1 }}>
              {importingJob && (
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    {importingJob.title}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 600 }}>
                    {getCompany(importingJob)}
                  </Typography>
                </Box>
              )}

              <FormControl fullWidth>
                <InputLabel id="import-status-label">Initial Pipeline Stage</InputLabel>
                <Select
                  labelId="import-status-label"
                  label="Initial Pipeline Stage"
                  value={importStatus}
                  onChange={(e) => setImportStatus(e.target.value)}
                >
                  <MenuItem value="wishlist">Wishlist</MenuItem>
                  <MenuItem value="applied">Applied</MenuItem>
                  <MenuItem value="interviewing">Interviewing</MenuItem>
                </Select>
              </FormControl>

              <TextField
                label="Outreach Notes"
                value={importNotes}
                onChange={(e) => setImportNotes(e.target.value)}
                multiline
                rows={3}
                fullWidth
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => setImportingJob(null)}>Cancel</Button>
            <Button variant="contained" type="submit" color="success">
              Track Application
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
}
