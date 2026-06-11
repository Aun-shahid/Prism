'use client';

import * as React from 'react';
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
  Switch,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Tooltip,
  Paper
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import LaunchIcon from '@mui/icons-material/Launch';
import DoneIcon from '@mui/icons-material/Done';
import AddTaskIcon from '@mui/icons-material/AddTask';
import SearchIcon from '@mui/icons-material/Search';

export default function ScraperPage() {
  const [targets, setTargets] = React.useState<ScraperTarget[]>([]);
  const [jobs, setJobs] = React.useState<ScrapedJob[]>([]);
  const [loadingTargets, setLoadingTargets] = React.useState(true);
  const [loadingJobs, setLoadingJobs] = React.useState(true);
  const [scrapingId, setScrapingId] = React.useState<string | null>(null);
  
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  // Dialog for Add target
  const [openAddDialog, setOpenAddDialog] = React.useState(false);
  const [targetForm, setTargetForm] = React.useState({
    company_name: '',
    career_url: '',
    keywords: [] as string[]
  });
  const [keywordInput, setKeywordInput] = React.useState('');

  // Dialog for adding discovered job to application tracker
  const [openAppDialog, setOpenAppDialog] = React.useState(false);
  const [selectedJob, setSelectedJob] = React.useState<ScrapedJob | null>(null);
  const [appForm, setAppForm] = React.useState({
    company: '',
    position: '',
    job_url: '',
    notes: ''
  });

  const loadData = React.useCallback(async () => {
    setLoadingTargets(true);
    setLoadingJobs(true);
    try {
      const [targetsData, jobsData] = await Promise.all([
        scraperService.listTargets(),
        scraperService.listDiscoveredJobs()
      ]);
      setTargets(targetsData);
      setJobs(jobsData);
    } catch (err: any) {
      setError('Failed to fetch scraper information. Ensure backend is running.');
    } finally {
      setLoadingTargets(false);
      setLoadingJobs(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // --- Scraper Target CRUD ---
  const handleAddKeyword = () => {
    if (keywordInput.trim() && !targetForm.keywords.includes(keywordInput.trim())) {
      setTargetForm(prev => ({ ...prev, keywords: [...prev.keywords, keywordInput.trim()] }));
      setKeywordInput('');
    }
  };

  const handleRemoveKeyword = (kw: string) => {
    setTargetForm(prev => ({ ...prev, keywords: prev.keywords.filter(k => k !== kw) }));
  };

  const handleSaveTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await scraperService.addTarget(targetForm);
      setOpenAddDialog(false);
      setTargetForm({ company_name: '', career_url: '', keywords: [] });
      setKeywordInput('');
      setSuccess('Scraper target added successfully.');
      loadData();
    } catch (err: any) {
      setError('Failed to save scraping target.');
    }
  };

  const handleDeleteTarget = async (id: string) => {
    if (!confirm('Are you sure you want to remove this scraping target? All scraped jobs for it will be deleted.')) return;
    try {
      await scraperService.deleteTarget(id);
      setSuccess('Target removed.');
      loadData();
    } catch (err: any) {
      alert('Failed to delete target.');
    }
  };

  const handleToggleTargetStatus = async (target: ScraperTarget) => {
    try {
      await scraperService.updateTarget(target.id, { is_active: !target.is_active });
      loadData();
    } catch (err: any) {
      alert('Failed to update target status.');
    }
  };

  const handleTriggerScrape = async (id: string) => {
    setScrapingId(id);
    setError(null);
    setSuccess(null);
    try {
      const scraped = await scraperService.triggerScrape(id);
      setSuccess(`Scrape complete! Found ${scraped.length} matching jobs.`);
      loadData();
    } catch (err: any) {
      setError('Crawl completed but failed to scrape. Check target URL access restrictions.');
    } finally {
      setScrapingId(null);
    }
  };

  // --- Discovered Jobs actions ---
  const handleMarkRead = async (jobId: string) => {
    try {
      await scraperService.markJobRead(jobId);
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, is_new: false } : j));
    } catch (err: any) {
      alert('Failed to update job status.');
    }
  };

  const handleOpenAppDialog = (job: ScrapedJob) => {
    setSelectedJob(job);
    setAppForm({
      company: targets.find(t => t.id === job.target_id)?.company_name || 'Target Company',
      position: job.title,
      job_url: job.url || '',
      notes: `Discovered automatically matching keywords: ${job.matched_keywords.join(', ')}`
    });
    setOpenAppDialog(true);
  };

  const handleAddToApplications = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await applicationsService.createApplication({
        company: appForm.company,
        position: appForm.position,
        job_url: appForm.job_url,
        notes: appForm.notes,
        status: 'wishlist'
      });
      
      // If we matched a job listing, mark it read since we're tracking it
      if (selectedJob) {
        await scraperService.markJobRead(selectedJob.id);
      }
      
      setSuccess('Application created! Added to Wishlist.');
      setOpenAppDialog(false);
      loadData();
    } catch (err: any) {
      alert('Failed to track job application.');
    }
  };

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: -0.5 }}>
          Career Pages Scraper
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
          Define target company career urls and match keywords to discover open positions automatically.
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>{success}</Alert>}

      <Grid container spacing={3}>
        {/* Left Side: Targets Manager */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>Scraper Targets</Typography>
                <Button variant="outlined" startIcon={<AddIcon />} size="small" onClick={() => setOpenAddDialog(true)}>
                  Add URL
                </Button>
              </Stack>

              {loadingTargets ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={30} /></Box>
              ) : targets.length === 0 ? (
                <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 2 }}>
                  No scraping targets configured. Add a website to monitor.
                </Typography>
              ) : (
                <List>
                  {targets.map((t) => (
                    <Paper key={t.id} sx={{ p: 2, mb: 2, bgcolor: 'rgba(255, 255, 255, 0.01)', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
                      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Box sx={{ maxWidth: '70%' }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{t.company_name}</Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            {t.career_url}
                          </Typography>
                          
                          <Box sx={{ mt: 1.5, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {t.keywords.map(kw => (
                              <Chip key={kw} label={kw} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} />
                            ))}
                          </Box>
                        </Box>
                        
                        <Stack spacing={0.5} sx={{ alignItems: 'flex-end' }}>
                          <Switch 
                            checked={t.is_active} 
                            onChange={() => handleToggleTargetStatus(t)}
                            size="small"
                          />
                          <Stack direction="row" spacing={0.5} sx={{ mt: 1 }}>
                            <Tooltip title="Run scraper now">
                              <IconButton 
                                size="small" 
                                color="secondary" 
                                onClick={() => handleTriggerScrape(t.id)}
                                disabled={scrapingId !== null}
                              >
                                {scrapingId === t.id ? <CircularProgress size={16} /> : <RefreshIcon fontSize="small" />}
                              </IconButton>
                            </Tooltip>
                            <IconButton size="small" color="error" onClick={() => handleDeleteTarget(t.id)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Stack>
                        </Stack>
                      </Stack>
                      
                      {t.last_scraped && (
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1.5 }}>
                          Last scanned: {new Date(t.last_scraped).toLocaleString()}
                        </Typography>
                      )}
                    </Paper>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Right Side: Matched Job Postings Feed */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>Discovered Positions Feed</Typography>

              {loadingJobs ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
              ) : jobs.length === 0 ? (
                <Paper sx={{ p: 6, textAlign: 'center', color: 'text.secondary', border: '1px dashed rgba(255,255,255,0.1)' }}>
                  <SearchIcon sx={{ fontSize: 48, opacity: 0.3, mb: 1 }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>No matched positions yet</Typography>
                  <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                    Activate scraper targets and run manual scans, or await background cron sweeps.
                  </Typography>
                </Paper>
              ) : (
                <Stack spacing={2} sx={{ maxHeight: '70vh', overflowY: 'auto', pr: 1 }}>
                  {jobs.map((job) => {
                    const company = targets.find(t => t.id === job.target_id)?.company_name || 'Target Company';
                    return (
                      <Paper 
                        key={job.id} 
                        sx={{ 
                          p: 2.5, 
                          bgcolor: job.is_new ? 'rgba(124, 58, 237, 0.02)' : 'transparent',
                          border: job.is_new ? '1px solid rgba(124, 58, 237, 0.1)' : '1px solid rgba(255,255,255,0.04)'
                        }}
                      >
                        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                          <Box sx={{ maxWidth: '80%' }}>
                            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
                              <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>{job.title}</Typography>
                              {job.is_new && <Chip label="NEW" size="small" color="primary" sx={{ height: 18, fontSize: '0.65rem', fontWeight: 800 }} />}
                            </Stack>
                            <Typography variant="subtitle2" color="secondary.main" sx={{ fontWeight: 600 }}>
                              {company}
                            </Typography>
                          </Box>
                          
                          <Stack direction="row" spacing={0.5}>
                            {job.url && (
                              <IconButton size="small" href={job.url} target="_blank" rel="noopener noreferrer" color="primary">
                                <LaunchIcon fontSize="small" />
                              </IconButton>
                            )}
                            <Tooltip title="Add to applications pipeline">
                              <IconButton size="small" color="success" onClick={() => handleOpenAppDialog(job)}>
                                <AddTaskIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            {job.is_new && (
                              <Tooltip title="Mark as read">
                                <IconButton size="small" onClick={() => handleMarkRead(job.id)}>
                                  <DoneIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Stack>
                        </Stack>

                        {job.description_snippet && (
                          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2, fontSize: '0.85rem', lineBreak: 'anywhere' }}>
                            {job.description_snippet}
                          </Typography>
                        )}

                        <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
                          <Typography variant="caption" sx={{ color: 'text.secondary', mr: 1 }}>Matched Keywords:</Typography>
                          {job.matched_keywords.map(kw => (
                            <Chip key={kw} label={kw} size="small" sx={{ height: 18, fontSize: '0.65rem' }} />
                          ))}
                          <Typography variant="caption" sx={{ color: 'text.secondary', ml: 'auto' }}>
                            Discovered on {new Date(job.discovered_at).toLocaleDateString()}
                          </Typography>
                        </Stack>
                      </Paper>
                    );
                  })}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Add Target Dialog */}
      <Dialog open={openAddDialog} onClose={() => setOpenAddDialog(false)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={handleSaveTarget}>
          <DialogTitle sx={{ fontWeight: 800 }}>Add Scraper Target</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={3} sx={{ mt: 1 }}>
              <TextField 
                label="Company Name" 
                value={targetForm.company_name} 
                onChange={(e) => setTargetForm(prev => ({ ...prev, company_name: e.target.value }))} 
                required 
                fullWidth 
              />
              <TextField 
                label="Career Page URL" 
                placeholder="https://company.com/careers"
                value={targetForm.career_url} 
                onChange={(e) => setTargetForm(prev => ({ ...prev, career_url: e.target.value }))} 
                required 
                fullWidth 
              />
              
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>Keywords to Match (Job Roles or Skills)</Typography>
                <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
                  <TextField 
                    label="Add Keyword" 
                    size="small" 
                    value={keywordInput} 
                    onChange={(e) => setKeywordInput(e.target.value)} 
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddKeyword())}
                    fullWidth 
                  />
                  <Button variant="outlined" onClick={handleAddKeyword}>Add</Button>
                </Stack>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {targetForm.keywords.map((kw, i) => (
                    <Chip key={i} label={kw} onDelete={() => handleRemoveKeyword(kw)} size="small" />
                  ))}
                </Box>
              </Box>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => setOpenAddDialog(false)}>Cancel</Button>
            <Button variant="contained" type="submit">Save Target</Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Add to Applications Pipeline Dialog */}
      <Dialog open={openAppDialog} onClose={() => setOpenAppDialog(false)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={handleAddToApplications}>
          <DialogTitle sx={{ fontWeight: 800 }}>Add to Applications Tracker</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={3} sx={{ mt: 1 }}>
              <TextField 
                label="Company" 
                value={appForm.company} 
                onChange={(e) => setAppForm(prev => ({ ...prev, company: e.target.value }))} 
                required 
                fullWidth 
              />
              <TextField 
                label="Position" 
                value={appForm.position} 
                onChange={(e) => setAppForm(prev => ({ ...prev, position: e.target.value }))} 
                required 
                fullWidth 
              />
              <TextField 
                label="Job URL" 
                value={appForm.job_url} 
                onChange={(e) => setAppForm(prev => ({ ...prev, job_url: e.target.value }))} 
                fullWidth 
              />
              <TextField 
                label="Notes" 
                value={appForm.notes} 
                onChange={(e) => setAppForm(prev => ({ ...prev, notes: e.target.value }))} 
                multiline
                rows={3}
                fullWidth 
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => setOpenAppDialog(false)}>Cancel</Button>
            <Button variant="contained" type="submit" color="success">Add to Wishlist</Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
}
