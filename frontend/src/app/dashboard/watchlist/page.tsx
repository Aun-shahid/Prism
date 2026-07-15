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
  TextField,
  Button,
  IconButton,
  Stack,
  Alert,
  CircularProgress,
  LinearProgress,
  Chip,
  Switch,
  List,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  Paper,
  Avatar,
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
import EditIcon from '@mui/icons-material/Edit';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';
import LanguageIcon from '@mui/icons-material/Language';
import WorkOutlineIcon from '@mui/icons-material/WorkOutlined';
import BusinessIcon from '@mui/icons-material/Business';
import PlaceIcon from '@mui/icons-material/Place';
import GroupsIcon from '@mui/icons-material/Groups';

export default function WatchlistPage() {
  const [targets, setTargets] = React.useState<ScraperTarget[]>([]);
  const [generalSources, setGeneralSources] = React.useState<GeneralScraperSource[]>([]);
  const [jobs, setJobs] = React.useState<ScrapedJob[]>([]);
  const [loadingTargets, setLoadingTargets] = React.useState(true);
  const [loadingJobs, setLoadingJobs] = React.useState(true);
  const [loadingGeneral, setLoadingGeneral] = React.useState(true);
  const [scrapingId, setScrapingId] = React.useState<string | null>(null);
  const [scrapingGeneralId, setScrapingGeneralId] = React.useState<string | null>(null);

  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  // Hero "watch a company" form
  const [companyInput, setCompanyInput] = React.useState('');
  const [watchKeywordsInput, setWatchKeywordsInput] = React.useState('');
  const [watching, setWatching] = React.useState(false);

  // Dialog for manual Add target (with URL)
  const [openAddDialog, setOpenAddDialog] = React.useState(false);
  const [openManageFeedsDialog, setOpenManageFeedsDialog] = React.useState(false);
  const [targetForm, setTargetForm] = React.useState({
    company_name: '',
    career_url: '',
    keywords: [] as string[]
  });
  const [keywordInput, setKeywordInput] = React.useState('');

  // Dialog for Add General Source (admin)
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

  // Dialog for Edit General Source (admin)
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
  const [appForm, setAppForm] = React.useState({
    company: '',
    position: '',
    job_url: '',
    notes: ''
  });
  const [platformFilter, setPlatformFilter] = React.useState('targets');
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);

  const { user } = useAuth();
  const isAdmin = user?.role === 'super_admin';

  const loadJobs = React.useCallback(async (pageNum: number, filter: string) => {
    if (loadingTargets) return;

    if (targets.length === 0) {
      setJobs([]);
      setTotalPages(1);
      setLoadingJobs(false);
      return;
    }

    setLoadingJobs(true);
    try {
      const targetId = filter === 'all' ? 'targets' : filter;
      const res = await scraperService.listDiscoveredJobs(targetId, pageNum, 10);
      setJobs(res.jobs);
      setTotalPages(res.pages);
    } catch (err) {
      console.error('Failed to load watchlist jobs', err);
    } finally {
      setLoadingJobs(false);
    }
  }, [targets, loadingTargets]);

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
      setError('Failed to fetch watchlist information. Ensure backend is running.');
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

  // Live-refresh the feed when the backend reports newly discovered postings
  // (dispatched from the dashboard layout's notification stream).
  React.useEffect(() => {
    const onJobsUpdated = () => {
      loadData();
      loadJobs(page, platformFilter);
    };
    window.addEventListener('prism:jobs-updated', onJobsUpdated);
    return () => window.removeEventListener('prism:jobs-updated', onJobsUpdated);
  }, [loadData, loadJobs, page, platformFilter]);

  // Poll while any company research is in flight
  const anyResearchPending = targets.some(t => t.research_status === 'pending');
  React.useEffect(() => {
    if (!anyResearchPending) return;
    const timer = setInterval(async () => {
      try {
        const fresh = await scraperService.listTargets();
        setTargets(fresh);
        if (!fresh.some(t => t.research_status === 'pending')) {
          setSuccess('Company research complete!');
        }
      } catch (err) {
        console.error('Failed to poll targets', err);
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [anyResearchPending]);

  // --- Watch a company (AI research flow) ---
  const handleWatchCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = companyInput.trim();
    if (!name || watching) return;
    setWatching(true);
    setError(null);
    try {
      const keywords = watchKeywordsInput
        .split(',')
        .map(k => k.trim())
        .filter(Boolean);
      const target = await scraperService.watchCompany({ company_name: name, keywords });
      setTargets(prev => [target, ...prev]);
      setCompanyInput('');
      setWatchKeywordsInput('');
      setSuccess(`Watching ${name} — AI research is running, results appear in a moment.`);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to add company.');
    } finally {
      setWatching(false);
    }
  };

  const handleResearchTarget = async (id: string) => {
    try {
      const updated = await scraperService.researchTarget(id);
      setTargets(prev => prev.map(t => (t.id === id ? updated : t)));
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to start research.');
    }
  };

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
      setSuccess('Watchlist target added successfully.');
      loadData();
    } catch (err: any) {
      setError('Failed to save watchlist target.');
    }
  };

  const handleDeleteTarget = async (id: string) => {
    if (!confirm('Remove this company? All discovered jobs for it will be deleted.')) return;
    try {
      await scraperService.deleteTarget(id);
      setSuccess('Company removed from watchlist.');
      loadData();
    } catch (err: any) {
      alert('Failed to delete watchlist target.');
    }
  };

  const handleToggleTargetStatus = async (target: ScraperTarget) => {
    try {
      await scraperService.updateTarget(target.id, { is_active: !target.is_active });
      setTargets(prev => prev.map(t => (t.id === target.id ? { ...t, is_active: !t.is_active } : t)));
    } catch (err: any) {
      alert('Failed to update watchlist target status.');
    }
  };

  const handleTriggerScrape = async (id: string) => {
    setScrapingId(id);
    setError(null);
    setSuccess(null);
    try {
      const scraped = await scraperService.triggerScrape(id);
      setSuccess(`Scan complete! Found ${scraped.length} matching jobs.`);
      loadData();
      loadJobs(1, platformFilter);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Scan failed. Check the careers page URL.');
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

  // --- General Sources CRUD (admin) ---
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
      setSuccess('General feed source added successfully.');
      loadData();
    } catch (err: any) {
      setError('Failed to save general feed source.');
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
    setEditGeneralForm(prev => ({ ...prev, locations: editGeneralForm.locations.filter(l => l !== loc) }));
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
      setSuccess('General feed source updated successfully.');
      loadData();
    } catch (err: any) {
      setError('Failed to update general feed source.');
    }
  };

  const handleDeleteGeneralSource = async (id: string) => {
    if (!confirm('Are you sure you want to remove this general feed source?')) return;
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
      setSuccess(`General scan complete! Found ${scraped.length} matching jobs.`);
      loadData();
      loadJobs(1, platformFilter);
    } catch (err: any) {
      setError('Scan completed but failed to parse feed. Check source URL access restrictions.');
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
    return targets.find(t => t.id === job.target_id)?.company_name || 'Watchlist Target';
  };

  const handleOpenAppDialog = (job: ScrapedJob) => {
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
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: -0.5 }}>
            Career Watchlist
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            Add a company by name — AI researches it, finds the careers page and monitors it for matching roles.
          </Typography>
        </Box>
        {isAdmin && (
          <Stack direction="row" spacing={1.5}>
            <Button variant="outlined" onClick={() => setOpenManageFeedsDialog(true)} sx={{ fontWeight: 700 }}>
              Manage Feeds
            </Button>
            <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setOpenAddGeneralDialog(true)} sx={{ fontWeight: 700 }}>
              Add New Feed
            </Button>
          </Stack>
        )}
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>{success}</Alert>}

      {/* Watch a company — hero form */}
      <Card
        sx={{
          mb: 3,
          border: '1px solid rgba(167,139,250,0.25)',
          background: 'linear-gradient(135deg, rgba(124,58,237,0.10) 0%, rgba(16,185,129,0.06) 100%)',
        }}
      >
        <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2 }}>
            <AutoAwesomeIcon sx={{ color: '#a78bfa', fontSize: 20 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
              Watch a company
            </Typography>
          </Stack>
          <Box component="form" onSubmit={handleWatchCompany}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
              <TextField
                placeholder="Company name — e.g. Stripe"
                value={companyInput}
                onChange={(e) => setCompanyInput(e.target.value)}
                size="small"
                sx={{ flex: 2, bgcolor: 'rgba(9,13,22,0.5)', borderRadius: 1 }}
              />
              <TextField
                placeholder="Keywords (optional, comma-separated) — e.g. frontend, react"
                value={watchKeywordsInput}
                onChange={(e) => setWatchKeywordsInput(e.target.value)}
                size="small"
                sx={{ flex: 3, bgcolor: 'rgba(9,13,22,0.5)', borderRadius: 1 }}
              />
              <Button
                type="submit"
                variant="contained"
                disabled={!companyInput.trim() || watching}
                startIcon={watching ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : <TravelExploreIcon />}
                sx={{
                  fontWeight: 700,
                  px: 3,
                  whiteSpace: 'nowrap',
                  background: 'linear-gradient(135deg, #7c3aed 0%, #10b981 100%)',
                  boxShadow: '0 4px 12px 0 rgba(124, 58, 237, 0.3)',
                }}
              >
                Watch & Research
              </Button>
            </Stack>
          </Box>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1.25 }}>
            AI finds the official website, careers &amp; jobs pages and a company brief automatically.{' '}
            <Box
              component="span"
              onClick={() => setOpenAddDialog(true)}
              sx={{ color: '#a78bfa', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Or add manually with a URL
            </Box>
          </Typography>
        </CardContent>
      </Card>

      {/* Company cards */}
      {loadingTargets ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : targets.length > 0 && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(auto-fill, minmax(320px, 1fr))' },
            gap: 2,
            mb: 4,
          }}
        >
          {targets.map((t) => (
            <Card
              key={t.id}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                opacity: t.is_active ? 1 : 0.55,
                transition: 'opacity 0.2s',
              }}
            >
              {t.research_status === 'pending' && <LinearProgress sx={{ height: 2 }} />}
              <CardContent sx={{ p: 2.5, display: 'flex', flexDirection: 'column', flex: 1 }}>
                {/* Card header */}
                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 1.5 }}>
                  <Avatar
                    sx={{
                      width: 40,
                      height: 40,
                      fontWeight: 800,
                      bgcolor: 'rgba(124,58,237,0.25)',
                      color: '#c4b5fd',
                    }}
                  >
                    {t.company_name.charAt(0).toUpperCase()}
                  </Avatar>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.company_name}
                    </Typography>
                    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', mt: 0.25 }}>
                      {t.industry && (
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>{t.industry}</Typography>
                      )}
                    </Stack>
                  </Box>
                  {t.research_status === 'pending' && (
                    <Chip label="Researching…" size="small" sx={{ height: 20, fontSize: '0.65rem', bgcolor: 'rgba(124,58,237,0.2)', color: '#c4b5fd' }} />
                  )}
                  {t.research_status === 'failed' && (
                    <Tooltip title="Research failed — click to retry">
                      <Chip
                        label="Retry research"
                        size="small"
                        color="warning"
                        variant="outlined"
                        onClick={() => handleResearchTarget(t.id)}
                        sx={{ height: 20, fontSize: '0.65rem' }}
                      />
                    </Tooltip>
                  )}
                </Stack>

                {/* Company brief */}
                {t.description ? (
                  <Typography
                    variant="body2"
                    sx={{
                      color: 'text.secondary',
                      fontSize: '0.82rem',
                      mb: 1.5,
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {t.description}
                  </Typography>
                ) : t.research_status === 'pending' ? (
                  <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.82rem', mb: 1.5, fontStyle: 'italic' }}>
                    Reading their website and hunting for the careers page…
                  </Typography>
                ) : null}

                {/* Meta */}
                {(t.headquarters || t.company_size) && (
                  <Stack direction="row" spacing={2} sx={{ mb: 1.5, flexWrap: 'wrap' }}>
                    {t.headquarters && (
                      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                        <PlaceIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>{t.headquarters}</Typography>
                      </Stack>
                    )}
                    {t.company_size && (
                      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                        <GroupsIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>{t.company_size}</Typography>
                      </Stack>
                    )}
                  </Stack>
                )}

                {/* Links */}
                <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', gap: 0.75, mb: 1.5 }}>
                  {t.website && (
                    <Chip
                      icon={<LanguageIcon sx={{ fontSize: 13 }} />}
                      label="Website"
                      size="small"
                      component="a"
                      href={t.website}
                      target="_blank"
                      clickable
                      sx={{ height: 24, fontSize: '0.7rem' }}
                    />
                  )}
                  {t.career_url && (
                    <Chip
                      icon={<WorkOutlineIcon sx={{ fontSize: 13 }} />}
                      label="Careers"
                      size="small"
                      component="a"
                      href={t.career_url}
                      target="_blank"
                      clickable
                      color="primary"
                      variant="outlined"
                      sx={{ height: 24, fontSize: '0.7rem' }}
                    />
                  )}
                  {t.jobs_url && t.jobs_url !== t.career_url && (
                    <Chip
                      icon={<BusinessIcon sx={{ fontSize: 13 }} />}
                      label="Open roles"
                      size="small"
                      component="a"
                      href={t.jobs_url}
                      target="_blank"
                      clickable
                      color="secondary"
                      variant="outlined"
                      sx={{ height: 24, fontSize: '0.7rem' }}
                    />
                  )}
                </Stack>

                {/* Keywords */}
                {t.keywords.length > 0 && (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                    {t.keywords.map(kw => (
                      <Chip key={kw} label={kw} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} />
                    ))}
                  </Box>
                )}

                {/* Footer actions */}
                <Stack direction="row" sx={{ mt: 'auto', pt: 1, alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <Tooltip title={t.is_active ? 'Monitoring active' : 'Monitoring paused'}>
                    <Switch checked={t.is_active} onChange={() => handleToggleTargetStatus(t)} size="small" />
                  </Tooltip>
                  <Stack direction="row" spacing={0.5}>
                    <Tooltip title={t.career_url ? 'Scan careers page now' : 'No careers URL yet'}>
                      <span>
                        <IconButton
                          size="small"
                          color="secondary"
                          onClick={() => handleTriggerScrape(t.id)}
                          disabled={scrapingId !== null || !t.career_url}
                        >
                          {scrapingId === t.id ? <CircularProgress size={16} /> : <RefreshIcon fontSize="small" />}
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Re-run AI research">
                      <span>
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleResearchTarget(t.id)}
                          disabled={t.research_status === 'pending'}
                        >
                          <AutoAwesomeIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <IconButton size="small" color="error" onClick={() => handleDeleteTarget(t.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </Stack>
                {t.last_scraped && (
                  <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.75, fontSize: '0.65rem' }}>
                    Last scanned {new Date(t.last_scraped).toLocaleString()}
                  </Typography>
                )}
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      {/* Discovered Positions Feed */}
      <Card sx={{ borderRadius: '12px' }}>
        <CardContent sx={{ p: 3.5 }}>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>Discovered Positions</Typography>

            {targets.length > 0 && (
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel id="platform-filter-label">Source Filter</InputLabel>
                <Select
                  labelId="platform-filter-label"
                  label="Source Filter"
                  value={platformFilter === 'all' ? 'targets' : platformFilter}
                  onChange={(e) => {
                    setPlatformFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <MenuItem value="targets">All Companies</MenuItem>
                  {targets.map(t => (
                    <MenuItem key={t.id} value={t.id}>{t.company_name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Stack>

          {loadingJobs ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
          ) : jobs.length === 0 ? (
            <Paper sx={{ p: 8, textAlign: 'center', color: 'text.secondary', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '8px' }}>
              <SearchIcon sx={{ fontSize: 56, opacity: 0.3, mb: 1.5 }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
                {targets.length === 0 ? 'No companies watched yet' : 'No matched positions yet'}
              </Typography>
              <Typography variant="body2" sx={{ display: 'block', maxWidth: 450, mx: 'auto', opacity: 0.7 }}>
                {targets.length === 0
                  ? 'Type a company name above and hit "Watch & Research" — AI does the rest.'
                  : 'Run a scan from a company card, or wait for the background scans to pick up new roles.'}
              </Typography>
            </Paper>
          ) : (
            <>
              <Stack spacing={2} sx={{ maxHeight: '75vh', overflowY: 'auto', pr: 1, mb: 2 }}>
                {jobs.map((job) => {
                  const company = getJobCompany(job);
                  return (
                    <Paper
                       key={job.id}
                       sx={{
                         p: 3,
                         bgcolor: job.is_new ? 'rgba(124, 58, 237, 0.02)' : 'transparent',
                         border: job.is_new ? '1px solid rgba(124, 58, 237, 0.1)' : '1px solid rgba(255,255,255,0.04)',
                         borderRadius: '8px',
                         transition: 'transform 0.2s, box-shadow 0.2s',
                         '&:hover': {
                           transform: 'translateY(-1px)',
                           boxShadow: '0 4px 20px 0 rgba(0,0,0,0.2)'
                         }
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

      {/* Manage General Feeds Dialog (Admin only) */}
      {isAdmin && (
        <Dialog
          open={openManageFeedsDialog}
          onClose={() => setOpenManageFeedsDialog(false)}
          fullWidth
          maxWidth="md"
        >
          <DialogTitle component="div" sx={{ fontWeight: 800, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" component="div" sx={{ fontWeight: 800 }}>General Sources & RSS Feeds ({generalSources.length})</Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              size="small"
              onClick={() => {
                setOpenManageFeedsDialog(false);
                setOpenAddGeneralDialog(true);
              }}
              sx={{ textTransform: 'none' }}
            >
              Add Feed
            </Button>
          </DialogTitle>
          <DialogContent dividers>
            {loadingGeneral ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={30} /></Box>
            ) : generalSources.length === 0 ? (
              <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 4 }}>
                No general scraper sources configured.
              </Typography>
            ) : (
              <List sx={{ pt: 1 }}>
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
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', mt: 0.5 }}>
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
          </DialogContent>
          <DialogActions sx={{ p: 2.5 }}>
            <Button onClick={() => setOpenManageFeedsDialog(false)} variant="outlined">Close</Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Add Target Manually Dialog */}
      <Dialog open={openAddDialog} onClose={() => setOpenAddDialog(false)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={handleSaveTarget}>
          <DialogTitle sx={{ fontWeight: 800 }}>Add Company Manually</DialogTitle>
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
