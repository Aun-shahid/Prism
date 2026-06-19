'use client';

import * as React from 'react';
import { jobsService } from '../../../services/jobs';
import { scraperService, ScraperTarget, ScrapedJob } from '../../../services/scraper';
import { profileService, UserProfile } from '../../../services/profile';
import {
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  Stack,
  Alert,
  CircularProgress,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  Checkbox,
  FormControlLabel,
  Collapse,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddTaskIcon from '@mui/icons-material/AddTask';
import DoneIcon from '@mui/icons-material/Done';
import LaunchIcon from '@mui/icons-material/Launch';
import DeleteIcon from '@mui/icons-material/Delete';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import FilterListIcon from '@mui/icons-material/FilterList';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

export default function BrowseJobsPage() {
  const [loading, setLoading] = React.useState(true);
  const [jobs, setJobs] = React.useState<ScrapedJob[]>([]);
  const [targets, setTargets] = React.useState<ScraperTarget[]>([]);

  // Filter state
  const [dbSearch, setDbSearch] = React.useState('');
  const [unreadFilter, setUnreadFilter] = React.useState<'all' | 'unread' | 'read'>('all');
  // Work-mode checkboxes
  const [modeFilters, setModeFilters] = React.useState<Set<'remote' | 'hybrid' | 'onsite'>>(new Set());
  // Location keyword checkboxes
  const [locationFilters, setLocationFilters] = React.useState<Set<string>>(new Set());
  const [filtersExpanded, setFiltersExpanded] = React.useState(false);

  // Profile (for preference chips display)
  const [profile, setProfile] = React.useState<UserProfile | null>(null);

  // Helper to determine work mode of a job
  const getJobWorkMode = React.useCallback((job: ScrapedJob): 'onsite' | 'remote' | 'hybrid' => {
    const text = `${job.title} ${job.description_snippet || ''}`.toLowerCase();
    
    if (text.includes('remote') || text.includes('wfh') || text.includes('work from home') || text.includes('telecommute')) {
      return 'remote';
    }
    if (text.includes('hybrid') || text.includes('flexible')) {
      return 'hybrid';
    }
    if (text.includes('onsite') || text.includes('on-site') || text.includes('in-office') || text.includes('in office') || text.includes('office based')) {
      return 'onsite';
    }
    return 'onsite';
  }, []);

  // Dialog State
  const [openImportDialog, setOpenImportDialog] = React.useState(false);
  const [importingJob, setImportingJob] = React.useState<ScrapedJob | null>(null);
  const [importStatus, setImportStatus] = React.useState('wishlist');
  const [importNotes, setImportNotes] = React.useState('');

  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [targetsData, jobsData, profileData] = await Promise.all([
        scraperService.listTargets(),
        jobsService.listJobs(),
        profileService.getProfile()
      ]);
      setTargets(targetsData);
      setJobs(jobsData);
      setProfile(profileData);
    } catch (err: any) {
      setError('Failed to fetch job feed. Verify your API backend is running.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Mark Read
  const handleMarkRead = async (jobId: string) => {
    try {
      await jobsService.markRead(jobId);
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, is_new: false } : j));
    } catch (err) {
      alert('Failed to mark job as read.');
    }
  };

  // Handle Delete
  const handleDeleteJob = async (jobId: string) => {
    if (!confirm('Are you sure you want to delete this job listing?')) return;
    try {
      await jobsService.deleteJob(jobId);
      setJobs(prev => prev.filter(j => j.id !== jobId));
      setSuccess('Job dismissed.');
    } catch (err) {
      alert('Failed to dismiss job listing.');
    }
  };


  // Open Import Dialog
  const handleOpenImport = (job: ScrapedJob) => {
    setImportingJob(job);
    setImportStatus('wishlist');
    setImportNotes(`Imported from Browse Jobs. Matches query: ${job.matched_keywords.join(', ')}`);
    setOpenImportDialog(true);
  };

  // Handle Save Import
  const handleImportJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importingJob) return;
    try {
      await jobsService.importJob(importingJob.id, {
        status: importStatus,
        notes: importNotes
      });
      setSuccess(`Successfully imported job to applications pipeline!`);
      setOpenImportDialog(false);
      setImportingJob(null);
      // Refresh jobs list to show read status
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to import job listing.');
    }
  };

  const getCompany = React.useCallback((job: ScrapedJob) => {
    if (job.target_id.startsWith('general_')) {
      const platform = job.target_id.split('_').slice(1).join(' ');
      const platformName = platform.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      const descPart = job.description_snippet?.split(' | ')[0];
      return descPart && descPart !== platformName ? `${descPart} (${platformName})` : platformName;
    }
    return targets.find(t => t.id === job.target_id)?.company_name || 'Scraper Target';
  }, [targets]);

  const toggleMode = (mode: 'remote' | 'hybrid' | 'onsite') => {
    setModeFilters(prev => {
      const next = new Set(prev);
      if (next.has(mode)) next.delete(mode); else next.add(mode);
      return next;
    });
  };

  const toggleLocation = (loc: string) => {
    setLocationFilters(prev => {
      const next = new Set(prev);
      if (next.has(loc)) next.delete(loc); else next.add(loc);
      return next;
    });
  };

  // Flatten all unique location options from profile preferences, with their mode
  const locationOptions = React.useMemo(() => {
    if (!profile?.job_preferences) return [] as { loc: string; mode: 'remote' | 'hybrid' | 'onsite' }[];
    const result: { loc: string; mode: 'remote' | 'hybrid' | 'onsite' }[] = [];
    (['onsite', 'remote', 'hybrid'] as const).forEach(mode => {
      (profile.job_preferences![mode] || []).forEach(loc => {
        // Use the full location string as the key
        if (!result.some(r => r.loc === loc)) result.push({ loc, mode });
      });
    });
    return result;
  }, [profile]);

  // Helper: check if a job matches any of the selected location keywords
  const matchesLocation = React.useCallback((job: ScrapedJob): boolean => {
    if (locationFilters.size === 0) return true;
    const text = `${job.title} ${job.description_snippet || ''}`.toLowerCase();
    return [...locationFilters].some(loc => {
      const parts = loc.toLowerCase().split(',').map(p => p.trim());
      return parts.some(p => text.includes(p));
    });
  }, [locationFilters]);

  const filteredJobs = React.useMemo(() => {
    return jobs.filter(job => {
      const searchMatch = !dbSearch.trim() ||
        job.title.toLowerCase().includes(dbSearch.toLowerCase()) ||
        getCompany(job).toLowerCase().includes(dbSearch.toLowerCase()) ||
        job.matched_keywords.some(k => k.toLowerCase().includes(dbSearch.toLowerCase()));

      const unreadMatch = unreadFilter === 'all' ||
        (unreadFilter === 'unread' && job.is_new) ||
        (unreadFilter === 'read' && !job.is_new);

      const modeMatch = modeFilters.size === 0 || modeFilters.has(getJobWorkMode(job));
      const locationMatch = matchesLocation(job);

      return searchMatch && unreadMatch && modeMatch && locationMatch;
    });
  }, [jobs, dbSearch, unreadFilter, modeFilters, locationFilters, getCompany, getJobWorkMode, matchesLocation]);

  // Work mode label / color helpers
  const modeLabel = { remote: 'Remote', hybrid: 'Hybrid', onsite: 'On-site' } as const;
  const modeColor = { remote: '#10b981', hybrid: '#f59e0b', onsite: '#6366f1' } as const;

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: -0.5 }}>Browse Jobs</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
          Discover positions from targeted career sites and live job board searches.
        </Typography>
      </Box>

      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {/* ── Filters Bar ───────────────────────────────────────────────────── */}
      <Paper sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', p: 2 }}>
          <TextField
            placeholder="Search title, company, tags…"
            value={dbSearch} onChange={e => setDbSearch(e.target.value)}
            size="small" sx={{ minWidth: 220, flexGrow: 1 }}
            slotProps={{ input: { startAdornment: <SearchIcon sx={{ color: 'text.secondary', mr: 1 }} /> } }}
          />

          {/* Location filter chips */}
          {locationOptions.length > 0 && (
            <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
              {locationOptions.map(({ loc, mode }) => (
                <Chip
                  key={loc}
                  label={loc.split(',')[0]}
                  size="small"
                  variant={locationFilters.has(loc) ? 'filled' : 'outlined'}
                  color={locationFilters.has(loc) ? 'primary' : 'default'}
                  onClick={() => toggleLocation(loc)}
                  onDelete={locationFilters.has(loc) ? () => toggleLocation(loc) : undefined}
                  sx={{
                    height: 24,
                    fontSize: '0.7rem',
                    borderColor: modeColor[mode],
                    bgcolor: locationFilters.has(loc) ? modeColor[mode] : 'transparent',
                    color: locationFilters.has(loc) ? '#fff' : modeColor[mode],
                    '&:hover': { bgcolor: locationFilters.has(loc) ? modeColor[mode] : `${modeColor[mode]}22` },
                    '& .MuiChip-deleteIcon': { color: '#fff', fontSize: 14 },
                  }}
                />
              ))}
            </Stack>
          )}

          <Stack direction="row" spacing={0.5}>
            {(['all', 'unread', 'read'] as const).map(v => (
              <Button key={v} size="small"
                variant={unreadFilter === v ? 'contained' : 'outlined'}
                onClick={() => setUnreadFilter(v)}
                sx={{ textTransform: 'capitalize', minWidth: 64 }}>
                {v === 'all' ? 'All' : v === 'unread' ? 'New' : 'Read'}
              </Button>
            ))}
          </Stack>
          <Button size="small" startIcon={<FilterListIcon />}
            onClick={() => setFiltersExpanded(v => !v)}
            variant={modeFilters.size > 0 ? 'contained' : 'outlined'}
            endIcon={filtersExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            sx={{ textTransform: 'none', ml: 'auto' }}>
            Work Mode {modeFilters.size > 0 ? `(${modeFilters.size})` : ''}
          </Button>
        </Box>

        {/* Row 2: work-mode checkboxes (collapsible) */}
        <Collapse in={filtersExpanded}>
          <Divider />
          <Box sx={{ px: 2.5, py: 1.5 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 1 }}>
              Work Mode
            </Typography>
            <Stack direction="row" spacing={1}>
              {(['remote', 'hybrid', 'onsite'] as const).map(mode => (
                <FormControlLabel
                  key={mode}
                  control={
                    <Checkbox
                      checked={modeFilters.has(mode)}
                      onChange={() => toggleMode(mode)}
                      size="small"
                      sx={{ color: modeColor[mode], '&.Mui-checked': { color: modeColor[mode] } }}
                    />
                  }
                  label={<Typography variant="body2" sx={{ fontWeight: 600, color: modeColor[mode] }}>{modeLabel[mode]}</Typography>}
                />
              ))}
            </Stack>
            {(modeFilters.size > 0 || locationFilters.size > 0) && (
              <Button size="small" sx={{ mt: 1, textTransform: 'none' }}
                onClick={() => { setModeFilters(new Set()); setLocationFilters(new Set()); }}>
                Clear all filters
              </Button>
            )}
          </Box>
        </Collapse>
      </Paper>

      {(modeFilters.size > 0 || locationFilters.size > 0) && (
        <Alert severity="info" icon={<LocationOnIcon />} sx={{ mb: 2 }}>
          Showing {filteredJobs.length} jobs
          {modeFilters.size > 0 && <> · work mode: {[...modeFilters].map(m => modeLabel[m]).join(', ')}</>}
          {locationFilters.size > 0 && <> · locations: {[...locationFilters].join(', ')}</>}
        </Alert>
      )}

      {/* ── Job Feed ──────────────────────────────────────────────────────── */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : (
        <Stack spacing={2}>
          <Typography variant="overline" sx={{ color: 'text.secondary', pl: 0.5 }}>
            {filteredJobs.length} job{filteredJobs.length !== 1 ? 's' : ''}
          </Typography>
          {filteredJobs.length === 0 ? (
            <Paper sx={{ p: 6, textAlign: 'center', color: 'text.secondary', border: '1px dashed rgba(255,255,255,0.08)' }}>
              No jobs match the current filters.
            </Paper>
          ) : (
            filteredJobs.map(job => (
              <JobCard key={job.id} job={job} company={getCompany(job)}
                onImport={handleOpenImport} onMarkRead={handleMarkRead} onDelete={handleDeleteJob} />
            ))
          )}
        </Stack>
      )}

      {/* Import to Applications Dialog */}
      <Dialog open={openImportDialog} onClose={() => setOpenImportDialog(false)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={handleImportJob}>
          <DialogTitle sx={{ fontWeight: 800 }}>Track Position in Board</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={3} sx={{ mt: 1 }}>
              {importingJob && (
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{importingJob.title}</Typography>
                  <Typography variant="caption" color="secondary.main" sx={{ fontWeight: 600 }}>
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
            <Button onClick={() => setOpenImportDialog(false)}>Cancel</Button>
            <Button variant="contained" type="submit" color="success">Track Application</Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
}

// ── Shared job card ────────────────────────────────────────────────────────────
function JobCard({
  job, company, onImport, onMarkRead, onDelete,
}: {
  job: ScrapedJob;
  company: string;
  onImport: (j: ScrapedJob) => void;
  onMarkRead: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  return (
    <Paper sx={{
      p: 2.5,
      bgcolor: job.is_new ? 'rgba(167, 139, 250, 0.02)' : 'transparent',
      border: job.is_new ? '1px solid rgba(167, 139, 250, 0.1)' : '1px solid rgba(255,255,255,0.04)',
    }}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
        <Box sx={{ maxWidth: '80%' }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>{job.title}</Typography>
            {job.is_new && <Chip label="NEW" size="small" color="primary" sx={{ height: 18, fontSize: '0.65rem', fontWeight: 800 }} />}
          </Stack>
          <Typography variant="subtitle2" color="secondary.main" sx={{ fontWeight: 600 }}>{company}</Typography>
        </Box>
        <Stack direction="row" spacing={0.5}>
          {job.url && (
            <IconButton size="small" href={job.url} target="_blank" rel="noopener noreferrer" color="primary">
              <LaunchIcon fontSize="small" />
            </IconButton>
          )}
          <Tooltip title="Track position">
            <IconButton size="small" color="success" onClick={() => onImport(job)}>
              <AddTaskIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {job.is_new && (
            <Tooltip title="Mark read">
              <IconButton size="small" onClick={() => onMarkRead(job.id)}>
                <DoneIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {onDelete && (
            <Tooltip title="Dismiss">
              <IconButton size="small" color="error" onClick={() => onDelete(job.id)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      </Stack>

      {job.description_snippet && (
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5, fontSize: '0.85rem' }}>
          {job.description_snippet}
        </Typography>
      )}

      {job.matched_keywords.length > 0 && (
        <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', mr: 0.5 }}>Keywords:</Typography>
          {job.matched_keywords.map(kw => (
            <Chip key={kw} label={kw} size="small" sx={{ height: 18, fontSize: '0.65rem' }} />
          ))}
          <Typography variant="caption" sx={{ color: 'text.secondary', ml: 'auto' }}>
            {new Date(job.discovered_at).toLocaleDateString()}
          </Typography>
        </Stack>
      )}
    </Paper>
  );
}
