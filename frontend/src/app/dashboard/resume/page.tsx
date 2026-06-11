'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { resumeService, GeneratedDocument } from '../../../services/resume';
import { applicationsService, JobApplication } from '../../../services/applications';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Alert,
  CircularProgress,
  Divider,
  Paper,
  Tabs,
  Tab,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  ListItemButton,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import HistoryIcon from '@mui/icons-material/History';
import ArticleIcon from '@mui/icons-material/Article';

export default function ResumePage() {
  const searchParams = useSearchParams();
  const appIdParam = searchParams.get('app_id');

  // Page states
  const [applications, setApplications] = React.useState<JobApplication[]>([]);
  const [history, setHistory] = React.useState<GeneratedDocument[]>([]);
  const [selectedAppId, setSelectedAppId] = React.useState<string>(appIdParam || '');
  const [jobDescription, setJobDescription] = React.useState('');
  const [genType, setGenType] = React.useState<'resume' | 'cover_letter' | 'both'>('both');
  const [provider, setProvider] = React.useState<string>('');
  
  // Generation & history state
  const [loading, setLoading] = React.useState(false);
  const [loadingHistory, setLoadingHistory] = React.useState(true);
  const [currentDoc, setCurrentDoc] = React.useState<GeneratedDocument | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  // Tabs for result display
  const [resultTab, setResultTab] = React.useState(0);

  // Load applications and history
  const loadInitialData = React.useCallback(async () => {
    setLoadingHistory(true);
    try {
      const [apps, docs] = await Promise.all([
        applicationsService.listApplications(),
        resumeService.listHistory()
      ]);
      setApplications(apps);
      setHistory(docs);
      
      // If app_id was passed, prefill the job description from it
      if (appIdParam) {
        const found = apps.find(a => a.id === appIdParam);
        if (found && found.job_description) {
          setJobDescription(found.job_description);
        }
      }
    } catch (err: any) {
      setError('Failed to load initial data. Ensure backend is running.');
    } finally {
      setLoadingHistory(false);
    }
  }, [appIdParam]);

  React.useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Handle application select change
  const handleAppChange = (id: string) => {
    setSelectedAppId(id);
    const found = applications.find(a => a.id === id);
    if (found && found.job_description) {
      setJobDescription(found.job_description);
    } else {
      setJobDescription('');
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobDescription.trim()) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    setCurrentDoc(null);
    try {
      const doc = await resumeService.generate({
        job_description: jobDescription,
        generation_type: genType,
        preferred_provider: provider ? (provider as any) : undefined,
        application_id: selectedAppId || undefined
      });
      setCurrentDoc(doc);
      setSuccess('Documents generated successfully!');
      
      // Pre-select appropriate tab
      if (genType === 'cover_letter') {
        setResultTab(1);
      } else {
        setResultTab(0);
      }
      
      // Reload history
      const docs = await resumeService.listHistory();
      setHistory(docs);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to generate tailored materials. Check if you have saved valid API keys in settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDoc = async (id: string) => {
    if (!confirm('Are you sure you want to delete this document from history?')) return;
    try {
      await resumeService.deleteDocument(id);
      setHistory(prev => prev.filter(d => d.id !== id));
      if (currentDoc?.id === id) {
        setCurrentDoc(null);
      }
    } catch (err: any) {
      alert('Failed to delete document.');
    }
  };

  const handleCopyToClipboard = (text?: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: -0.5 }}>
          AI Resume & Cover Letter Tailoring
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
          Leverage LLMs to rewrite your experience bullets and draft customized cover letters based on target job descriptions.
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>{success}</Alert>}

      <Grid container spacing={3}>
        {/* Left Panel: Request Configuration */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>Generator Settings</Typography>
              
              <Box component="form" onSubmit={handleGenerate}>
                <Stack spacing={3}>
                  <FormControl fullWidth>
                    <InputLabel id="link-app-label">Link to Job Application</InputLabel>
                    <Select
                      labelId="link-app-label"
                      label="Link to Job Application"
                      value={selectedAppId}
                      onChange={(e) => handleAppChange(e.target.value)}
                    >
                      <MenuItem value="">-- Do Not Link --</MenuItem>
                      {applications.map(app => (
                        <MenuItem key={app.id} value={app.id}>
                          {app.company} - {app.position}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl fullWidth>
                    <InputLabel id="gen-type-label">Tailor What?</InputLabel>
                    <Select
                      labelId="gen-type-label"
                      label="Tailor What?"
                      value={genType}
                      onChange={(e) => setGenType(e.target.value as any)}
                    >
                      <MenuItem value="both">Both Resume & Cover Letter</MenuItem>
                      <MenuItem value="resume">Resume Only</MenuItem>
                      <MenuItem value="cover_letter">Cover Letter Only</MenuItem>
                    </Select>
                  </FormControl>

                  <FormControl fullWidth>
                    <InputLabel id="provider-label">AI Model Preference</InputLabel>
                    <Select
                      labelId="provider-label"
                      label="AI Model Preference"
                      value={provider}
                      onChange={(e) => setProvider(e.target.value)}
                    >
                      <MenuItem value="">Use Default Configured Key</MenuItem>
                      <MenuItem value="openai">OpenAI (GPT-4o)</MenuItem>
                      <MenuItem value="gemini">Google Gemini (Gemini 1.5 Pro)</MenuItem>
                      <MenuItem value="claude">Anthropic Claude (Claude 3.5 Sonnet)</MenuItem>
                    </Select>
                  </FormControl>

                  <TextField
                    label="Job Description"
                    placeholder="Paste the target job description details here..."
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    multiline
                    rows={8}
                    required
                    fullWidth
                  />

                  <Button 
                    type="submit" 
                    variant="contained" 
                    startIcon={loading ? <CircularProgress size={20} /> : <AutoAwesomeIcon />}
                    disabled={loading || !jobDescription.trim()}
                    sx={{ 
                      background: 'linear-gradient(135deg, #7c3aed 0%, #10b981 100%)',
                      boxShadow: '0 4px 12px rgba(124,58,237,0.3)',
                      py: 1.5
                    }}
                  >
                    {loading ? 'Tailoring in Progress...' : 'Tailor Materials'}
                  </Button>
                </Stack>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Right Panel: Tailored Results Display */}
        <Grid size={{ xs: 12, md: 7 }}>
          {loading ? (
            <Card sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 450 }}>
              <Stack spacing={2} sx={{ alignItems: 'center', p: 4 }}>
                <CircularProgress color="primary" />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>Synthesizing Profile Data...</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
                  Comparing your background experience with the job description keywords to align skills and achievements. Please wait.
                </Typography>
              </Stack>
            </Card>
          ) : currentDoc ? (
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center', pr: 2 }}>
                <Tabs value={resultTab} onChange={(_, val) => setResultTab(val)}>
                  {currentDoc.generation_type !== 'cover_letter' && <Tab label="Tailored Resume Tips" />}
                  {currentDoc.generation_type !== 'resume' && <Tab label="Cover Letter" />}
                </Tabs>
                <Button 
                  size="small" 
                  startIcon={<ContentCopyIcon />}
                  onClick={() => handleCopyToClipboard(
                    resultTab === 0 ? currentDoc.resume_content : currentDoc.cover_letter_content
                  )}
                >
                  Copy Text
                </Button>
              </Box>
              
              <CardContent sx={{ p: 3, flexGrow: 1, overflowY: 'auto', maxHeight: '65vh' }}>
                {resultTab === 0 && currentDoc.resume_content && (
                  <Paper sx={{ p: 3, bgcolor: '#0b0f19', border: '1px solid rgba(255,255,255,0.04)', fontFamily: 'monospace', fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>
                    {currentDoc.resume_content}
                  </Paper>
                )}
                {resultTab === 1 && currentDoc.cover_letter_content && (
                  <Paper sx={{ p: 3, bgcolor: '#0b0f19', border: '1px solid rgba(255,255,255,0.04)', fontFamily: 'monospace', fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>
                    {currentDoc.cover_letter_content}
                  </Paper>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 450, border: '1px dashed rgba(255,255,255,0.1)' }}>
              <Stack spacing={1} sx={{ alignItems: 'center', color: 'text.secondary', p: 4 }}>
                <ArticleIcon sx={{ fontSize: 48, mb: 1, color: 'primary.main', opacity: 0.7 }} />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>No Document Active</Typography>
                <Typography variant="body2" sx={{ textAlign: 'center' }}>
                  Fill out the parameters on the left and trigger tailoring, or select an item from history below to load it.
                </Typography>
              </Stack>
            </Card>
          )}
        </Grid>
      </Grid>

      {/* History section */}
      <Card sx={{ mt: 4, mb: 4 }}>
        <CardContent sx={{ p: 3 }}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 2 }}>
            <HistoryIcon />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Tailoring History</Typography>
          </Stack>
          <Divider sx={{ mb: 2 }} />

          {loadingHistory ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={30} /></Box>
          ) : history.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 2 }}>
              No history entries found. Your generated items will appear here.
            </Typography>
          ) : (
            <List>
              {history.map((doc) => {
                const app = applications.find(a => a.id === doc.application_id);
                return (
                  <ListItem 
                    key={doc.id} 
                    disablePadding
                    secondaryAction={
                      <IconButton edge="end" color="error" size="small" onClick={() => handleDeleteDoc(doc.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    }
                    sx={{ mb: 1 }}
                  >
                    <ListItemButton 
                      onClick={() => setCurrentDoc(doc)}
                      sx={{ 
                        borderRadius: 1, 
                        bgcolor: currentDoc?.id === doc.id ? 'rgba(167, 139, 250, 0.05)' : 'transparent',
                        border: currentDoc?.id === doc.id ? '1px solid rgba(167, 139, 250, 0.15)' : '1px solid transparent',
                        width: '100%',
                        pr: 8
                      }}
                    >
                      <ListItemText
                        primary={
                          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                              {app ? `${app.company} (${app.position})` : 'Standalone Generation'}
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              via {doc.ai_provider_used.toUpperCase()}
                            </Typography>
                          </Stack>
                        }
                        secondary={
                          <span>
                            Type: {doc.generation_type.toUpperCase()} • Generated on {new Date(doc.created_at).toLocaleDateString()}
                          </span>
                        }
                      />
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
