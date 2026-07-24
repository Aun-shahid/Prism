'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Pagination from '@mui/material/Pagination';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import AddTaskIcon from '@mui/icons-material/AddTask';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import DoneIcon from '@mui/icons-material/Done';
import LaunchIcon from '@mui/icons-material/Launch';
import SearchIcon from '@mui/icons-material/Search';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import type { ScrapedJob, ScraperTarget } from '../../../services/scraper';
import { titlesService } from '../../../services/titles';
import { useAuth } from '../../../hooks/useAuth';
import { useApiKeys } from '../../../hooks/useApiKeys';
import NoApiKeyTooltip from '../../../components/NoApiKeyTooltip';
import {
  useAddScraperTargetMutation,
  useCreateApplicationMutation,
  useDeleteScraperTargetMutation,
  useGetScrapedJobsQuery,
  useGetScraperTargetsQuery,
  useMarkJobReadMutation,
  useResearchTargetMutation,
  useTriggerScrapeMutation,
  useUpdateScraperTargetMutation,
  useWatchCompanyMutation,
} from '../../../store/prismApi';
import { useAppDispatch } from '../../../store/hooks';
import { showToast } from '../../../store/uiSlice';
import PageHeader from '../../../components/ui/PageHeader';
import JobCard from '../../../components/ui/JobCard';
import EmptyState from '../../../components/ui/EmptyState';
import { useConfirm } from '../../../components/ui/ConfirmDialog';
import { CardGridSkeleton, FeedSkeleton } from '../../../components/ui/Skeletons';
import TargetCard from '../../../components/watchlist/TargetCard';

const AdminFeeds = dynamic(() => import('../../../components/watchlist/AdminFeeds'), { ssr: false });

