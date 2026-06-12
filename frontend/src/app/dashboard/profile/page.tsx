'use client';

import * as React from 'react';
import { 
  profileService, 
  UserProfile, 
  WorkExperience, 
  Education, 
  Project, 
  Certification 
} from '../../../services/profile';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  TextField,
  Button,
  Tabs,
  Tab,
  IconButton,
  Stack,
  Alert,
  CircularProgress,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import PersonIcon from '@mui/icons-material/Person';
import WorkIcon from '@mui/icons-material/Work';
import SchoolIcon from '@mui/icons-material/School';
import CodeIcon from '@mui/icons-material/Code';
import CardMembershipIcon from '@mui/icons-material/CardMembership';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { Country, State, City } from 'country-state-city';
import LocationOnIcon from '@mui/icons-material/LocationOn';

export default function ProfilePage() {
  const [activeTab, setActiveTab] = React.useState(0);
  const [profile, setProfile] = React.useState<UserProfile | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  // Dialog states
  const [openDialog, setOpenDialog] = React.useState<'work' | 'edu' | 'proj' | 'cert' | null>(null);
  
  // Tag state for skills
  const [skillInput, setSkillInput] = React.useState('');
  const [jobTitleInput, setJobTitleInput] = React.useState('');

  // CV Upload state & ref
  const [uploading, setUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Preference builder state
  const [prefMode, setPrefMode] = React.useState<'onsite' | 'remote' | 'hybrid'>('onsite');
  const [prefCountry, setPrefCountry] = React.useState('');
  const [prefState, setPrefState] = React.useState('');
  const [prefCity, setPrefCity] = React.useState('');
  const [savingPrefs, setSavingPrefs] = React.useState(false);
  
  // Form states for adding items
  const [workForm, setWorkForm] = React.useState<WorkExperience>({
    company: '',
    title: '',
    location: '',
    start_date: '',
    end_date: '',
    description: '',
    highlights: []
  });
  const [highlightInput, setHighlightInput] = React.useState('');

  const [eduForm, setEduForm] = React.useState<Education>({
    institution: '',
    degree: '',
    field_of_study: '',
    start_date: '',
    end_date: '',
    gpa: '',
    description: ''
  });

  const [projForm, setProjForm] = React.useState<Project>({
    name: '',
    description: '',
    technologies: [],
    url: '',
    start_date: '',
    end_date: ''
  });
  const [techInput, setTechInput] = React.useState('');

  const [certForm, setCertForm] = React.useState<Certification>({
    name: '',
    issuer: '',
    date: '',
    url: ''
  });

  // Base profile fields
  const [basicForm, setBasicForm] = React.useState({
    headline: '',
    summary: '',
    phone: '',
    location: '',
    linkedin_url: '',
    github_url: '',
    portfolio_url: '',
  });

  const fetchProfile = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await profileService.getProfile();
      setProfile(data);
      setBasicForm({
        headline: data.headline || '',
        summary: data.summary || '',
        phone: data.phone || '',
        location: data.location || '',
        linkedin_url: data.linkedin_url || '',
        github_url: data.github_url || '',
        portfolio_url: data.portfolio_url || '',
      });
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load profile details');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSaveBasic = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(null);
    setError(null);
    try {
      const updated = await profileService.updateProfile(basicForm);
      setProfile(updated);
      setSuccess('Profile updated successfully.');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save basic profile details.');
    } finally {
      setSaving(false);
    }
  };

  // --- Skill Handlers ---
  const handleAddSkill = async () => {
    if (!profile || !skillInput.trim()) return;
    const skill = skillInput.trim();
    if (profile.skills.includes(skill)) return;
    try {
      const updatedSkills = [...profile.skills, skill];
      const updated = await profileService.updateSkills(updatedSkills);
      setProfile(updated);
      setSkillInput('');
    } catch (err: any) {
      setError('Failed to add skill.');
    }
  };

  const handleRemoveSkill = async (skillToRemove: string) => {
    if (!profile) return;
    try {
      const updatedSkills = profile.skills.filter(s => s !== skillToRemove);
      const updated = await profileService.updateSkills(updatedSkills);
      setProfile(updated);
    } catch (err: any) {
      setError('Failed to remove skill.');
    }
  };

  // --- Job Title Handlers ---
  const handleAddJobTitle = async () => {
    if (!profile || !jobTitleInput.trim()) return;
    const title = jobTitleInput.trim();
    if (profile.job_titles?.includes(title)) return;
    try {
      const updatedTitles = [...(profile.job_titles || []), title];
      const updated = await profileService.updateJobTitles(updatedTitles);
      setProfile(updated);
      setJobTitleInput('');
    } catch (err: any) {
      setError('Failed to add job title.');
    }
  };

  const handleRemoveJobTitle = async (titleToRemove: string) => {
    if (!profile) return;
    try {
      const updatedTitles = (profile.job_titles || []).filter(t => t !== titleToRemove);
      const updated = await profileService.updateJobTitles(updatedTitles);
      setProfile(updated);
    } catch (err: any) {
      setError('Failed to remove job title.');
    }
  };

  // --- CV Upload Handler ---
  const handleUploadCV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    
    setUploading(true);
    setSuccess(null);
    setError(null);
    
    try {
      const updated = await profileService.uploadCV(file);
      setProfile(updated);
      // Update form values for basic details
      setBasicForm({
        headline: updated.headline || '',
        summary: updated.summary || '',
        phone: updated.phone || '',
        location: updated.location || '',
        linkedin_url: updated.linkedin_url || '',
        github_url: updated.github_url || '',
        portfolio_url: updated.portfolio_url || '',
      });
      setSuccess('Resume uploaded and profile parsed successfully! Verify all details below.');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to upload and parse resume. Verify active API keys in Settings.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // --- Preference Handlers ---
  const handleAddPreference = () => {
    if (!profile || !prefCountry) return;
    
    const countryObj = Country.getCountryByCode(prefCountry);
    const countryName = countryObj ? countryObj.name : '';
    
    let stateName = '';
    if (prefState) {
      const stateObj = State.getStateByCodeAndCountry(prefState, prefCountry);
      stateName = stateObj ? stateObj.name : '';
    }
    
    let cityName = prefCity;
    
    let locString = countryName;
    if (stateName) locString = `${stateName}, ${locString}`;
    if (cityName) locString = `${cityName}, ${locString}`;
    
    const currentList = profile.job_preferences?.[prefMode] || [];
    if (currentList.includes(locString)) return;
    
    const updatedPrefs = {
      ...profile.job_preferences,
      [prefMode]: [...currentList, locString]
    };
    
    setProfile(prev => prev ? { ...prev, job_preferences: updatedPrefs } : null);
    
    setPrefCountry('');
    setPrefState('');
    setPrefCity('');
  };

  const handleRemovePreference = (mode: 'onsite' | 'remote' | 'hybrid', loc: string) => {
    if (!profile) return;
    const currentList = profile.job_preferences?.[mode] || [];
    const updatedPrefs = {
      ...profile.job_preferences,
      [mode]: currentList.filter(l => l !== loc)
    };
    setProfile(prev => prev ? { ...prev, job_preferences: updatedPrefs } : null);
  };

  const handleSavePreferences = async () => {
    if (!profile) return;
    setSavingPrefs(true);
    setSuccess(null);
    setError(null);
    try {
      const updated = await profileService.updateProfile({
        job_preferences: profile.job_preferences
      });
      setProfile(updated);
      setSuccess('Job location preferences updated successfully.');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save job preferences.');
    } finally {
      setSavingPrefs(false);
    }
  };

  // --- Work Experience Handlers ---
  const handleSaveWork = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updated = await profileService.addWorkExperience(workForm);
      setProfile(updated);
      setOpenDialog(null);
      setWorkForm({ company: '', title: '', location: '', start_date: '', end_date: '', description: '', highlights: [] });
      setHighlightInput('');
    } catch (err: any) {
      alert('Failed to add work experience.');
    }
  };

  const handleRemoveWork = async (index: number) => {
    if (!confirm('Are you sure you want to remove this experience?')) return;
    try {
      const updated = await profileService.removeWorkExperience(index);
      setProfile(updated);
    } catch (err: any) {
      alert('Failed to remove work experience.');
    }
  };

  const handleAddWorkHighlight = () => {
    if (highlightInput.trim()) {
      setWorkForm(prev => ({ ...prev, highlights: [...prev.highlights, highlightInput.trim()] }));
      setHighlightInput('');
    }
  };

  // --- Education Handlers ---
  const handleSaveEdu = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updated = await profileService.addEducation(eduForm);
      setProfile(updated);
      setOpenDialog(null);
      setEduForm({ institution: '', degree: '', field_of_study: '', start_date: '', end_date: '', gpa: '', description: '' });
    } catch (err: any) {
      alert('Failed to add education.');
    }
  };

  const handleRemoveEdu = async (index: number) => {
    if (!confirm('Are you sure you want to remove this education entry?')) return;
    try {
      const updated = await profileService.removeEducation(index);
      setProfile(updated);
    } catch (err: any) {
      alert('Failed to remove education entry.');
    }
  };

  // --- Project Handlers ---
  const handleSaveProj = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updated = await profileService.addProject(projForm);
      setProfile(updated);
      setOpenDialog(null);
      setProjForm({ name: '', description: '', technologies: [], url: '', start_date: '', end_date: '' });
      setTechInput('');
    } catch (err: any) {
      alert('Failed to add project.');
    }
  };

  const handleRemoveProj = async (index: number) => {
    if (!confirm('Are you sure you want to remove this project?')) return;
    try {
      const updated = await profileService.removeProject(index);
      setProfile(updated);
    } catch (err: any) {
      alert('Failed to remove project.');
    }
  };

  const handleAddProjTech = () => {
    if (techInput.trim()) {
      setProjForm(prev => ({ ...prev, technologies: [...prev.technologies, techInput.trim()] }));
      setTechInput('');
    }
  };

  // --- Certification Handlers ---
  const handleSaveCert = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updated = await profileService.addCertification(certForm);
      setProfile(updated);
      setOpenDialog(null);
      setCertForm({ name: '', issuer: '', date: '', url: '' });
    } catch (err: any) {
      alert('Failed to add certification.');
    }
  };

  const handleRemoveCert = async (index: number) => {
    if (!confirm('Are you sure you want to remove this certification?')) return;
    try {
      const updated = await profileService.removeCertification(index);
      setProfile(updated);
    } catch (err: any) {
      alert('Failed to remove certification.');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: -0.5 }}>
          Professional Profile Workspace
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
          This information will be used by the AI tailoring services to draft custom resumes and cover letters.
        </Typography>
      </Box>

      {/* Upload CV Action Card */}
      <Card sx={{ 
        mb: 4, 
        background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.08) 0%, rgba(16, 185, 129, 0.08) 100%)',
        border: '1px solid rgba(255, 255, 255, 0.08)' 
      }}>
        <CardContent sx={{ p: 3 }}>
          <Stack 
            direction={{ xs: 'column', sm: 'row' }} 
            spacing={2} 
            sx={{ justifyContent: 'space-between', alignItems: 'center' }}
          >
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>Import from Resume / CV</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                Upload your existing resume (PDF, DOCX, or TXT) and let AI extract your profile details automatically.
              </Typography>
            </Box>
            <Box>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleUploadCV}
                style={{ display: 'none' }}
                accept=".pdf,.docx,.txt"
              />
              <Button
                variant="contained"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                startIcon={uploading ? <CircularProgress size={20} color="inherit" /> : <CloudUploadIcon />}
                sx={{ 
                  background: 'linear-gradient(135deg, #7c3aed 0%, #10b981 100%)',
                  color: '#fff',
                  fontWeight: 700,
                  px: 3,
                  py: 1.5,
                  '&:hover': {
                    filter: 'brightness(1.1)',
                  }
                }}
              >
                {uploading ? 'Analyzing Resume...' : 'Upload CV / Resume'}
              </Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {success && <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>{success}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}

      <Paper sx={{ mb: 4 }}>
        <Tabs 
          value={activeTab} 
          onChange={(_, val) => setActiveTab(val)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab icon={<PersonIcon />} label="Basic Details" />
          <Tab icon={<WorkIcon />} label="Work Experience" />
          <Tab icon={<CodeIcon />} label="Projects" />
          <Tab icon={<SchoolIcon />} label="Education" />
          <Tab icon={<CardMembershipIcon />} label="Skills, Titles & Certs" />
          <Tab icon={<LocationOnIcon />} label="Job Preferences" />
        </Tabs>
      </Paper>

      {/* Tab 0: Basic details */}
      {activeTab === 0 && (
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Box component="form" onSubmit={handleSaveBasic}>
              <Grid container spacing={3}>
                <Grid size={{ xs: 12 }}>
                  <TextField
                    label="Professional Headline"
                    placeholder="e.g. Senior Backend Engineer | Python & FastAPI Expert"
                    value={basicForm.headline}
                    onChange={(e) => setBasicForm(prev => ({ ...prev, headline: e.target.value }))}
                    fullWidth
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Phone Number"
                    value={basicForm.phone}
                    onChange={(e) => setBasicForm(prev => ({ ...prev, phone: e.target.value }))}
                    fullWidth
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Location"
                    placeholder="e.g. San Francisco, CA"
                    value={basicForm.location}
                    onChange={(e) => setBasicForm(prev => ({ ...prev, location: e.target.value }))}
                    fullWidth
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    label="LinkedIn URL"
                    placeholder="https://linkedin.com/in/username"
                    value={basicForm.linkedin_url}
                    onChange={(e) => setBasicForm(prev => ({ ...prev, linkedin_url: e.target.value }))}
                    fullWidth
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    label="GitHub URL"
                    placeholder="https://github.com/username"
                    value={basicForm.github_url}
                    onChange={(e) => setBasicForm(prev => ({ ...prev, github_url: e.target.value }))}
                    fullWidth
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    label="Portfolio / Website URL"
                    placeholder="https://mywebsite.com"
                    value={basicForm.portfolio_url}
                    onChange={(e) => setBasicForm(prev => ({ ...prev, portfolio_url: e.target.value }))}
                    fullWidth
                  />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <TextField
                    label="Professional Summary"
                    placeholder="Briefly describe your career achievements, tech stacks, and what you do..."
                    value={basicForm.summary}
                    onChange={(e) => setBasicForm(prev => ({ ...prev, summary: e.target.value }))}
                    multiline
                    rows={6}
                    fullWidth
                  />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <Button 
                    type="submit" 
                    variant="contained" 
                    startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
                    disabled={saving}
                  >
                    Save Changes
                  </Button>
                </Grid>
              </Grid>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Tab 1: Work Experience */}
      {activeTab === 1 && (
        <Box>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Work History</Typography>
            <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setOpenDialog('work')}>
              Add Experience
            </Button>
          </Stack>
          
          <Stack spacing={3}>
            {profile?.work_experience.length === 0 ? (
              <Paper sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
                No experience added yet. Add your work details to tailer resumes.
              </Paper>
            ) : (
              profile?.work_experience.map((w, idx) => (
                <Card key={idx}>
                  <CardContent sx={{ p: 3 }}>
                    <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: 800 }}>{w.title}</Typography>
                        <Typography variant="subtitle2" color="primary.main" sx={{ fontWeight: 600 }}>
                          {w.company} {w.location && `• ${w.location}`}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {w.start_date} - {w.end_date || 'Present'}
                        </Typography>
                      </Box>
                      <IconButton color="error" onClick={() => handleRemoveWork(idx)}>
                        <DeleteIcon />
                      </IconButton>
                    </Stack>
                    
                    {w.description && (
                      <Typography variant="body2" sx={{ mt: 2, whiteSpace: 'pre-line', color: 'text.secondary' }}>
                        {w.description}
                      </Typography>
                    )}
                    
                    {w.highlights.length > 0 && (
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>Highlights / Key Achievements:</Typography>
                        <ul style={{ margin: 0, paddingLeft: 20, color: '#9ca3af', fontSize: '0.875rem' }}>
                          {w.highlights.map((h, hidx) => (
                            <li key={hidx} style={{ marginBottom: 4 }}>{h}</li>
                          ))}
                        </ul>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </Stack>
        </Box>
      )}

      {/* Tab 2: Projects */}
      {activeTab === 2 && (
        <Box>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Key Projects</Typography>
            <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setOpenDialog('proj')}>
              Add Project
            </Button>
          </Stack>
          
          <Grid container spacing={3}>
            {profile?.projects.length === 0 ? (
              <Grid size={{ xs: 12 }}>
                <Paper sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
                  No projects added yet. Click Add Project to showcase your portfolio.
                </Paper>
              </Grid>
            ) : (
              profile?.projects.map((p, idx) => (
                <Grid size={{ xs: 12, md: 6 }} key={idx}>
                  <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <CardContent sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
                      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                        <Box>
                          <Typography variant="h6" sx={{ fontWeight: 800 }}>{p.name}</Typography>
                          {p.url && (
                            <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ color: '#a78bfa', textDecoration: 'none', fontSize: '0.8rem', fontWeight: 600 }}>
                              Visit Project Link
                            </a>
                          )}
                        </Box>
                        <IconButton color="error" size="small" onClick={() => handleRemoveProj(idx)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                      
                      <Typography variant="body2" sx={{ color: 'text.secondary', flexGrow: 1, my: 1.5 }}>
                        {p.description}
                      </Typography>
                      
                      <Box sx={{ mt: 'auto', display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {p.technologies.map((t, tid) => (
                          <Chip key={tid} label={t} size="small" variant="outlined" sx={{ color: 'secondary.main', borderColor: 'secondary.main' }} />
                        ))}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))
            )}
          </Grid>
        </Box>
      )}

      {/* Tab 3: Education */}
      {activeTab === 3 && (
        <Box>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Education</Typography>
            <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setOpenDialog('edu')}>
              Add Education
            </Button>
          </Stack>
          
          <Stack spacing={3}>
            {profile?.education.length === 0 ? (
              <Paper sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
                No education details added yet.
              </Paper>
            ) : (
              profile?.education.map((e, idx) => (
                <Card key={idx}>
                  <CardContent sx={{ p: 3 }}>
                    <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: 800 }}>{e.degree} in {e.field_of_study}</Typography>
                        <Typography variant="subtitle2" color="primary.main" sx={{ fontWeight: 600 }}>
                          {e.institution} {e.gpa && `• GPA: ${e.gpa}`}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {e.start_date} - {e.end_date}
                        </Typography>
                      </Box>
                      <IconButton color="error" onClick={() => handleRemoveEdu(idx)}>
                        <DeleteIcon />
                      </IconButton>
                    </Stack>
                    
                    {e.description && (
                      <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>
                        {e.description}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </Stack>
        </Box>
      )}

      {/* Tab 4: Certifications & Skills */}
      {activeTab === 4 && (
        <Grid container spacing={3}>
          {/* Target Job Titles */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Target Job Titles</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 2 }}>
                  The job scrapers will automatically scan career sites and match positions containing these titles.
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mb: 3 }}>
                  <TextField
                    label="Add Job Title"
                    size="small"
                    value={jobTitleInput}
                    onChange={(e) => setJobTitleInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddJobTitle()}
                    fullWidth
                    placeholder="e.g. Python Developer"
                  />
                  <Button variant="contained" onClick={handleAddJobTitle}>Add</Button>
                </Stack>
                
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {!profile?.job_titles || profile.job_titles.length === 0 ? (
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      No target job titles added. Add positions you are actively searching for.
                    </Typography>
                  ) : (
                    profile.job_titles.map((t) => (
                      <Chip key={t} label={t} onDelete={() => handleRemoveJobTitle(t)} color="secondary" variant="outlined" />
                    ))
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Skills Management */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Core Skills</Typography>
                <Stack direction="row" spacing={1} sx={{ mb: 3 }}>
                  <TextField
                    label="Add Skill"
                    size="small"
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddSkill()}
                    fullWidth
                    placeholder="e.g. Docker, TypeScript"
                  />
                  <Button variant="contained" onClick={handleAddSkill}>Add</Button>
                </Stack>
                
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {profile?.skills.length === 0 ? (
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      No skills added. Add keywords that show up on job descriptions.
                    </Typography>
                  ) : (
                    profile?.skills.map((s) => (
                      <Chip key={s} label={s} onDelete={() => handleRemoveSkill(s)} color="primary" variant="outlined" />
                    ))
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Certifications Management */}
          <Grid size={{ xs: 12 }}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ p: 3 }}>
                <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>Certifications</Typography>
                  <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={() => setOpenDialog('cert')}>
                    Add Cert
                  </Button>
                </Stack>
                
                <List>
                  {profile?.certifications.length === 0 ? (
                    <Typography variant="body2" sx={{ color: 'text.secondary', p: 2, textAlign: 'center' }}>
                      No certifications listed.
                    </Typography>
                  ) : (
                    profile?.certifications.map((c, idx) => (
                      <React.Fragment key={idx}>
                        <ListItem disableGutters>
                          <ListItemText 
                            primary={c.name} 
                            secondary={`${c.issuer} ${c.date ? `• ${c.date}` : ''}`} 
                          />
                          <ListItemSecondaryAction>
                            <IconButton edge="end" color="error" size="small" onClick={() => handleRemoveCert(idx)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </ListItemSecondaryAction>
                        </ListItem>
                        {idx < profile.certifications.length - 1 && <Divider />}
                      </React.Fragment>
                    ))
                  )}
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Tab 5: Job Preferences */}
      {activeTab === 5 && (
        <Box>
          <Grid container spacing={3}>
            {/* Preferences Builder Form */}
            <Grid size={{ xs: 12, md: 5 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Location Preference Builder</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 3 }}>
                    Construct and add target geographic locations for each work mode preference.
                  </Typography>
                  
                  <Stack spacing={3}>
                    {/* Select Work Mode */}
                    <FormControl fullWidth size="small">
                      <InputLabel id="pref-mode-label">Work Mode</InputLabel>
                      <Select
                        labelId="pref-mode-label"
                        label="Work Mode"
                        value={prefMode}
                        onChange={(e) => setPrefMode(e.target.value as any)}
                      >
                        <MenuItem value="onsite">Onsite</MenuItem>
                        <MenuItem value="remote">Remote</MenuItem>
                        <MenuItem value="hybrid">Hybrid</MenuItem>
                      </Select>
                    </FormControl>

                    {/* Select Country */}
                    <FormControl fullWidth size="small">
                      <InputLabel id="pref-country-label">Country</InputLabel>
                      <Select
                        labelId="pref-country-label"
                        label="Country"
                        value={prefCountry}
                        onChange={(e) => {
                          setPrefCountry(e.target.value);
                          setPrefState('');
                          setPrefCity('');
                        }}
                      >
                        <MenuItem value="">-- Select Country --</MenuItem>
                        {Country.getAllCountries().map(c => (
                          <MenuItem key={c.isoCode} value={c.isoCode}>{c.name}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    {/* Select State (Conditional) */}
                    <FormControl fullWidth size="small" disabled={!prefCountry}>
                      <InputLabel id="pref-state-label">State / Region (Optional)</InputLabel>
                      <Select
                        labelId="pref-state-label"
                        label="State / Region (Optional)"
                        value={prefState}
                        onChange={(e) => {
                          setPrefState(e.target.value);
                          setPrefCity('');
                        }}
                      >
                        <MenuItem value="">-- Select State --</MenuItem>
                        {prefCountry && State.getStatesOfCountry(prefCountry).map(s => (
                          <MenuItem key={s.isoCode} value={s.isoCode}>{s.name}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    {/* Select City (Conditional) */}
                    <FormControl fullWidth size="small" disabled={!prefState}>
                      <InputLabel id="pref-city-label">City (Optional)</InputLabel>
                      <Select
                        labelId="pref-city-label"
                        label="City (Optional)"
                        value={prefCity}
                        onChange={(e) => setPrefCity(e.target.value)}
                      >
                        <MenuItem value="">-- Select City --</MenuItem>
                        {prefCountry && prefState && City.getCitiesOfState(prefCountry, prefState).map(c => (
                          <MenuItem key={c.name} value={c.name}>{c.name}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <Button 
                      variant="contained" 
                      onClick={handleAddPreference}
                      disabled={!prefCountry}
                      sx={{ py: 1 }}
                    >
                      Add to {prefMode.toUpperCase()} list
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            {/* Display preferences lists */}
            <Grid size={{ xs: 12, md: 7 }}>
              <Stack spacing={3}>
                {/* Onsite Card */}
                <Card>
                  <CardContent sx={{ p: 3 }}>
                    <Typography variant="subtitle1" color="primary.main" sx={{ fontWeight: 800, mb: 1.5 }}>
                      Onsite Job Locations
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {!profile?.job_preferences?.onsite || profile.job_preferences.onsite.length === 0 ? (
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          No onsite locations configured. (e.g., "Pakistan")
                        </Typography>
                      ) : (
                        profile.job_preferences.onsite.map(loc => (
                          <Chip key={loc} label={loc} onDelete={() => handleRemovePreference('onsite', loc)} color="primary" variant="outlined" />
                        ))
                      )}
                    </Box>
                  </CardContent>
                </Card>

                {/* Remote Card */}
                <Card>
                  <CardContent sx={{ p: 3 }}>
                    <Typography variant="subtitle1" color="secondary.main" sx={{ fontWeight: 800, mb: 1.5 }}>
                      Remote Job Locations
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {!profile?.job_preferences?.remote || profile.job_preferences.remote.length === 0 ? (
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          No remote locations configured. (e.g., "Saudi Arabia")
                        </Typography>
                      ) : (
                        profile.job_preferences.remote.map(loc => (
                          <Chip key={loc} label={loc} onDelete={() => handleRemovePreference('remote', loc)} color="secondary" variant="outlined" />
                        ))
                      )}
                    </Box>
                  </CardContent>
                </Card>

                {/* Hybrid Card */}
                <Card>
                  <CardContent sx={{ p: 3 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1.5, color: '#f59e0b' }}>
                      Hybrid Job Locations
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {!profile?.job_preferences?.hybrid || profile.job_preferences.hybrid.length === 0 ? (
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          No hybrid locations configured. (e.g., "United Kingdom")
                        </Typography>
                      ) : (
                        profile.job_preferences.hybrid.map(loc => (
                          <Chip key={loc} label={loc} onDelete={() => handleRemovePreference('hybrid', loc)} sx={{ color: '#f59e0b', borderColor: '#f59e0b' }} variant="outlined" />
                        ))
                      )}
                    </Box>
                  </CardContent>
                </Card>

                {/* Save Changes button */}
                <Button
                  variant="contained"
                  color="success"
                  onClick={handleSavePreferences}
                  disabled={savingPrefs}
                  startIcon={savingPrefs ? <CircularProgress size={20} /> : <SaveIcon />}
                  sx={{ py: 1.5, alignSelf: 'flex-start' }}
                >
                  Save Location Preferences
                </Button>
              </Stack>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* --- ADD DIALOGS --- */}

      {/* Add Work Experience Dialog */}
      <Dialog open={openDialog === 'work'} onClose={() => setOpenDialog(null)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={handleSaveWork}>
          <DialogTitle sx={{ fontWeight: 800 }}>Add Work Experience</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={3} sx={{ mt: 1 }}>
              <TextField 
                label="Job Title" 
                value={workForm.title} 
                onChange={(e) => setWorkForm(prev => ({ ...prev, title: e.target.value }))} 
                required 
                fullWidth 
              />
              <TextField 
                label="Company" 
                value={workForm.company} 
                onChange={(e) => setWorkForm(prev => ({ ...prev, company: e.target.value }))} 
                required 
                fullWidth 
              />
              <TextField 
                label="Location" 
                value={workForm.location} 
                onChange={(e) => setWorkForm(prev => ({ ...prev, location: e.target.value }))} 
                fullWidth 
              />
              <Stack direction="row" spacing={2}>
                <TextField 
                  label="Start Date" 
                  placeholder="e.g. 2022-01" 
                  value={workForm.start_date} 
                  onChange={(e) => setWorkForm(prev => ({ ...prev, start_date: e.target.value }))} 
                  required 
                  fullWidth 
                />
                <TextField 
                  label="End Date" 
                  placeholder="e.g. 2024-06 or Present" 
                  value={workForm.end_date} 
                  onChange={(e) => setWorkForm(prev => ({ ...prev, end_date: e.target.value }))} 
                  fullWidth 
                />
              </Stack>
              <TextField 
                label="Role Description" 
                value={workForm.description} 
                onChange={(e) => setWorkForm(prev => ({ ...prev, description: e.target.value }))} 
                multiline 
                rows={3} 
                fullWidth 
              />
              
              {/* Highlight bullet points */}
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>Key Accomplishments (Resume Bullets)</Typography>
                <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
                  <TextField 
                    label="Add bullet point" 
                    size="small" 
                    value={highlightInput} 
                    onChange={(e) => setHighlightInput(e.target.value)} 
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddWorkHighlight())}
                    fullWidth 
                  />
                  <Button variant="outlined" onClick={handleAddWorkHighlight}>Add</Button>
                </Stack>
                <List dense>
                  {workForm.highlights.map((h, i) => (
                    <ListItem key={i} disablePadding>
                      <ListItemText primary={`• ${h}`} />
                      <IconButton size="small" color="error" onClick={() => setWorkForm(prev => ({ ...prev, highlights: prev.highlights.filter((_, idx) => idx !== i) }))}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </ListItem>
                  ))}
                </List>
              </Box>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => setOpenDialog(null)}>Cancel</Button>
            <Button variant="contained" type="submit">Add Entry</Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Add Project Dialog */}
      <Dialog open={openDialog === 'proj'} onClose={() => setOpenDialog(null)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={handleSaveProj}>
          <DialogTitle sx={{ fontWeight: 800 }}>Add Project</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={3} sx={{ mt: 1 }}>
              <TextField 
                label="Project Name" 
                value={projForm.name} 
                onChange={(e) => setProjForm(prev => ({ ...prev, name: e.target.value }))} 
                required 
                fullWidth 
              />
              <TextField 
                label="Project URL" 
                value={projForm.url} 
                onChange={(e) => setProjForm(prev => ({ ...prev, url: e.target.value }))} 
                fullWidth 
              />
              <Stack direction="row" spacing={2}>
                <TextField 
                  label="Start Date" 
                  placeholder="e.g. 2023-01" 
                  value={projForm.start_date} 
                  onChange={(e) => setProjForm(prev => ({ ...prev, start_date: e.target.value }))} 
                  fullWidth 
                />
                <TextField 
                  label="End Date" 
                  placeholder="e.g. 2023-05" 
                  value={projForm.end_date} 
                  onChange={(e) => setProjForm(prev => ({ ...prev, end_date: e.target.value }))} 
                  fullWidth 
                />
              </Stack>
              <TextField 
                label="Description" 
                value={projForm.description} 
                onChange={(e) => setProjForm(prev => ({ ...prev, description: e.target.value }))} 
                multiline 
                rows={3} 
                fullWidth 
              />
              
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>Technologies Used</Typography>
                <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
                  <TextField 
                    label="Add tech keyword" 
                    size="small" 
                    value={techInput} 
                    onChange={(e) => setTechInput(e.target.value)} 
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddProjTech())}
                    fullWidth 
                  />
                  <Button variant="outlined" onClick={handleAddProjTech}>Add</Button>
                </Stack>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {projForm.technologies.map((t, i) => (
                    <Chip key={i} label={t} onDelete={() => setProjForm(prev => ({ ...prev, technologies: prev.technologies.filter((_, idx) => idx !== i) }))} size="small" />
                  ))}
                </Box>
              </Box>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => setOpenDialog(null)}>Cancel</Button>
            <Button variant="contained" type="submit">Add Project</Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Add Education Dialog */}
      <Dialog open={openDialog === 'edu'} onClose={() => setOpenDialog(null)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={handleSaveEdu}>
          <DialogTitle sx={{ fontWeight: 800 }}>Add Education</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={3} sx={{ mt: 1 }}>
              <TextField 
                label="Institution" 
                value={eduForm.institution} 
                onChange={(e) => setEduForm(prev => ({ ...prev, institution: e.target.value }))} 
                required 
                fullWidth 
              />
              <TextField 
                label="Degree" 
                placeholder="e.g. Bachelor of Science" 
                value={eduForm.degree} 
                onChange={(e) => setEduForm(prev => ({ ...prev, degree: e.target.value }))} 
                required 
                fullWidth 
              />
              <TextField 
                label="Field of Study" 
                placeholder="e.g. Computer Science" 
                value={eduForm.field_of_study} 
                onChange={(e) => setEduForm(prev => ({ ...prev, field_of_study: e.target.value }))} 
                fullWidth 
              />
              <Stack direction="row" spacing={2}>
                <TextField 
                  label="Start Date" 
                  placeholder="e.g. 2018-09" 
                  value={eduForm.start_date} 
                  onChange={(e) => setEduForm(prev => ({ ...prev, start_date: e.target.value }))} 
                  fullWidth 
                />
                <TextField 
                  label="End Date" 
                  placeholder="e.g. 2022-06" 
                  value={eduForm.end_date} 
                  onChange={(e) => setEduForm(prev => ({ ...prev, end_date: e.target.value }))} 
                  fullWidth 
                />
              </Stack>
              <TextField 
                label="GPA" 
                placeholder="e.g. 3.8 / 4.0" 
                value={eduForm.gpa} 
                onChange={(e) => setEduForm(prev => ({ ...prev, gpa: e.target.value }))} 
                fullWidth 
              />
              <TextField 
                label="Description / Activities" 
                value={eduForm.description} 
                onChange={(e) => setEduForm(prev => ({ ...prev, description: e.target.value }))} 
                multiline 
                rows={3} 
                fullWidth 
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => setOpenDialog(null)}>Cancel</Button>
            <Button variant="contained" type="submit">Add Entry</Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Add Certification Dialog */}
      <Dialog open={openDialog === 'cert'} onClose={() => setOpenDialog(null)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={handleSaveCert}>
          <DialogTitle sx={{ fontWeight: 800 }}>Add Certification</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={3} sx={{ mt: 1 }}>
              <TextField 
                label="Certification Name" 
                value={certForm.name} 
                onChange={(e) => setCertForm(prev => ({ ...prev, name: e.target.value }))} 
                required 
                fullWidth 
              />
              <TextField 
                label="Issuing Organization" 
                value={certForm.issuer} 
                onChange={(e) => setCertForm(prev => ({ ...prev, issuer: e.target.value }))} 
                required 
                fullWidth 
              />
              <TextField 
                label="Date Obtained" 
                placeholder="e.g. 2023-10" 
                value={certForm.date} 
                onChange={(e) => setCertForm(prev => ({ ...prev, date: e.target.value }))} 
                fullWidth 
              />
              <TextField 
                label="Credential URL" 
                value={certForm.url} 
                onChange={(e) => setCertForm(prev => ({ ...prev, url: e.target.value }))} 
                fullWidth 
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => setOpenDialog(null)}>Cancel</Button>
            <Button variant="contained" type="submit">Add Cert</Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
}
