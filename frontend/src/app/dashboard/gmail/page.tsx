'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { gmailService, GmailStatus, EmailLog } from '../../../services/gmail';
import { applicationsService, JobApplication } from '../../../services/applications';
import { resumeService, GeneratedDocument } from '../../../services/resume';
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
  List,
  ListItem,
  ListItemText,
  Chip,
} from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import SendIcon from '@mui/icons-material/Send';
import EmailIcon from '@mui/icons-material/Email';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import HistoryIcon from '@mui/icons-material/History';
import InfoIcon from '@mui/icons-material/Info';

export default function GmailPage() {
  const searchParams = useSearchParams();
  const appIdParam = searchParams.get('app_id');

  // Integrations states
  const [status, setStatus] = React.useState<GmailStatus | null>(null);
  const [applications, setApplications] = React.useState<JobApplication[]>([]);
  const [logs, setLogs] = React.useState<EmailLog[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  // Form compose states
  const [selectedAppId, setSelectedAppId] = React.useState(appIdParam || '');
  const [recipient, setRecipient] = React.useState('');
  const [subject, setSubject] = React.useState('');
  const [body, setBody] = React.useState('');

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statusData, appsData, logsData] = await Promise.all([
        gmailService.getStatus(),
        applicationsService.listApplications(),
        gmailService.listSentEmails()
      ]);
      setStatus(statusData);
      setApplications(appsData);
      setLogs(logsData.sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()));
      
      // Prefill recipient if app_id is passed
      if (appIdParam) {
        const found = appsData.find(a => a.id === appIdParam);
        if (found) {
          if (found.contact_email) setRecipient(found.contact_email);
          setSubject(`Application for ${found.position} - ${found.company}`);
          
          // Prefill body with tailored cover letter if it exists
          try {
            const historyDocs = await resumeService.listHistory();
            const coverLetterDoc = historyDocs.find(
              d => d.application_id === found.id && d.cover_letter_content
            );
            if (coverLetterDoc && coverLetterDoc.cover_letter_content) {
              setBody(coverLetterDoc.cover_letter_content);
            }
          } catch (docErr) {
            // Ignore cover letter prefill errors
          }
        }
      }
    } catch (err: any) {
      setError('Gmail integration is disabled or offline. Configure client keys in settings or .env file.');
    } finally {
      setLoading(false);
    }
  }, [appIdParam]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleConnect = async () => {
    setError(null);
    try {
      const consentUrl = await gmailService.getConnectUrl();
      // Redirect to Google OAuth screen
      window.location.href = consentUrl;
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to start Gmail connection. Ensure OAuth variables are configured.');
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect your Google account?')) return;
    try {
      await gmailService.disconnect();
      setSuccess('Gmail account disconnected.');
      loadData();
    } catch (err: any) {
      setError('Failed to disconnect Google account.');
    }
  };

  const handleAppChange = async (id: string) => {
    setSelectedAppId(id);
    const found = applications.find(a => a.id === id);
    if (found) {
      if (found.contact_email) setRecipient(found.contact_email);
      else setRecipient('');
      setSubject(`Application for ${found.position} - ${found.company}`);
      
      // Fetch matching cover letter
      try {
        const historyDocs = await resumeService.listHistory();
        const coverLetterDoc = historyDocs.find(
          d => d.application_id === found.id && d.cover_letter_content
        );
        if (coverLetterDoc && coverLetterDoc.cover_letter_content) {
          setBody(coverLetterDoc.cover_letter_content);
        } else {
          setBody('');
        }
      } catch (docErr) {
        setBody('');
      }
    } else {
      setRecipient('');
      setSubject('');
      setBody('');
    }
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipient.trim() || !subject.trim() || !body.trim()) return;
    setSending(true);
    setError(null);
    setSuccess(null);
    try {
      await gmailService.sendEmail({
        to: recipient,
        subject,
        body,
        application_id: selectedAppId || undefined
      });
      setSuccess('Outreach email sent successfully!');
      
      // Clear form
      setSelectedAppId('');
      setRecipient('');
      setSubject('');
      setBody('');
      
      // Reload logs
      const updatedLogs = await gmailService.listSentEmails();
      setLogs(updatedLogs.sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()));
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to send email. Verify your Gmail OAuth connection works.');
    } finally {
      setSending(false);
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
          Gmail Outreach Workspace
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
          Connect your Gmail account to send tailored cover letters and emails directly to recruiters.
        </Typography>
      </Box>

      {error && <Alert severity="warning" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>{success}</Alert>}

      {!status?.is_connected ? (
        /* Not Connected View */
        <Card sx={{ textAlign: 'center', py: 6, mb: 4 }}>
          <CardContent>
            <EmailIcon sx={{ fontSize: 56, color: 'primary.main', opacity: 0.8, mb: 2 }} />
            <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>Connect your Gmail Account</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 500, mx: 'auto', mb: 4 }}>
              Unlock the outreach center. Link your Google account securely to draft and mail personalized cover letters directly to recruiters from the dashboard.
            </Typography>
            <Button 
              variant="contained" 
              startIcon={<GoogleIcon />}
              onClick={handleConnect}
              sx={{ 
                bgcolor: '#db4437', 
                color: '#fff',
                px: 3, 
                py: 1.2,
                '&:hover': { bgcolor: '#c53727' }
              }}
            >
              Sign in with Google
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* Connected Workspace */
        <Grid container spacing={3}>
          {/* Left panel: Compose Form */}
          <Grid size={{ xs: 12, md: 7 }}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>Compose Outreach</Typography>
                    <Typography variant="caption" sx={{ color: 'secondary.main' }}>
                      Connected as: {status.google_email}
                    </Typography>
                  </Box>
                  <Button 
                    variant="outlined" 
                    color="error" 
                    size="small"
                    startIcon={<LinkOffIcon />}
                    onClick={handleDisconnect}
                  >
                    Disconnect
                  </Button>
                </Stack>

                <Box component="form" onSubmit={handleSendEmail}>
                  <Stack spacing={3}>
                    <FormControl fullWidth>
                      <InputLabel id="outreach-app-label">Recruiter for Job</InputLabel>
                      <Select
                        labelId="outreach-app-label"
                        label="Recruiter for Job"
                        value={selectedAppId}
                        onChange={(e) => handleAppChange(e.target.value)}
                      >
                        <MenuItem value="">-- Select Application --</MenuItem>
                        {applications.map(app => (
                          <MenuItem key={app.id} value={app.id}>
                            {app.company} - {app.position}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <TextField
                      label="Recipient Recruiter Email"
                      value={recipient}
                      onChange={(e) => setRecipient(e.target.value)}
                      placeholder="recruiter@company.com"
                      required
                      fullWidth
                    />

                    <TextField
                      label="Subject"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="E.g. Software Engineer Application - John Doe"
                      required
                      fullWidth
                    />

                    <TextField
                      label="Email Body (Plain Text or HTML)"
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder="Draft your recruiter note or paste your tailored cover letter..."
                      multiline
                      rows={12}
                      required
                      fullWidth
                    />

                    <Button 
                      type="submit" 
                      variant="contained" 
                      startIcon={sending ? <CircularProgress size={20} /> : <SendIcon />}
                      disabled={sending || !recipient.trim() || !subject.trim() || !body.trim()}
                      sx={{ py: 1.5 }}
                    >
                      {sending ? 'Sending Outreach Email...' : 'Send Outreach Email'}
                    </Button>
                  </Stack>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Right panel: Sent History logs */}
          <Grid size={{ xs: 12, md: 5 }}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ p: 3, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 2 }}>
                  <HistoryIcon />
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>Sent Outreach History</Typography>
                </Stack>
                <Divider sx={{ mb: 2 }} />

                <Box sx={{ overflowY: 'auto', flexGrow: 1, maxHeight: '60vh' }}>
                  {logs.length === 0 ? (
                    <Stack spacing={1} sx={{ alignItems: 'center', py: 6, color: 'text.secondary' }}>
                      <InfoIcon />
                      <Typography variant="body2">No emails sent yet from Prism.</Typography>
                    </Stack>
                  ) : (
                    <List dense>
                      {logs.map((log) => {
                        const app = applications.find(a => a.id === log.application_id);
                        return (
                          <Paper key={log.id} sx={{ p: 2, mb: 1.5, bgcolor: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)' }}>
                            <Stack direction="row" sx={{ justifyContent: 'space-between', mb: 0.5 }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                To: {log.to}
                              </Typography>
                              <Chip 
                                label={log.status.toUpperCase()} 
                                size="small" 
                                color={log.status === 'sent' ? 'success' : 'error'}
                                sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700 }}
                              />
                            </Stack>
                            <Typography variant="body2" sx={{ fontSize: '0.85rem', fontWeight: 500, color: 'text.primary', mb: 0.5 }}>
                              {log.subject}
                            </Typography>
                            {app && (
                              <Typography variant="caption" sx={{ color: 'primary.main', display: 'block' }}>
                                Linked job: {app.company}
                              </Typography>
                            )}
                            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
                              Sent: {new Date(log.sent_at).toLocaleString()}
                            </Typography>
                            {log.error_message && (
                              <Typography variant="caption" sx={{ color: 'error.main', display: 'block', mt: 0.5 }}>
                                Error: {log.error_message}
                              </Typography>
                            )}
                          </Paper>
                        );
                      })}
                    </List>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}