export default function WatchlistPage() {
  const { user } = useAuth();
  const { hasActiveKey } = useApiKeys();
  const isAdmin = user?.role === 'super_admin';
  const dispatch = useAppDispatch();
  const confirm = useConfirm();

  // ── Server state ────────────────────────────────────────────────
  const {
    data: targets = [],
    isLoading: loadingTargets,
    error: targetsError,
  } = useGetScraperTargetsQuery(undefined, {
    // Poll only while AI company research is in flight
    pollingInterval: 0,
    skipPollingIfUnfocused: true,
  });

  const anyResearchPending = targets.some((t) => t.research_status === 'pending');
  // Re-subscribe with polling when research is pending
  useGetScraperTargetsQuery(undefined, {
    pollingInterval: anyResearchPending ? 4000 : 0,
    skipPollingIfUnfocused: true,
    skip: !anyResearchPending,
  });

  // "Research complete" toast on pending → done transition
  const prevPendingRef = React.useRef(false);
  React.useEffect(() => {
    if (prevPendingRef.current && !anyResearchPending) {
      dispatch(showToast({ message: 'Company research complete!', severity: 'success' }));
    }
    prevPendingRef.current = anyResearchPending;
  }, [anyResearchPending, dispatch]);

  const [platformFilter, setPlatformFilter] = React.useState('targets');
  const [page, setPage] = React.useState(1);

  const { data: jobsPage, isLoading: loadingJobs } = useGetScrapedJobsQuery(
    { targetId: platformFilter, page, limit: 10 },
    { skip: loadingTargets || targets.length === 0 }
  );
  const jobs = targets.length === 0 ? [] : (jobsPage?.jobs ?? []);
  const totalPages = jobsPage?.pages ?? 1;

  // ── Mutations ───────────────────────────────────────────────────
  const [watchCompany, { isLoading: watching }] = useWatchCompanyMutation();
  const [researchTarget] = useResearchTargetMutation();
  const [addTarget] = useAddScraperTargetMutation();
  const [updateTarget] = useUpdateScraperTargetMutation();
  const [deleteTarget] = useDeleteScraperTargetMutation();
  const [triggerScrape, { isLoading: scanning, originalArgs: scanningId }] = useTriggerScrapeMutation();
  const [markJobRead] = useMarkJobReadMutation();
  const [createApplication] = useCreateApplicationMutation();

  // ── Hero "watch a company" form ────────────────────────────────
  const [companyInput, setCompanyInput] = React.useState('');
  const [watchKeywords, setWatchKeywords] = React.useState<string[]>([]);
  const [watchKeywordsText, setWatchKeywordsText] = React.useState('');
  const [watchKeywordsOptions, setWatchKeywordsOptions] = React.useState<string[]>([]);
  const [watchCareerUrlInput, setWatchCareerUrlInput] = React.useState('');

  React.useEffect(() => {
    const query = watchKeywordsText.trim();
    if (!query) {
      setWatchKeywordsOptions([]);
      return;
    }
    const handle = setTimeout(() => {
      titlesService.search(query, 8).then(setWatchKeywordsOptions).catch(() => setWatchKeywordsOptions([]));
    }, 250);
    return () => clearTimeout(handle);
  }, [watchKeywordsText]);

  // ── Dialogs ─────────────────────────────────────────────────────
  const [openAddDialog, setOpenAddDialog] = React.useState(false);
  const [openManageFeedsDialog, setOpenManageFeedsDialog] = React.useState(false);
  const [openAddGeneralDialog, setOpenAddGeneralDialog] = React.useState(false);
  const [targetForm, setTargetForm] = React.useState({
    company_name: '',
    career_url: '',
    keywords: [] as string[],
  });
  const [keywordInput, setKeywordInput] = React.useState('');
  const [appForm, setAppForm] = React.useState<{
    company: string;
    position: string;
    job_url: string;
    notes: string;
  } | null>(null);

  const [feedRef] = useAutoAnimate<HTMLDivElement>();

  // ── Handlers ────────────────────────────────────────────────────
  const handleWatchCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = companyInput.trim();
    if (!name || watching) return;
    try {
      await watchCompany({
        company_name: name,
        keywords: watchKeywords.map((k) => k.trim()).filter(Boolean),
        career_url: watchCareerUrlInput.trim() || undefined,
      }).unwrap();
      setCompanyInput('');
      setWatchKeywords([]);
      setWatchKeywordsText('');
      setWatchCareerUrlInput('');
      dispatch(
        showToast({
          message: `Watching ${name} — AI research is running, results appear in a moment.`,
          severity: 'success',
        })
      );
    } catch (err) {
      const detail = (err as { data?: { detail?: string } })?.data?.detail;
      dispatch(showToast({ message: detail || 'Failed to add company', severity: 'error' }));
    }
  };

  const handleResearchTarget = async (id: string) => {
    try {
      await researchTarget(id).unwrap();
    } catch (err) {
      const detail = (err as { data?: { detail?: string } })?.data?.detail;
      dispatch(showToast({ message: detail || 'Failed to start research', severity: 'error' }));
    }
  };

  const handleSaveTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addTarget(targetForm).unwrap();
      setOpenAddDialog(false);
      setTargetForm({ company_name: '', career_url: '', keywords: [] });
      setKeywordInput('');
      dispatch(showToast({ message: 'Watchlist target added', severity: 'success' }));
    } catch {
      dispatch(showToast({ message: 'Failed to save watchlist target', severity: 'error' }));
    }
  };

  const handleDeleteTarget = async (target: ScraperTarget) => {
    const ok = await confirm({
      title: `Remove ${target.company_name}?`,
      body: 'All discovered jobs for this company will be deleted.',
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteTarget(target.id).unwrap();
      dispatch(showToast({ message: 'Company removed from watchlist', severity: 'success' }));
    } catch {
      dispatch(showToast({ message: 'Failed to delete watchlist target', severity: 'error' }));
    }
  };

  const handleToggleTargetStatus = async (target: ScraperTarget) => {
    try {
      await updateTarget({ id: target.id, payload: { is_active: !target.is_active } }).unwrap();
    } catch {
      dispatch(showToast({ message: 'Failed to update target status', severity: 'error' }));
    }
  };

  const handleTriggerScrape = async (id: string) => {
    try {
      const scraped = await triggerScrape(id).unwrap();
      dispatch(showToast({ message: `Scan complete! Found ${scraped.length} matching jobs.`, severity: 'success' }));
    } catch (err) {
      const detail = (err as { data?: { detail?: string } })?.data?.detail;
      dispatch(showToast({ message: detail || 'Scan failed. Check the careers page URL.', severity: 'error' }));
    }
  };

  const handleMarkRead = async (jobId: string) => {
    try {
      await markJobRead(jobId).unwrap();
    } catch {
      dispatch(showToast({ message: 'Failed to update job status', severity: 'error' }));
    }
  };

  const getJobCompany = (job: ScrapedJob) => {
    if (job.target_id === 'external') {
      return job.description_snippet?.split(' | ')[0] || 'External Search Match';
    }
    if (job.target_id.startsWith('general_')) {
      const platform = job.target_id.split('_').slice(1).join(' ');
      const platformName = platform
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      const descPart = job.description_snippet?.split(' | ')[0];
      return descPart && descPart !== platformName ? `${descPart} (${platformName})` : platformName;
    }
    return targets.find((t) => t.id === job.target_id)?.company_name || 'Watchlist Target';
  };

  const handleAddToApplications = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appForm) return;
    try {
      await createApplication({ ...appForm, status: 'wishlist' }).unwrap();
      setAppForm(null);
      dispatch(showToast({ message: 'Application created! Added to Wishlist.', severity: 'success' }));
    } catch {
      dispatch(showToast({ message: 'Failed to track job application', severity: 'error' }));
    }
  };

  return (
    <Box>
      <PageHeader
        title="Career Watchlist"
        subtitle="Add a company by name — AI researches it, finds the careers page and monitors it for matching roles."
        actions={
          isAdmin ? (
            <>
              <Button variant="outlined" onClick={() => setOpenManageFeedsDialog(true)}>
                Manage Feeds
              </Button>
              <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setOpenAddGeneralDialog(true)}>
                Add New Feed
              </Button>
            </>
          ) : undefined
        }
      />

      {targetsError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Failed to fetch watchlist information. Ensure backend is running.
        </Alert>
      )}

      {/* Watch a company — hero form */}
      <Card
        sx={{
          mb: 3,
          border: '1px solid rgba(13, 148, 136, 0.25)',
          background: 'linear-gradient(135deg, rgba(13, 148, 136, 0.08) 0%, rgba(5, 150, 105, 0.04) 100%)',
        }}
      >
        <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2 }}>
            <AutoAwesomeIcon sx={{ color: 'primary.main', fontSize: 20 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
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
                sx={{ flex: 2 }}
              />
              <Autocomplete
                multiple
                freeSolo
                options={watchKeywordsOptions}
                value={watchKeywords}
                inputValue={watchKeywordsText}
                onInputChange={(_e, value) => setWatchKeywordsText(value)}
                onChange={(_e, value) => setWatchKeywords(value)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="Extra keywords (optional) — your Target Job Titles from Profile are always searched too"
                    size="small"
                  />
                )}
                size="small"
                sx={{ flex: 3 }}
              />
              <NoApiKeyTooltip blocked={!hasActiveKey}>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={!companyInput.trim() || watching || !hasActiveKey}
                  startIcon={
                    watching ? <CircularProgress size={16} sx={{ color: 'inherit' }} /> : <TravelExploreIcon />
                  }
                  sx={{ px: 3, whiteSpace: 'nowrap' }}
                >
                  Watch & Research
                </Button>
              </NoApiKeyTooltip>
            </Stack>
            <TextField
              placeholder="Careers/jobs page URL (optional) — skips AI having to search for it"
              value={watchCareerUrlInput}
              onChange={(e) => setWatchCareerUrlInput(e.target.value)}
              size="small"
              fullWidth
              sx={{ mt: 1.5 }}
            />
          </Box>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1.25 }}>
            AI finds the official website, careers &amp; jobs pages and a company brief automatically.{' '}
            <Box
              component="span"
              onClick={() => setOpenAddDialog(true)}
              sx={{ color: 'primary.main', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Or add manually with a URL
            </Box>
          </Typography>
        </CardContent>
      </Card>

      {/* Company cards */}
      {loadingTargets ? (
        <Box sx={{ mb: 4 }}>
          <CardGridSkeleton count={3} />
        </Box>
      ) : (
        targets.length > 0 && (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(auto-fill, minmax(320px, 1fr))' },
              gap: 2,
              mb: 4,
            }}
          >
            {targets.map((t) => (
              <TargetCard
                key={t.id}
                target={t}
                scanning={scanning && scanningId === t.id}
                scanDisabled={scanning}
                hasActiveKey={hasActiveKey}
                onResearch={handleResearchTarget}
                onToggle={handleToggleTargetStatus}
                onScrape={handleTriggerScrape}
                onDelete={handleDeleteTarget}
              />
            ))}
          </Box>
        )
      )}

      {/* Discovered positions feed */}
      <Card>
        <CardContent sx={{ p: 3.5 }}>
          <Stack
            direction="row"
            sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}
          >
            <Typography variant="h6">Discovered Positions</Typography>

            {targets.length > 0 && (
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
                  <MenuItem value="targets">All Companies</MenuItem>
                  {targets.map((t) => (
                    <MenuItem key={t.id} value={t.id}>
                      {t.company_name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Stack>

          {loadingJobs && targets.length > 0 ? (
            <FeedSkeleton count={3} />
          ) : jobs.length === 0 ? (
            <EmptyState
              icon={<SearchIcon />}
              title={targets.length === 0 ? 'No companies watched yet' : 'No matched positions yet'}
              description={
                targets.length === 0
                  ? 'Type a company name above and hit "Watch & Research" — AI does the rest.'
                  : 'Run a scan from a company card, or wait for the background scans to pick up new roles.'
              }
            />
          ) : (
            <>
              <Stack spacing={2} ref={feedRef} sx={{ maxHeight: '75vh', overflowY: 'auto', pr: 1, mb: 2 }}>
                {jobs.map((job) => (
                  <JobCard
                    key={job.id}
                    title={job.title}
                    company={getJobCompany(job)}
                    isNew={job.is_new}
                    experience={job.years_experience_display}
                    snippet={job.description_snippet}
                    keywords={job.matched_keywords}
                    discoveredAt={`Discovered on ${new Date(job.discovered_at).toLocaleDateString()}`}
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
                        <Tooltip title="Add to applications pipeline">
                          <IconButton
                            size="small"
                            color="success"
                            onClick={() =>
                              setAppForm({
                                company: getJobCompany(job),
                                position: job.title,
                                job_url: job.url || '',
                                notes: `Discovered automatically matching keywords: ${job.matched_keywords.join(', ')}`,
                              })
                            }
                          >
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
                      </>
                    }
                  />
                ))}
              </Stack>

              {totalPages > 1 && (
                <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
                  <Pagination count={totalPages} page={page} onChange={(_, val) => setPage(val)} color="primary" />
                </Box>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Admin feed dialogs (loaded on demand) */}
      {isAdmin && (
        <AdminFeeds
          manageOpen={openManageFeedsDialog}
          addOpen={openAddGeneralDialog}
          onCloseManage={() => setOpenManageFeedsDialog(false)}
          onCloseAdd={() => setOpenAddGeneralDialog(false)}
          onOpenAdd={() => setOpenAddGeneralDialog(true)}
        />
      )}

      {/* Add target manually */}
      <Dialog open={openAddDialog} onClose={() => setOpenAddDialog(false)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={handleSaveTarget}>
          <DialogTitle>Add Company Manually</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={3} sx={{ mt: 1 }}>
              <TextField
                label="Company Name"
                value={targetForm.company_name}
                onChange={(e) => setTargetForm((prev) => ({ ...prev, company_name: e.target.value }))}
                required
                fullWidth
              />
              <TextField
                label="Career Page URL"
                placeholder="https://company.com/careers"
                value={targetForm.career_url}
                onChange={(e) => setTargetForm((prev) => ({ ...prev, career_url: e.target.value }))}
                required
                fullWidth
              />

              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                  Keywords to Match (Job Roles or Skills)
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
                  <TextField
                    label="Add Keyword"
                    size="small"
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const kw = keywordInput.trim();
                        if (kw && !targetForm.keywords.includes(kw)) {
                          setTargetForm((prev) => ({ ...prev, keywords: [...prev.keywords, kw] }));
                          setKeywordInput('');
                        }
                      }
                    }}
                    fullWidth
                  />
                  <Button
                    variant="outlined"
                    onClick={() => {
                      const kw = keywordInput.trim();
                      if (kw && !targetForm.keywords.includes(kw)) {
                        setTargetForm((prev) => ({ ...prev, keywords: [...prev.keywords, kw] }));
                        setKeywordInput('');
                      }
                    }}
                  >
                    Add
                  </Button>
                </Stack>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {targetForm.keywords.map((kw) => (
                    <Chip
                      key={kw}
                      label={kw}
                      onDelete={() =>
                        setTargetForm((prev) => ({ ...prev, keywords: prev.keywords.filter((k) => k !== kw) }))
                      }
                      size="small"
                    />
                  ))}
                </Box>
              </Box>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => setOpenAddDialog(false)}>Cancel</Button>
            <Button variant="contained" type="submit">
              Save Target
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Add to applications */}
      <Dialog open={Boolean(appForm)} onClose={() => setAppForm(null)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={handleAddToApplications}>
          <DialogTitle>Add to Applications Tracker</DialogTitle>
          <DialogContent dividers>
            {appForm && (
              <Stack spacing={3} sx={{ mt: 1 }}>
                <TextField
                  label="Company"
                  value={appForm.company}
                  onChange={(e) => setAppForm({ ...appForm, company: e.target.value })}
                  required
                  fullWidth
                />
                <TextField
                  label="Position"
                  value={appForm.position}
                  onChange={(e) => setAppForm({ ...appForm, position: e.target.value })}
                  required
                  fullWidth
                />
                <TextField
                  label="Job URL"
                  value={appForm.job_url}
                  onChange={(e) => setAppForm({ ...appForm, job_url: e.target.value })}
                  fullWidth
                />
                <TextField
                  label="Notes"
                  value={appForm.notes}
                  onChange={(e) => setAppForm({ ...appForm, notes: e.target.value })}
                  multiline
                  rows={3}
                  fullWidth
                />
              </Stack>
            )}
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => setAppForm(null)}>Cancel</Button>
            <Button variant="contained" type="submit" color="success">
              Add to Wishlist
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
}
