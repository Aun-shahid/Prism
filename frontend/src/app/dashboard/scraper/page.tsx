'use client';

import * as React from 'react';
import { scraperService, ScraperTarget, ScrapedJob, GeneralScraperSource } from '../../../services/scraper';
import { applicationsService } from '../../../services/applications';
import { useAuth } from '../../../hooks/useAuth';
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
  Paper,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
  Pagination
} from '@mui/material';
import { Country, City } from 'country-state-city';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import LaunchIcon from '@mui/icons-material/Launch';
import DoneIcon from '@mui/icons-material/Done';
import AddTaskIcon from '@mui/icons-material/AddTask';
import SearchIcon from '@mui/icons-material/Search';
import LanguageIcon from '@mui/icons-material/Language';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';
import EditIcon from '@mui/icons-material/Edit';

export default function ScraperPage() {
  const [targets, setTargets] = React.useState<ScraperTarget[]>([]);
  const [generalSources, setGeneralSources] = React.useState<GeneralScraperSource[]>([]);
  const [jobs, setJobs] = React.useState<ScrapedJob[]>([]);
  const [loadingTargets, setLoadingTargets] = React.useState(true);
  const [loadingJobs, setLoadingJobs] = React.useState(true);
  const [loadingGeneral, setLoadingGeneral] = React.useState(true);
  const [scrapingId, setScrapingId] = React.useState<string | null>(null);
  const [scrapingGeneralId, setScrapingGeneralId] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState(0);
  
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

  // Dialog for Add General Source
  const [openAddGeneralDialog, setOpenAddGeneralDialog] = React.useState(false);
  const [generalForm, setGeneralForm] = React.useState({
    name: '',
    url: '',
    source_type: 'rss',
    locations: [] as string[]
  });
  const [selectedCountry, setSelectedCountry] = React.useState<any | null>(null);
  const [selectedCity, setSelectedCity] = React.useState<any | null>(null);

  const citiesList = React.useMemo(() => {
    if (!selectedCountry) return [];
    return City.getCitiesOfCountry(selectedCountry.isoCode) || [];
  }, [selectedCountry]);

  // Dialog for Edit General Source
  const [openEditGeneralDialog, setOpenEditGeneralDialog] = React.useState(false);
  const [editGeneralForm, setEditGeneralForm] = React.useState({
    id: '',
    name: '',
    url: '',
    source_type: '',
    locations: [] as string[]
  });
  const [selectedEditCountry, setSelectedEditCountry] = React.useState<any | null>(null);
  const [selectedEditCity, setSelectedEditCity] = React.useState<any | null>(null);

  const editCitiesList = React.useMemo(() => {
    if (!selectedEditCountry) return [];
    return City.getCitiesOfCountry(selectedEditCountry.isoCode) || [];
  }, [selectedEditCountry]);

  // Dialog for adding discovered job to application tracker
  const [openAppDialog, setOpenAppDialog] = React.useState(false);
  const [selectedJob, setSelectedJob] = React.useState<ScrapedJob | null>(null);
  const [appForm, setAppForm] = React.useState({
    company: '',
    position: '',
    job_url: '',
    notes: ''
  });
  const [platformFilter, setPlatformFilter] = React.useState('all');
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [totalJobs, setTotalJobs] = React.useState(0);

  const { user } = useAuth();
  const isAdmin = user?.role === 'super_admin';

  const loadJobs = React.useCallback(async (pageNum: number, filter: string) => {
    setLoadingJobs(true);
    try {
      const targetId = filter === 'all' ? undefined : filter;
      const res = await scraperService.listDiscoveredJobs(targetId, pageNum, 10);
      setJobs(res.jobs);
      setTotalPages(res.pages);
      setTotalJobs(res.total);
    } catch (err) {
      console.error('Failed to load scraper jobs', err);
    } finally {
      setLoadingJobs(false);
    }
  }, []);

  const loadData = React.useCallback(async () => {
    setLoadingTargets(true);
    setLoadingGeneral(true);
    try {
      const promises = [
        scraperService.listTargets(),
        isAdmin ? scraperService.listGeneralSources() : Promise.resolve([])
      ] as const;

      const [targetsData, generalData] = await Promise.all(promises);
      setTargets(targetsData);
      if (isAdmin) {
        setGeneralSources(generalData as GeneralScraperSource[]);
      }
    } catch (err: any) {
      setError('Failed to fetch scraper information. Ensure backend is running.');
    } finally {
      setLoadingTargets(false);
      setLoadingGeneral(false);
    }
  }, [isAdmin]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  React.useEffect(() => {
    loadJobs(page, platformFilter);
  }, [page, platformFilter, loadJobs]);

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
      loadJobs(1, platformFilter);
    } catch (err: any) {
      setError('Crawl completed but failed to scrape. Check target URL access restrictions.');
      loadData();
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

  // --- General Sources CRUD ---
  const handleAddLocation = () => {
    if (selectedCountry) {
      const locString = selectedCity
        ? `${selectedCity.name}, ${selectedCountry.name}`
        : selectedCountry.name;
      if (!generalForm.locations.includes(locString)) {
        setGeneralForm(prev => ({ ...prev, locations: [...prev.locations, locString] }));
      }
      setSelectedCountry(null);
      setSelectedCity(null);
    }
  };

  const handleRemoveLocation = (loc: string) => {
    setGeneralForm(prev => ({ ...prev, locations: prev.locations.filter(l => l !== loc) }));
  };

  const handleSaveGeneralSource = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await scraperService.addGeneralSource(generalForm);
      setOpenAddGeneralDialog(false);
      setGeneralForm({ name: '', url: '', source_type: 'rss', locations: [] });
      setSelectedCountry(null);
      setSelectedCity(null);
      setSuccess('General scraper source added successfully.');
      loadData();
    } catch (err: any) {
      setError('Failed to save general scraper source.');
    }
  };

  const handleOpenEditGeneralDialog = (source: GeneralScraperSource) => {
    setEditGeneralForm({
      id: source.id,
      name: source.name,
      url: source.url,
      source_type: source.source_type,
      locations: source.locations || []
    });
    setSelectedEditCountry(null);
    setSelectedEditCity(null);
    setOpenEditGeneralDialog(true);
  };

  const handleAddEditLocation = () => {
    if (selectedEditCountry) {
      const locString = selectedEditCity
        ? `${selectedEditCity.name}, ${selectedEditCountry.name}`
        : selectedEditCountry.name;
      if (!editGeneralForm.locations.includes(locString)) {
        setEditGeneralForm(prev => ({ ...prev, locations: [...prev.locations, locString] }));
      }
      setSelectedEditCountry(null);
      setSelectedEditCity(null);
    }
  };

  const handleRemoveEditLocation = (loc: string) => {
    setEditGeneralForm(prev => ({ ...prev, locations: prev.locations.filter(l => l !== loc) }));
  };

  const handleUpdateGeneralSource = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await scraperService.updateGeneralSource(editGeneralForm.id, {
        name: editGeneralForm.name,
        url: editGeneralForm.url,
        locations: editGeneralForm.locations
      });
      setOpenEditGeneralDialog(false);
      setSuccess('General scraper source updated successfully.');
      loadData();
    } catch (err: any) {
      setError('Failed to update general scraper source.');
    }
  };

  const handleDeleteGeneralSource = async (id: string) => {
    if (!confirm('Are you sure you want to remove this general scraper source?')) return;
    try {
      await scraperService.deleteGeneralSource(id);
      setSuccess('General source removed.');
      loadData();
    } catch (err: any) {
      alert('Failed to delete general source.');
    }
  };

  const handleToggleGeneralStatus = async (source: GeneralScraperSource) => {
    try {
      await scraperService.updateGeneralSource(source.id, { is_active: !source.is_active });
      loadData();
    } catch (err: any) {
      alert('Failed to update general source status.');
    }
  };

  const handleTriggerGeneralScrape = async (id: string) => {
    setScrapingGeneralId(id);
    setError(null);
    setSuccess(null);
    try {
      const scraped = await scraperService.triggerGeneralScrape(id);
      setSuccess(`General crawl complete! Found ${scraped.length} matching jobs.`);
      loadData();
      loadJobs(1, platformFilter);
    } catch (err: any) {
      setError('Crawl completed but failed to parse feed. Check source URL access restrictions.');
      loadData();
    } finally {
      setScrapingGeneralId(null);
    }
  };

  const getJobCompany = (job: ScrapedJob) => {
    if (job.target_id === 'external') {
      return job.description_snippet?.split(' | ')[0] || 'External Search Match';
    }
    if (job.target_id.startsWith('general_')) {
      const platform = job.target_id.split('_').slice(1).join(' ');
      const platformName = platform.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      const descPart = job.description_snippet?.split(' | ')[0];
      return descPart && descPart !== platformName ? `${descPart} (${platformName})` : platformName;
    }
    return targets.find(t => t.id === job.target_id)?.company_name || 'Scraper Target';
  };

  const handleOpenAppDialog = (job: ScrapedJob) => {
    setSelectedJob(job);
    setAppForm({
      company: getJobCompany(job),
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
      loadJobs(page, platformFilter);
    } catch (err: any) {
      alert('Failed to track job application.');
    }
  };

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: -0.5 }}>
          Custom Job Scraper
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
          Define company career portals and public job search feeds to discover open positions automatically.
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>{success}</Alert>}

      {isAdmin && (
        <Paper sx={{ mb: 4 }}>
          <Tabs 
            value={activeTab} 
            onChange={(_, val) => setActiveTab(val)}
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab icon={<LanguageIcon />} label="Company Targets" />
            <Tab icon={<TravelExploreIcon />} label="General Platforms & RSS Feeds" />
          </Tabs>
        </Paper>
      )}

      <Grid container spacing={3}>
        {/* Left Side: Targets Manager */}
        <Grid size={{ xs: 12, md: 5 }}>
          {!isAdmin || activeTab === 0 ? (
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
                            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                              <Box 
                                sx={{ 
                                  width: 8, 
                                  height: 8, 
                                  borderRadius: '50%', 
                                  bgcolor: t.is_active ? 'success.main' : 'error.main',
                                  boxShadow: t.is_active 
                                    ? '0 0 8px rgba(46, 125, 50, 0.6)' 
                                    : '0 0 8px rgba(211, 47, 47, 0.6)'
                                }} 
                              />
                              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{t.company_name}</Typography>
                            </Stack>
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
          ) : (
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>General Sources & RSS</Typography>
                  <Button variant="outlined" startIcon={<AddIcon />} size="small" onClick={() => setOpenAddGeneralDialog(true)}>
                    Add Feed
                  </Button>
                </Stack>

                {loadingGeneral ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={30} /></Box>
                ) : generalSources.length === 0 ? (
                  <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 2 }}>
                    No general scraper sources configured.
                  </Typography>
                ) : (
                  <List>
                    {generalSources.map((s) => (
                      <Paper key={s.id} sx={{ p: 2, mb: 2, bgcolor: 'rgba(255, 255, 255, 0.01)', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
                        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <Box sx={{ maxWidth: '70%' }}>
                            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                              <Box 
                                sx={{ 
                                  width: 8, 
                                  height: 8, 
                                  borderRadius: '50%', 
                                  bgcolor: s.is_active ? 'success.main' : 'error.main',
                                  boxShadow: s.is_active 
                                    ? '0 0 8px rgba(46, 125, 50, 0.6)' 
                                    : '0 0 8px rgba(211, 47, 47, 0.6)'
                                }} 
                              />
                              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{s.name}</Typography>
                            </Stack>
                            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              {s.url}
                            </Typography>
                            
                            <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                              <Chip 
                                label={s.source_type.toUpperCase().replace('PRESET_', '').replace('_', ' ')} 
                                size="small" 
                                color={s.source_type === 'rss' ? 'primary' : 'secondary'} 
                                variant="outlined" 
                                sx={{ height: 18, fontSize: '0.65rem' }} 
                              />
                              {s.locations && s.locations.map(loc => (
                                <Chip 
                                  key={loc}
                                  label={loc}
                                  size="small"
                                  variant="outlined"
                                  sx={{ height: 18, fontSize: '0.65rem' }}
                                />
                              ))}
                            </Box>
                          </Box>
                          
                          <Stack spacing={0.5} sx={{ alignItems: 'flex-end' }}>
                            <Switch 
                              checked={s.is_active} 
                              onChange={() => handleToggleGeneralStatus(s)}
                              size="small"
                            />
                            <Stack direction="row" spacing={0.5} sx={{ mt: 1 }}>
                              <Tooltip title="Scan this platform now">
                                <IconButton 
                                  size="small" 
                                  color="secondary" 
                                  onClick={() => handleTriggerGeneralScrape(s.id)}
                                  disabled={scrapingGeneralId !== null}
                                >
                                  {scrapingGeneralId === s.id ? <CircularProgress size={16} /> : <RefreshIcon fontSize="small" />}
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Edit scraper source">
                                <IconButton size="small" color="primary" onClick={() => handleOpenEditGeneralDialog(s)}>
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              {s.source_type === 'rss' && (
                                <IconButton size="small" color="error" onClick={() => handleDeleteGeneralSource(s.id)}>
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              )}
                            </Stack>
                          </Stack>
                        </Stack>
                      </Paper>
                    ))}
                  </List>
                )}
              </CardContent>
            </Card>
          )}
        </Grid>

        {/* Right Side: Matched Job Postings Feed */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>Discovered Positions Feed</Typography>
                
                <FormControl size="small" sx={{ minWidth: 180 }}>
                  <InputLabel id="platform-filter-label">Source Filter</InputLabel>
                  <Select
                    labelId="platform-filter-label"
                    label="Source Filter"
                    value={platformFilter}
                    onChange={(e) => {
                      setPlatformFilter(e.target.value);
                      setPage(1);
                    }}
                  >
                    <MenuItem value="all">All Sources</MenuItem>
                    <MenuItem value="general">All General Feeds</MenuItem>
                    <MenuItem value="targets">All Company Targets</MenuItem>
                    {generalSources.map(s => (
                      <MenuItem key={s.id} value={`general_${s.name.toLowerCase().replace(/ /g, '_')}`}>{s.name}</MenuItem>
                    ))}
                    {targets.map(t => (
                      <MenuItem key={t.id} value={t.id}>{t.company_name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>

              {loadingJobs ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
              ) : jobs.length === 0 ? (
                <Paper sx={{ p: 6, textAlign: 'center', color: 'text.secondary', border: '1px dashed rgba(255,255,255,0.1)' }}>
                  <SearchIcon sx={{ fontSize: 48, opacity: 0.3, mb: 1 }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    {totalJobs === 0 ? "No matched positions yet" : "No jobs match this filter"}
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                    {totalJobs === 0 
                      ? "Activate scraper targets and run manual scans, or await background cron sweeps."
                      : "Try selecting a different filter option."}
                  </Typography>
                </Paper>
              ) : (
                <>
                  <Stack spacing={2} sx={{ maxHeight: '70vh', overflowY: 'auto', pr: 1, mb: 2 }}>
                    {jobs.map((job) => {
                      const company = getJobCompany(job);
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
                  
                  {totalPages > 1 && (
                    <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
                      <Pagination 
                        count={totalPages} 
                        page={page} 
                        onChange={(_, val) => setPage(val)} 
                        color="primary" 
                      />
                    </Box>
                  )}
                </>
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
      {/* Add General Source Dialog */}
       <Dialog open={openAddGeneralDialog} onClose={() => setOpenAddGeneralDialog(false)} fullWidth maxWidth="sm">
         <Box component="form" onSubmit={handleSaveGeneralSource}>
           <DialogTitle sx={{ fontWeight: 800 }}>Add General Feed Source</DialogTitle>
           <DialogContent dividers>
             <Stack spacing={3} sx={{ mt: 1 }}>
               <TextField 
                 label="Feed Name" 
                 placeholder="e.g. StackOverflow Jobs RSS"
                 value={generalForm.name} 
                 onChange={(e) => setGeneralForm(prev => ({ ...prev, name: e.target.value }))} 
                 required 
                 fullWidth 
               />
               <TextField 
                 label="Feed / API URL" 
                 placeholder="https://example.com/rss"
                 value={generalForm.url} 
                 onChange={(e) => setGeneralForm(prev => ({ ...prev, url: e.target.value }))} 
                 required 
                 fullWidth 
               />
               
               <FormControl fullWidth>
                 <InputLabel id="general-source-type-label">Feed Type</InputLabel>
                 <Select
                   labelId="general-source-type-label"
                   label="Feed Type"
                   value={generalForm.source_type}
                   onChange={(e) => setGeneralForm(prev => ({ ...prev, source_type: e.target.value }))}
                 >
                   <MenuItem value="rss">RSS Feed (Standard XML)</MenuItem>
                 </Select>
               </FormControl>

               <Box>
                 <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>Target Locations (e.g. United Kingdom, Pakistan)</Typography>
                 <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
                   <Autocomplete
                     options={Country.getAllCountries()}
                     getOptionLabel={(option) => option.name}
                     value={selectedCountry}
                     onChange={(_, newValue) => {
                       setSelectedCountry(newValue);
                       setSelectedCity(null);
                     }}
                     renderInput={(params) => <TextField {...params} label="Country" size="small" />}
                     sx={{ flex: 1 }}
                   />
                   <Autocomplete
                     options={citiesList}
                     getOptionLabel={(option) => option.name}
                     value={selectedCity}
                     onChange={(_, newValue) => setSelectedCity(newValue)}
                     disabled={!selectedCountry}
                     renderInput={(params) => <TextField {...params} label="City (Optional)" size="small" />}
                     sx={{ flex: 1 }}
                   />
                   <Button variant="outlined" onClick={handleAddLocation} disabled={!selectedCountry}>Add</Button>
                 </Stack>
                 <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                   {generalForm.locations.map((loc, i) => (
                     <Chip key={i} label={loc} onDelete={() => handleRemoveLocation(loc)} size="small" />
                   ))}
                 </Box>
               </Box>
             </Stack>
           </DialogContent>
           <DialogActions sx={{ p: 3 }}>
             <Button onClick={() => setOpenAddGeneralDialog(false)}>Cancel</Button>
             <Button variant="contained" type="submit">Save Source</Button>
           </DialogActions>
         </Box>
       </Dialog>

       {/* Edit General Source Dialog */}
       <Dialog open={openEditGeneralDialog} onClose={() => setOpenEditGeneralDialog(false)} fullWidth maxWidth="sm">
         <Box component="form" onSubmit={handleUpdateGeneralSource}>
           <DialogTitle sx={{ fontWeight: 800 }}>Edit General Feed Source</DialogTitle>
           <DialogContent dividers>
             <Stack spacing={3} sx={{ mt: 1 }}>
               <TextField 
                 label="Feed Name" 
                 placeholder="e.g. LinkedIn"
                 value={editGeneralForm.name} 
                 onChange={(e) => setEditGeneralForm(prev => ({ ...prev, name: e.target.value }))} 
                 required 
                 disabled={!editGeneralForm.source_type.includes('rss')}
                 fullWidth 
               />
               <TextField 
                 label="Feed / API URL" 
                 placeholder="https://example.com/rss"
                 value={editGeneralForm.url} 
                 onChange={(e) => setEditGeneralForm(prev => ({ ...prev, url: e.target.value }))} 
                 required 
                 disabled={!editGeneralForm.source_type.includes('rss')}
                 fullWidth 
               />
               
               <Box>
                 <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>Target Locations (e.g. United Kingdom, Pakistan)</Typography>
                 <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
                   <Autocomplete
                     options={Country.getAllCountries()}
                     getOptionLabel={(option) => option.name}
                     value={selectedEditCountry}
                     onChange={(_, newValue) => {
                       setSelectedEditCountry(newValue);
                       setSelectedEditCity(null);
                     }}
                     renderInput={(params) => <TextField {...params} label="Country" size="small" />}
                     sx={{ flex: 1 }}
                   />
                   <Autocomplete
                     options={editCitiesList}
                     getOptionLabel={(option) => option.name}
                     value={selectedEditCity}
                     onChange={(_, newValue) => setSelectedEditCity(newValue)}
                     disabled={!selectedEditCountry}
                     renderInput={(params) => <TextField {...params} label="City (Optional)" size="small" />}
                     sx={{ flex: 1 }}
                   />
                   <Button variant="outlined" onClick={handleAddEditLocation} disabled={!selectedEditCountry}>Add</Button>
                 </Stack>
                 <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                   {editGeneralForm.locations.map((loc, i) => (
                     <Chip key={i} label={loc} onDelete={() => handleRemoveEditLocation(loc)} size="small" />
                   ))}
                 </Box>
               </Box>
             </Stack>
           </DialogContent>
           <DialogActions sx={{ p: 3 }}>
             <Button onClick={() => setOpenEditGeneralDialog(false)}>Cancel</Button>
             <Button variant="contained" type="submit" color="primary">Save Changes</Button>
           </DialogActions>
         </Box>
       </Dialog>
    </Box>
  );
}
