'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { 
  applicationsService, 
  JobApplication, 
  ApplicationStatus 
} from '../../../services/applications';
import {
  Box,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  IconButton,
  Stack,
  Alert,
  CircularProgress,
  Paper,
  Tabs,
  Tab,
  FormControlLabel,
  Switch,
  Autocomplete,
  Tooltip,
  TableContainer
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import SearchIcon from '@mui/icons-material/Search';
import ViewKanbanIcon from '@mui/icons-material/ViewKanban';
import ViewListIcon from '@mui/icons-material/ViewList';
import InfoIcon from '@mui/icons-material/Info';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import SendIcon from '@mui/icons-material/Send';
import LinkIcon from '@mui/icons-material/Link';
import { useRouter } from 'next/navigation';

const STATUSES: { value: ApplicationStatus; label: string; color: string }[] = [
  { value: 'wishlist', label: 'Wishlist', color: 'rgba(156, 163, 175, 0.2)' },
  { value: 'applied', label: 'Applied', color: 'rgba(59, 130, 246, 0.2)' },
  { value: 'interviewing', label: 'Interviewing', color: 'rgba(245, 158, 11, 0.2)' },
  { value: 'offered', label: 'Offered', color: 'rgba(16, 185, 129, 0.2)' },
  { value: 'rejected', label: 'Rejected', color: 'rgba(239, 68, 68, 0.2)' },
  { value: 'withdrawn', label: 'Withdrawn', color: 'rgba(107, 114, 128, 0.2)' },
];

export default function ApplicationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [viewTab, setViewTab] = React.useState<'board' | 'list'>('board');
  const [applications, setApplications] = React.useState<JobApplication[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  
  // Search & Filter
  const [search, setSearch] = React.useState('');
  
  // Dialog State
  const [openDialog, setOpenDialog] = React.useState(false);
  const [openDetailDialog, setOpenDetailDialog] = React.useState(false);
  const [selectedApp, setSelectedApp] = React.useState<JobApplication | null>(null);
  const [editingApp, setEditingApp] = React.useState<JobApplication | null>(null);
  
  const [formState, setFormState] = React.useState({
    company: '',
    position: '',
    job_url: '',
    job_description: '',
    status: 'wishlist' as ApplicationStatus,
    salary_min: '',
    salary_max: '',
    location: '',
    remote: false,
    applied_date: '',
    notes: '',
    contact_name: '',
    contact_email: '',
    tags: [] as string[]
  });

  const [tagInput, setTagInput] = React.useState('');

  const fetchApplications = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await applicationsService.listApplications();
      setApplications(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to fetch applications');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  // Handle open dialog for Add
  const handleOpenAdd = () => {
    setEditingApp(null);
    setFormState({
      company: '',
      position: '',
      job_url: '',
      job_description: '',
      status: 'wishlist',
      salary_min: '',
      salary_max: '',
      location: '',
      remote: false,
      applied_date: new Date().toISOString().split('T')[0],
      notes: '',
      contact_name: '',
      contact_email: '',
      tags: []
    });
    setOpenDialog(true);
  };

  // Handle open dialog for Edit
  const handleOpenEdit = (app: JobApplication) => {
    setEditingApp(app);
    setFormState({
      company: app.company,
      position: app.position,
      job_url: app.job_url || '',
      job_description: app.job_description || '',
      status: app.status,
      salary_min: app.salary_min !== undefined ? app.salary_min.toString() : '',
      salary_max: app.salary_max !== undefined ? app.salary_max.toString() : '',
      location: app.location || '',
      remote: app.remote || false,
      applied_date: app.applied_date ? app.applied_date.split('T')[0] : '',
      notes: app.notes || '',
      contact_name: app.contact_name || '',
      contact_email: app.contact_email || '',
      tags: app.tags || []
    });
    setOpenDialog(true);
    setOpenDetailDialog(false);
  };

  const handleOpenDetails = (app: JobApplication) => {
    setSelectedApp(app);
    setOpenDetailDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  const handleCloseDetailDialog = () => {
    setOpenDetailDialog(false);
    setSelectedApp(null);
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormState(prev => ({ ...prev, [name]: value }));
  };

  const handleSwitchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormState(prev => ({ ...prev, [name]: checked }));
  };

  const handleSelectChange = (name: string, value: any) => {
    setFormState(prev => ({ ...prev, [name]: value }));
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !formState.tags.includes(tagInput.trim())) {
      setFormState(prev => ({ ...prev, tags: [...prev.tags, tagInput.trim()] }));
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormState(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tagToRemove) }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const payload: any = {
        ...formState,
        salary_min: formState.salary_min ? parseFloat(formState.salary_min) : undefined,
        salary_max: formState.salary_max ? parseFloat(formState.salary_max) : undefined,
        applied_date: formState.applied_date ? new Date(formState.applied_date).toISOString() : undefined,
      };

      if (editingApp) {
        await applicationsService.updateApplication(editingApp.id, payload);
      } else {
        await applicationsService.createApplication(payload);
      }
      fetchApplications();
      handleCloseDialog();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save application');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this application?')) return;
    try {
      await applicationsService.deleteApplication(id);
      fetchApplications();
      handleCloseDetailDialog();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to delete application');
    }
  };

  const handleMoveStatus = async (app: JobApplication, newStatus: ApplicationStatus) => {
    try {
      await applicationsService.updateApplication(app.id, { status: newStatus });
      fetchApplications();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to update application status');
    }
  };

  const getStatusLabel = (status: ApplicationStatus) => {
    return STATUSES.find(s => s.value === status)?.label || status;
  };

  // Filtering applications
  const filteredApps = applications.filter(app => {
    const query = search.toLowerCase();
    return (
      app.company.toLowerCase().includes(query) ||
      app.position.toLowerCase().includes(query) ||
      (app.location && app.location.toLowerCase().includes(query)) ||
      app.tags.some(tag => tag.toLowerCase().includes(query))
    );
  });

  return (
    <Box>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: -0.5 }}>
            Applications Tracker
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            Track details, tailor resumes, and manage recruiter communication logs.
          </Typography>
        </Box>
        <Button 
          variant="contained" 
          startIcon={<AddIcon />} 
          onClick={handleOpenAdd}
          sx={{ 
            background: 'linear-gradient(135deg, #7c3aed 0%, #10b981 100%)',
            boxShadow: '0 4px 12px rgba(124,58,237,0.3)'
          }}
        >
          Add Job Position
        </Button>
      </Stack>

      {/* Toolbar / Filters */}
      <Paper sx={{ p: 2, mb: 4, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', justifyContent: 'space-between' }}>
        <Stack direction="row" spacing={2} sx={{ width: { xs: '100%', md: '400px' } }}>
          <TextField
            placeholder="Search company, position, skills..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            size="small"
            fullWidth
            slotProps={{
              input: {
                startAdornment: <SearchIcon sx={{ color: 'text.secondary', mr: 1 }} />,
              }
            }}
          />
        </Stack>
        
        <Tabs 
          value={viewTab} 
          onChange={(_, val) => setViewTab(val)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab icon={<ViewKanbanIcon />} label="Kanban Board" value="board" />
          <Tab icon={<ViewListIcon />} label="List View" value="list" />
        </Tabs>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : viewTab === 'board' ? (
        /* Kanban Board View */
        <Box sx={{ overflowX: 'auto', pb: 2 }}>
          <Grid container spacing={2} sx={{ minWidth: 1000 }}>
            {STATUSES.map((col) => {
              const colApps = filteredApps.filter(app => app.status === col.value);
              return (
                <Grid size={{ xs: 2 }} key={col.value} sx={{ minWidth: 200 }}>
                  <Paper 
                    sx={{ 
                      p: 1.5, 
                      minHeight: '60vh', 
                      bgcolor: 'rgba(255, 255, 255, 0.02)',
                      borderTop: `4px solid ${col.value === 'offered' ? '#10b981' : col.value === 'rejected' ? '#ef4444' : col.value === 'interviewing' ? '#f59e0b' : '#a78bfa'}`
                    }}
                  >
                    <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                        {col.label}
                      </Typography>
                      <Chip label={colApps.length} size="small" sx={{ fontWeight: 700, height: 20 }} />
                    </Stack>
                    
                    <Stack spacing={1.5}>
                      {colApps.map((app) => (
                        <Card 
                          key={app.id} 
                          onClick={() => handleOpenDetails(app)}
                          sx={{ 
                            cursor: 'pointer', 
                            transition: 'transform 0.2s', 
                            '&:hover': { transform: 'translateY(-2px)', borderColor: 'primary.main' } 
                          }}
                        >
                          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                              {app.company}
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1, fontSize: '0.85rem' }}>
                              {app.position}
                            </Typography>
                            {app.location && (
                              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1.5 }}>
                                {app.location} {app.remote && '(Remote)'}
                              </Typography>
                            )}
                            <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap' }}>
                              {app.tags.slice(0, 2).map((t) => (
                                <Chip key={t} label={t} size="small" sx={{ fontSize: '0.7rem', height: 18 }} />
                              ))}
                            </Stack>
                          </CardContent>
                        </Card>
                      ))}
                    </Stack>
                  </Paper>
                </Grid>
              );
            })}
          </Grid>
        </Box>
      ) : (
        /* List View */
        <TableContainer component={Paper} sx={{ border: '1px solid rgba(255,255,255,0.08)' }}>
          <Box sx={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', color: '#f3f4f6' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', textAlign: 'left', background: 'rgba(255,255,255,0.01)' }}>
                  <th style={{ padding: '16px', fontWeight: 700 }}>Company</th>
                  <th style={{ padding: '16px', fontWeight: 700 }}>Job Position</th>
                  <th style={{ padding: '16px', fontWeight: 700 }}>Location</th>
                  <th style={{ padding: '16px', fontWeight: 700 }}>Salary Range</th>
                  <th style={{ padding: '16px', fontWeight: 700 }}>Status</th>
                  <th style={{ padding: '16px', fontWeight: 700, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredApps.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: '#9ca3af' }}>
                      No applications found.
                    </td>
                  </tr>
                ) : (
                  filteredApps.map((app) => (
                    <tr key={app.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer' }} onClick={() => handleOpenDetails(app)}>
                      <td style={{ padding: '16px', fontWeight: 600 }}>{app.company}</td>
                      <td style={{ padding: '16px' }}>{app.position}</td>
                      <td style={{ padding: '16px' }}>{app.location || 'Not Specified'} {app.remote && '(Remote)'}</td>
                      <td style={{ padding: '16px' }}>
                        {app.salary_min !== undefined || app.salary_max !== undefined ? (
                          `$${(app.salary_min || 0).toLocaleString()} - $${(app.salary_max || 0).toLocaleString()}`
                        ) : (
                          '-'
                        )}
                      </td>
                      <td style={{ padding: '16px' }}>
                        <Chip 
                          label={app.status.toUpperCase()} 
                          color={app.status === 'offered' ? 'success' : app.status === 'rejected' ? 'error' : app.status === 'interviewing' ? 'warning' : 'primary'}
                          size="small"
                        />
                      </td>
                      <td style={{ padding: '16px', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                        <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
                          <IconButton color="primary" onClick={() => handleOpenEdit(app)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton color="error" onClick={() => handleDelete(app.id)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Box>
        </TableContainer>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} fullWidth maxWidth="md">
        <Box component="form" onSubmit={handleSave}>
          <DialogTitle sx={{ fontWeight: 800 }}>
            {editingApp ? 'Edit Job Position' : 'Track New Job Application'}
          </DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Company Name"
                  name="company"
                  value={formState.company}
                  onChange={handleFormChange}
                  fullWidth
                  required
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Job Position"
                  name="position"
                  value={formState.position}
                  onChange={handleFormChange}
                  fullWidth
                  required
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth>
                  <InputLabel id="form-status-label">Status</InputLabel>
                  <Select
                    labelId="form-status-label"
                    label="Status"
                    value={formState.status}
                    onChange={(e) => handleSelectChange('status', e.target.value)}
                  >
                    {STATUSES.map(s => (
                      <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Applied Date"
                  name="applied_date"
                  type="date"
                  value={formState.applied_date}
                  onChange={handleFormChange}
                  fullWidth
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  label="Job Posting URL"
                  name="job_url"
                  value={formState.job_url}
                  onChange={handleFormChange}
                  fullWidth
                  placeholder="https://company.com/careers/job"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  label="Min Salary ($)"
                  name="salary_min"
                  type="number"
                  value={formState.salary_min}
                  onChange={handleFormChange}
                  fullWidth
                  placeholder="e.g. 100000"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  label="Max Salary ($)"
                  name="salary_max"
                  type="number"
                  value={formState.salary_max}
                  onChange={handleFormChange}
                  fullWidth
                  placeholder="e.g. 130000"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }} sx={{ display: 'flex', alignItems: 'center' }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formState.remote}
                      onChange={handleSwitchChange}
                      name="remote"
                      color="primary"
                    />
                  }
                  label="Remote Job"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Job Location"
                  name="location"
                  value={formState.location}
                  onChange={handleFormChange}
                  fullWidth
                  placeholder="e.g. New York, NY"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Stack direction="row" spacing={1}>
                  <TextField
                    label="Add Skills / Tags"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                    fullWidth
                    placeholder="e.g. Python, React"
                  />
                  <Button onClick={handleAddTag} variant="outlined">Add</Button>
                </Stack>
                <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {formState.tags.map(t => (
                    <Chip key={t} label={t} onDelete={() => handleRemoveTag(t)} size="small" />
                  ))}
                </Box>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Contact Recruiter Name"
                  name="contact_name"
                  value={formState.contact_name}
                  onChange={handleFormChange}
                  fullWidth
                  placeholder="e.g. Sarah Jenkins"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Contact Recruiter Email"
                  name="contact_email"
                  value={formState.contact_email}
                  onChange={handleFormChange}
                  fullWidth
                  placeholder="recruiter@company.com"
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  label="Job Description"
                  name="job_description"
                  value={formState.job_description}
                  onChange={handleFormChange}
                  multiline
                  rows={4}
                  fullWidth
                  placeholder="Paste the full job posting description here..."
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  label="Private Notes"
                  name="notes"
                  value={formState.notes}
                  onChange={handleFormChange}
                  multiline
                  rows={3}
                  fullWidth
                  placeholder="E.g. Referral from Jane, follow up on Friday..."
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button variant="contained" type="submit" sx={{ bgcolor: 'primary.dark' }}>
              {editingApp ? 'Save Changes' : 'Track Position'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={openDetailDialog} onClose={handleCloseDetailDialog} fullWidth maxWidth="md">
        {selectedApp && (
          <>
            <DialogTitle component="div" sx={{ fontWeight: 800, pb: 1 }}>
              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 800 }}>{selectedApp.company}</Typography>
                  <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>{selectedApp.position}</Typography>
                </Box>
                <Chip 
                  label={getStatusLabel(selectedApp.status).toUpperCase()} 
                  color={selectedApp.status === 'offered' ? 'success' : selectedApp.status === 'rejected' ? 'error' : selectedApp.status === 'interviewing' ? 'warning' : 'primary'}
                  sx={{ fontWeight: 700 }}
                />
              </Stack>
            </DialogTitle>
            <DialogContent dividers>
              <Grid container spacing={3}>
                {/* Status changer bar */}
                <Grid size={{ xs: 12 }}>
                  <Paper sx={{ p: 2, bgcolor: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Move Status To:</Typography>
                    <Stack direction="row" spacing={1} useFlexGap sx={{ gap: 1, flexWrap: 'wrap' }}>
                      {STATUSES.map((s) => (
                        <Button 
                          key={s.value} 
                          variant={selectedApp.status === s.value ? 'contained' : 'outlined'}
                          size="small"
                          color={s.value === 'offered' ? 'success' : s.value === 'rejected' ? 'error' : 'primary'}
                          onClick={() => handleMoveStatus(selectedApp, s.value)}
                        >
                          {s.label}
                        </Button>
                      ))}
                    </Stack>
                  </Paper>
                </Grid>

                {/* Job metadata details */}
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>Job URL</Typography>
                  {selectedApp.job_url ? (
                    <a href={selectedApp.job_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#a78bfa', textDecoration: 'none', fontWeight: 600 }}>
                      <LinkIcon fontSize="small" /> Open Career Listing
                    </a>
                  ) : (
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>None provided</Typography>
                  )}
                </Grid>

                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>Salary Range</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {selectedApp.salary_min !== undefined || selectedApp.salary_max !== undefined ? (
                      `$${(selectedApp.salary_min || 0).toLocaleString()} - $${(selectedApp.salary_max || 0).toLocaleString()}`
                    ) : (
                      'Not Specified'
                    )}
                  </Typography>
                </Grid>

                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>Location / Mode</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {selectedApp.location || 'Not Specified'} {selectedApp.remote && '(Remote)'}
                  </Typography>
                </Grid>

                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>Applied Date</Typography>
                  <Typography variant="body2">
                    {selectedApp.applied_date ? selectedApp.applied_date.split('T')[0] : 'Not applied yet'}
                  </Typography>
                </Grid>

                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>Recruiter Contact</Typography>
                  {selectedApp.contact_name ? (
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {selectedApp.contact_name} {selectedApp.contact_email && `(${selectedApp.contact_email})`}
                    </Typography>
                  ) : (
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>None</Typography>
                  )}
                </Grid>

                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>Skills & Tags</Typography>
                  <Box sx={{ mt: 0.5, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selectedApp.tags.length === 0 ? (
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>None</Typography>
                    ) : (
                      selectedApp.tags.map(t => <Chip key={t} label={t} size="small" />)
                    )}
                  </Box>
                </Grid>

                <Grid size={{ xs: 12 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>Linked Documents</Typography>
                  <Stack direction="row" spacing={2}>
                    <Button 
                      variant="outlined" 
                      size="small" 
                      onClick={() => router.push(`/dashboard/resume?app_id=${selectedApp.id}`)}
                      sx={{ textTransform: 'none' }}
                    >
                      Generate Tailored Resume
                    </Button>
                    <Button 
                      variant="outlined" 
                      size="small" 
                      color="secondary"
                      onClick={() => router.push(`/dashboard/gmail?app_id=${selectedApp.id}`)}
                      sx={{ textTransform: 'none' }}
                    >
                      Send Outreach Email
                    </Button>
                  </Stack>
                </Grid>

                {selectedApp.job_description && (
                  <Grid size={{ xs: 12 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Job Description</Typography>
                    <Paper sx={{ p: 2, bgcolor: 'rgba(0,0,0,0.2)', maxHeight: 200, overflowY: 'auto' }}>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-line', color: 'text.secondary', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                        {selectedApp.job_description}
                      </Typography>
                    </Paper>
                  </Grid>
                )}

                {selectedApp.notes && (
                  <Grid size={{ xs: 12 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Private Notes</Typography>
                    <Paper sx={{ p: 2, bgcolor: 'rgba(124, 90, 237, 0.03)', border: '1px solid rgba(124, 90, 237, 0.1)' }}>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>{selectedApp.notes}</Typography>
                    </Paper>
                  </Grid>
                )}
              </Grid>
            </DialogContent>
            <DialogActions sx={{ p: 3, justifyContent: 'space-between' }}>
              <Button color="error" startIcon={<DeleteIcon />} onClick={() => handleDelete(selectedApp.id)}>
                Delete Application
              </Button>
              <Stack direction="row" spacing={1.5}>
                <Button onClick={handleCloseDetailDialog}>Close</Button>
                <Button variant="contained" onClick={() => handleOpenEdit(selectedApp)}>
                  Edit Details
                </Button>
              </Stack>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}
