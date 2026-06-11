'use client';

import * as React from 'react';
import { jobsService } from '../../../services/jobs';
import { scraperService, ScraperTarget, ScrapedJob } from '../../../services/scraper';
import { applicationsService } from '../../../services/applications';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
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
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddTaskIcon from '@mui/icons-material/AddTask';
import DoneIcon from '@mui/icons-material/Done';
import LaunchIcon from '@mui/icons-material/Launch';
import DeleteIcon from '@mui/icons-material/Delete';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';
import FolderSpecialIcon from '@mui/icons-material/FolderSpecial';

export default function BrowseJobsPage() {
  const [activeTab, setActiveTab] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [jobs, setJobs] = React.useState<ScrapedJob[]>([]);
  const [targets, setTargets] = React.useState<ScraperTarget[]>([]);
  
  // Database filter state
  const [dbSearch, setDbSearch] = React.useState('');
  const [targetFilter, setTargetFilter] = React.useState('');
  const [unreadFilter, setUnreadFilter] = React.useState<string>('all');

  // External Search state
  const [extTitle, setExtTitle] = React.useState('');
  const [extLocation, setExtLocation] = React.useState('Remote');
  const [extJobs, setExtJobs] = React.useState<ScrapedJob[]>([]);
  const [searchingExternal, setSearchingExternal] = React.useState(false);

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
      const [targetsData, jobsData] = await Promise.all([
        scraperService.listTargets(),
        jobsService.listJobs()
      ]);
      setTargets(targetsData);
      setJobs(jobsData);
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
      setExtJobs(prev => prev.map(j => j.id === jobId ? { ...j, is_new: false } : j));
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
      setExtJobs(prev => prev.filter(j => j.id !== jobId));
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

  // Handle External Search
  const handleExternalSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extTitle.trim()) return;
    setSearchingExternal(true);
    setError(null);
    setSuccess(null);
    try {
      const results = await jobsService.searchExternal({
        title: extTitle,
        location: extLocation
      });
      setExtJobs(results);
      setSuccess(`Scrape complete! Found ${results.length} matching positions online.`);
    } catch (err: any) {
      setError('Failed to scan online boards. Verify connection to external endpoints.');
    } finally {
      setSearchingExternal(false);
    }
  };

  const getCompany = (job: ScrapedJob) => {
    if (job.target_id === 'external') {
      return job.description_snippet?.split(' | ')[0] || 'External Search Match';
    }
    return targets.find(t => t.id === job.target_id)?.company_name || 'Scraper Target';
  };

  const filteredJobs = jobs.filter(job => {
    const searchMatch = !dbSearch.trim() || 
      job.title.toLowerCase().includes(dbSearch.toLowerCase()) || 
      getCompany(job).toLowerCase().includes(dbSearch.toLowerCase()) || 
      job.matched_keywords.some(k => k.toLowerCase().includes(dbSearch.toLowerCase()));
      
    const targetMatch = !targetFilter || job.target_id === targetFilter;
    
    const unreadMatch = unreadFilter === 'all' || 
      (unreadFilter === 'unread' && job.is_new) || 
      (unreadFilter === 'read' && !job.is_new);
      
    return searchMatch && targetMatch && unreadMatch;
  });

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: -0.5 }}>
          Browse Discovered Jobs
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
          Search matched positions from targeted career sites, search external listings dynamically, and add them to your tracking board.
        </Typography>
      </Box>

      {success && <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>{success}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}

      <Paper sx={{ mb: 4 }}>
        <Tabs 
          value={activeTab} 
          onChange={(_, val) => setActiveTab(val)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab icon={<FolderSpecialIcon />} label="Scraped Jobs Feed" />
          <Tab icon={<TravelExploreIcon />} label="Search External Jobs" />
        </Tabs>
      </Paper>

      {/* Tab 0: Scraped Database Feed */}
      {activeTab === 0 && (
        <Box>
          {/* Filters Bar */}
          <Paper sx={{ p: 2, mb: 4, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
            <TextField
              placeholder="Search title, company, tags..."
              value={dbSearch}
              onChange={(e) => setDbSearch(e.target.value)}
              size="small"
              sx={{ minWidth: 250 }}
              slotProps={{
                input: {
                  startAdornment: <SearchIcon sx={{ color: 'text.secondary', mr: 1 }} />,
                }
              }}
            />

            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel id="target-filter-label">Scraper Target</InputLabel>
              <Select
                labelId="target-filter-label"
                label="Scraper Target"
                value={targetFilter}
                onChange={(e) => setTargetFilter(e.target.value)}
              >
                <MenuItem value="">All Targets</MenuItem>
                <MenuItem value="external">External Search Results</MenuItem>
                {targets.map(t => (
                  <MenuItem key={t.id} value={t.id}>{t.company_name}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <Tabs 
              value={unreadFilter} 
              onChange={(_, val) => setUnreadFilter(val)}
              sx={{ ml: 'auto' }}
            >
              <Tab label="All" value="all" />
              <Tab label="New/Unread" value="unread" />
              <Tab label="Read" value="read" />
            </Tabs>
          </Paper>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
          ) : filteredJobs.length === 0 ? (
            <Paper sx={{ p: 6, textAlign: 'center', color: 'text.secondary', border: '1px dashed rgba(255,255,255,0.08)' }}>
              No matched jobs found in database. Adjust targets or search dynamically on the "Search External Jobs" tab.
            </Paper>
          ) : (
            <Stack spacing={2}>
              {filteredJobs.map((job) => (
                <Paper 
                  key={job.id} 
                  sx={{ 
                    p: 2.5, 
                    bgcolor: job.is_new ? 'rgba(167, 139, 250, 0.02)' : 'transparent',
                    border: job.is_new ? '1px solid rgba(167, 139, 250, 0.1)' : '1px solid rgba(255,255,255,0.04)'
                  }}
                >
                  <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                    <Box sx={{ maxWidth: '80%' }}>
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>{job.title}</Typography>
                        {job.is_new && <Chip label="NEW" size="small" color="primary" sx={{ height: 18, fontSize: '0.65rem', fontWeight: 800 }} />}
                      </Stack>
                      <Typography variant="subtitle2" color="secondary.main" sx={{ fontWeight: 600 }}>
                        {getCompany(job)}
                      </Typography>
                    </Box>
                    
                    <Stack direction="row" spacing={0.5}>
                      {job.url && (
                        <IconButton size="small" href={job.url} target="_blank" rel="noopener noreferrer" color="primary">
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
                        <IconButton size="small" color="error" onClick={() => handleDeleteJob(job.id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Stack>

                  {job.description_snippet && (
                    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2, fontSize: '0.85rem' }}>
                      {job.description_snippet}
                    </Typography>
                  )}

                  <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', mr: 1 }}>Matched Keywords:</Typography>
                    {job.matched_keywords.map(kw => (
                      <Chip key={kw} label={kw} size="small" sx={{ height: 18, fontSize: '0.65rem' }} />
                    ))}
                    <Typography variant="caption" sx={{ color: 'text.secondary', ml: 'auto' }}>
                      Scraped: {new Date(job.discovered_at).toLocaleDateString()}
                    </Typography>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )}
        </Box>
      )}

      {/* Tab 1: Live Web Search Scraper */}
      {activeTab === 1 && (
        <Box>
          <Card sx={{ mb: 4 }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Indeed & Remotive Search Crawler</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 3 }}>
                Search live job opportunities online. Prism will scrape open positions matching your keyword and save them here.
              </Typography>

              <Box component="form" onSubmit={handleExternalSearch}>
                <Grid container spacing={2} sx={{ alignItems: 'center' }}>
                  <Grid size={{ xs: 12, sm: 5 }}>
                    <TextField
                      label="Job Title / Keyword"
                      placeholder="e.g. Python Developer"
                      value={extTitle}
                      onChange={(e) => setExtTitle(e.target.value)}
                      required
                      fullWidth
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField
                      label="Location Preference"
                      value={extLocation}
                      onChange={(e) => setExtLocation(e.target.value)}
                      fullWidth
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 3 }}>
                    <Button 
                      type="submit" 
                      variant="contained" 
                      startIcon={searchingExternal ? <CircularProgress size={20} /> : <TravelExploreIcon />}
                      disabled={searchingExternal || !extTitle.trim()}
                      fullWidth
                      sx={{ py: 1.5 }}
                    >
                      {searchingExternal ? 'Crawling...' : 'Search Online'}
                    </Button>
                  </Grid>
                </Grid>
              </Box>
            </CardContent>
          </Card>

          {searchingExternal ? (
            <Card sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
              <Stack spacing={2} sx={{ alignItems: 'center', p: 4 }}>
                <CircularProgress color="primary" />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>Scraping Online Job Boards...</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
                  Hitting public developer boards and matching positions. Please stand by.
                </Typography>
              </Stack>
            </Card>
          ) : extJobs.length === 0 ? (
            <Paper sx={{ p: 6, textAlign: 'center', color: 'text.secondary', border: '1px dashed rgba(255,255,255,0.08)' }}>
              No search results loaded. Input keywords above to scan and save matched listings.
            </Paper>
          ) : (
            <Stack spacing={2}>
              {extJobs.map((job) => (
                <Paper 
                  key={job.id} 
                  sx={{ 
                    p: 2.5, 
                    bgcolor: job.is_new ? 'rgba(16, 185, 129, 0.01)' : 'transparent',
                    border: '1px solid rgba(255,255,255,0.04)'
                  }}
                >
                  <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                    <Box sx={{ maxWidth: '80%' }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>{job.title}</Typography>
                      <Typography variant="subtitle2" color="secondary.main" sx={{ fontWeight: 600 }}>
                        {getCompany(job)}
                      </Typography>
                    </Box>
                    
                    <Stack direction="row" spacing={0.5}>
                      {job.url && (
                        <IconButton size="small" href={job.url} target="_blank" rel="noopener noreferrer" color="primary">
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
                    </Stack>
                  </Stack>

                  {job.description_snippet && (
                    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2, fontSize: '0.85rem' }}>
                      {job.description_snippet}
                    </Typography>
                  )}
                </Paper>
              ))}
            </Stack>
          )}
        </Box>
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
