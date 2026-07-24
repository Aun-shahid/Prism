'use client';

import * as React from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { gmailService, GmailStatus, EmailLog } from '../../../services/gmail';
import ApplyByEmail from './ApplyByEmail';
import HrReplies from './HrReplies';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import Grid from '@mui/material/Grid';
import InputLabel from '@mui/material/InputLabel';
import List from '@mui/material/List';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import GoogleIcon from '@mui/icons-material/Google';
import SendIcon from '@mui/icons-material/Send';
import EmailIcon from '@mui/icons-material/Email';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import HistoryIcon from '@mui/icons-material/History';
import InfoIcon from '@mui/icons-material/InfoOutlined';
import { useGetApplicationsQuery, useGetResumeHistoryQuery } from '../../../store/prismApi';
import { useAppDispatch } from '../../../store/hooks';
import { showToast } from '../../../store/uiSlice';
import PageHeader from '../../../components/ui/PageHeader';
import { useConfirm } from '../../../components/ui/ConfirmDialog';
import { TableSkeleton } from '../../../components/ui/Skeletons';

export default function GmailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const confirm = useConfirm();
  const appIdParam = searchParams.get('app_id');

  // Shared caches (deduped across pages)
  const { data: applications = [] } = useGetApplicationsQuery();
  const { data: historyDocs = [] } = useGetResumeHistoryQuery();

  // Gmail-specific state
  const [status, setStatus] = React.useState<GmailStatus | null>(null);
  const [logs, setLogs] = React.useState<EmailLog[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState(0);

  // Reflect the OAuth callback's redirect (?gmail=connected|error) as an alert,
  // then strip it from the URL so a refresh doesn't re-show it.
  React.useEffect(() => {
    const gmailResult = searchParams.get('gmail');
    if (!gmailResult) return;
    if (gmailResult === 'connected') {
      setSuccess('Gmail connected successfully.');
    } else if (gmailResult === 'error') {
      setError(searchParams.get('message') || 'Failed to connect Gmail.');
    }
    const rest = new URLSearchParams(searchParams.toString());
    rest.delete('gmail');
    rest.delete('message');
    const qs = rest.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Compose form state
  const [selectedAppId, setSelectedAppId] = React.useState(appIdParam || '');
  const [recipient, setRecipient] = React.useState('');
  const [subject, setSubject] = React.useState('');
  const [body, setBody] = React.useState('');

  const findCoverLetter = React.useCallback(
    (applicationId: string) =>
      historyDocs.find((d) => d.application_id === applicationId && d.cover_letter_content)
        ?.cover_letter_content || '',
    [historyDocs]
  );

  const loadGmailData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statusData, logsData] = await Promise.all([
        gmailService.getStatus(),
        gmailService.listSentEmails(),
      ]);
      setStatus(statusData);
      setLogs(logsData.sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()));
    } catch {
      setError('Gmail integration is disabled or offline. Configure client keys in settings or .env file.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadGmailData();
  }, [loadGmailData]);

  // Prefill from ?app_id= once the caches are available
  const prefilledRef = React.useRef(false);
  React.useEffect(() => {
    if (prefilledRef.current || !appIdParam || applications.length === 0) return;
    const found = applications.find((a) => a.id === appIdParam);
    if (!found) return;
    prefilledRef.current = true;
    if (found.contact_email) setRecipient(found.contact_email);
    setSubject(`Application for ${found.position} - ${found.company}`);
    const coverLetter = findCoverLetter(found.id);
    if (coverLetter) setBody(coverLetter);
  }, [appIdParam, applications, findCoverLetter]);

  const handleConnect = async () => {
    setError(null);
    try {
      const consentUrl = await gmailService.getConnectUrl();
      window.location.href = consentUrl;
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail || 'Failed to start Gmail connection. Ensure OAuth variables are configured.');
    }
  };

  const handleDisconnect = async () => {
    const ok = await confirm({
      title: 'Disconnect Google account?',
      body: 'Prism will no longer be able to send emails on your behalf until you reconnect.',
      confirmLabel: 'Disconnect',
      destructive: true,
    });
    if (!ok) return;
    try {
      await gmailService.disconnect();
      dispatch(showToast({ message: 'Gmail account disconnected', severity: 'success' }));
      loadGmailData();
    } catch {
      dispatch(showToast({ message: 'Failed to disconnect Google account', severity: 'error' }));
    }
  };

  const handleAppChange = (id: string) => {
    setSelectedAppId(id);
    const found = applications.find((a) => a.id === id);
    if (found) {
      setRecipient(found.contact_email || '');
      setSubject(`Application for ${found.position} - ${found.company}`);
      setBody(findCoverLetter(found.id));
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
    try {
      await gmailService.sendEmail({
        to: recipient,
        subject,
        body,
        application_id: selectedAppId || undefined,
      });
      dispatch(showToast({ message: 'Outreach email sent successfully!', severity: 'success' }));
      setSelectedAppId('');
      setRecipient('');
      setSubject('');
      setBody('');
      const updatedLogs = await gmailService.listSentEmails();
      setLogs(updatedLogs.sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()));
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail || 'Failed to send email. Verify your Gmail OAuth connection works.');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <TableSkeleton />;
  }

  return (
    <Box>
      <PageHeader
        title="Gmail Outreach Workspace"
        subtitle="Connect your Gmail account to send tailored cover letters and emails directly to recruiters."
      />

      {error && (
        <Alert severity="warning" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {!status?.is_connected ? (
        <Card sx={{ textAlign: 'center', py: 6, mb: 4 }}>
          <CardContent>
            <EmailIcon sx={{ fontSize: 56, color: 'primary.main', opacity: 0.8, mb: 2 }} />
            <Typography variant="h5" sx={{ mb: 1 }}>
              Connect your Gmail Account
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 500, mx: 'auto', mb: 4 }}>
              Unlock the outreach center. Link your Google account securely to draft and mail
              personalized cover letters directly to recruiters from the dashboard.
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
                '&:hover': { bgcolor: '#c53727' },
              }}
            >
              Sign in with Google
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="caption" sx={{ color: 'success.main', fontWeight: 600 }}>
              Connected as: {status.google_email}
            </Typography>
            <Button variant="outlined" color="error" size="small" startIcon={<LinkOffIcon />} onClick={handleDisconnect}>
              Disconnect
            </Button>
          </Stack>

          <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
            <Tab label="Apply by Email" />
            <Tab label="HR Replies" />
            <Tab label="Compose & History" />
          </Tabs>

          {tab === 0 && <ApplyByEmail status={status} onSent={loadGmailData} />}
          {tab === 1 && <HrReplies status={status} />}

          {tab === 2 && (
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 7 }}>
                <Card>
                  <CardContent sx={{ p: 3 }}>
                    <Typography variant="h6" sx={{ mb: 3 }}>
                      Compose Outreach
                    </Typography>

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
                            {applications.map((app) => (
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

              <Grid size={{ xs: 12, md: 5 }}>
                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <CardContent sx={{ p: 3, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 2 }}>
                      <HistoryIcon />
                      <Typography variant="h6">Sent Outreach History</Typography>
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
                            const app = applications.find((a) => a.id === log.application_id);
                            return (
                              <Paper
                                key={log.id}
                                sx={{
                                  p: 2,
                                  mb: 1.5,
                                  bgcolor: 'rgba(15, 23, 42, 0.01)',
                                  border: '1px solid',
                                  borderColor: 'divider',
                                }}
                              >
                                <Stack direction="row" sx={{ justifyContent: 'space-between', mb: 0.5 }}>
                                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                    To: {log.to}
                                  </Typography>
                                  <Chip
                                    label={log.status.toUpperCase()}
                                    size="small"
                                    color={log.status === 'sent' ? 'success' : 'error'}
                                    variant="outlined"
                                    sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700 }}
                                  />
                                </Stack>
                                <Typography
                                  variant="body2"
                                  sx={{ fontSize: '0.85rem', fontWeight: 500, color: 'text.primary', mb: 0.5 }}
                                >
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
        </>
      )}
    </Box>
  );
}
