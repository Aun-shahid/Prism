'use client';

import * as React from 'react';
import {
  Box, Card, CardContent, Typography, TextField, Button, Stack, Alert,
  CircularProgress, Chip, Switch, FormControlLabel, Select, MenuItem,
  FormControl, InputLabel, Divider, Paper,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SendIcon from '@mui/icons-material/Send';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import { GmailStatus } from '../../../services/gmail';
import { outreachService, ComposeResult } from '../../../services/outreach';
import { elementToPdfBase64 } from '../../../services/resumeExport';
import ResumeTemplate from '../resume/ResumeTemplate';
import { useApiKeys } from '../../../hooks/useApiKeys';
import NoApiKeyTooltip from '../../../components/NoApiKeyTooltip';
import { useGetEmailSettingsQuery, useGetResumeVersionsQuery } from '../../../store/prismApi';
import { useConfirm } from '../../../components/ui/ConfirmDialog';

interface Props {
  status: GmailStatus | null;
  onSent: () => void;
}

const AUTO_SEND_SECONDS = 8;

export default function ApplyByEmail({ status, onSent }: Props) {
  const { hasActiveKey } = useApiKeys();
  const confirm = useConfirm();
  const { data: settings } = useGetEmailSettingsQuery();
  const { data: versions = [] } = useGetResumeVersionsQuery();

  const [jobDescription, setJobDescription] = React.useState('');
  const [company, setCompany] = React.useState('');
  const [position, setPosition] = React.useState('');

  const [composing, setComposing] = React.useState(false);
  const [result, setResult] = React.useState<ComposeResult | null>(null);
  const [recipient, setRecipient] = React.useState('');
  const [subject, setSubject] = React.useState('');
  const [body, setBody] = React.useState('');

  const [attachResume, setAttachResume] = React.useState(false);
  const [versionId, setVersionId] = React.useState('');

  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [countdown, setCountdown] = React.useState<number | null>(null);

  const hiddenRef = React.useRef<HTMLDivElement | null>(null);

  // Initialize the attach toggle + preferred version once both caches land
  const initializedRef = React.useRef(false);
  React.useEffect(() => {
    if (initializedRef.current || !settings) return;
    initializedRef.current = true;
    setAttachResume(settings.attach_resume);
    setVersionId(settings.default_resume_version_id || versions[0]?.id || '');
  }, [settings, versions]);

  const selectedVersion = versions.find(v => v.id === versionId) || null;

  const handleGenerate = async () => {
    if (!jobDescription.trim()) {
      setError('Paste the job description first.');
      return;
    }
    setError(null);
    setSuccess(null);
    setComposing(true);
    setCountdown(null);
    try {
      const res = await outreachService.compose({
        job_description: jobDescription,
        recipient: recipient || undefined,
        company: company || undefined,
      });
      setResult(res);
      setSubject(res.subject);
      setBody(res.body);
      if (res.recipient) setRecipient(res.recipient);
      if (settings?.outbound_auto_send && (res.recipient || recipient)) {
        setCountdown(AUTO_SEND_SECONDS);
      }
    } catch (e: unknown) {
      setError(errMsg(e, 'Failed to generate the email. Check that an AI provider key is set in Settings.'));
    } finally {
      setComposing(false);
    }
  };

  const buildAttachments = React.useCallback(async () => {
    if (!attachResume || !selectedVersion || !hiddenRef.current) return [];
    try {
      const pageSize = selectedVersion.customization.layout.pageSize === 'letter' ? 'letter' : 'a4';
      const b64 = await elementToPdfBase64(hiddenRef.current, pageSize);
      if (!b64) return [];
      const name = [selectedVersion.contact.firstName, selectedVersion.contact.lastName]
        .filter(Boolean).join(' ') || 'Resume';
      return [{ filename: `${name} CV.pdf`, mime_type: 'application/pdf', content_b64: b64 }];
    } catch {
      setError('Could not render the resume PDF — sending without an attachment.');
      return [];
    }
  }, [attachResume, selectedVersion]);

  const doSend = React.useCallback(async (override: boolean) => {
    setSending(true);
    setError(null);
    try {
      const attachments = await buildAttachments();
      const htmlBody = body.replace(/\n/g, '<br>');
      const res = await outreachService.send({
        to: recipient,
        subject,
        body: htmlBody,
        attachments,
        company: company || undefined,
        position: position || undefined,
        job_description: jobDescription || undefined,
        create_application: true,
        override_guardrails: override,
      });
      setSuccess(`Email sent to ${recipient}${res.application_id ? ' · added to your pipeline' : ''}.`);
      setResult(null);
      setJobDescription('');
      setBody('');
      setSubject('');
      onSent();
    } catch (e: unknown) {
      const st = (e as { response?: { status?: number } })?.response?.status;
      if (st === 409) {
        const proceed = await confirm({
          title: 'Send anyway?',
          body: `You've already emailed ${recipient}.`,
          confirmLabel: 'Send anyway',
        });
        if (proceed) {
          await doSend(true);
          return;
        }
        setError('Send cancelled.');
      } else if (st === 429) {
        setError(errMsg(e, 'Daily send limit reached. Raise it in Email settings.'));
      } else {
        setError(errMsg(e, 'Failed to send the email.'));
      }
    } finally {
      setSending(false);
    }
  }, [buildAttachments, body, recipient, subject, company, position, jobDescription, onSent, confirm]);

  // Auto-send countdown.
  React.useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      setCountdown(null);
      doSend(false);
      return;
    }
    const t = setTimeout(() => setCountdown(c => (c === null ? null : c - 1)), 1000);
    return () => clearTimeout(t);
  }, [countdown, doSend]);

  const notConnected = !status?.is_connected;

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
          <AutoAwesomeIcon color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Apply by Email</Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Paste a job posting whose apply method is email. Prism finds the recipient, writes a
          tailored application, and (optionally) attaches your resume.
        </Typography>

        {notConnected && (
          <Alert severity="info" sx={{ mb: 2 }}>Connect your Gmail below to send.</Alert>
        )}
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

        <TextField
          label="Job description"
          placeholder="Paste the full posting here (including the 'email your CV to…' line)…"
          value={jobDescription}
          onChange={e => setJobDescription(e.target.value)}
          multiline minRows={5} fullWidth sx={{ mb: 2 }}
        />
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
          <TextField label="Company (optional)" value={company} onChange={e => setCompany(e.target.value)} fullWidth size="small" />
          <TextField label="Position (optional)" value={position} onChange={e => setPosition(e.target.value)} fullWidth size="small" />
        </Stack>

        <NoApiKeyTooltip blocked={!hasActiveKey}>
          <Button
            variant="contained" startIcon={composing ? <CircularProgress size={16} color="inherit" /> : <AutoAwesomeIcon />}
            onClick={handleGenerate} disabled={composing || !jobDescription.trim() || !hasActiveKey}
          >
            {composing ? 'Generating…' : 'Extract & Generate'}
          </Button>
        </NoApiKeyTooltip>

        {result && (
          <Paper variant="outlined" sx={{ p: 2, mt: 3 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Review the draft</Typography>

            <TextField
              label="To" value={recipient} onChange={e => setRecipient(e.target.value)}
              fullWidth size="small" sx={{ mb: 1 }}
              error={!recipient} helperText={!recipient ? 'No recipient detected — enter one.' : undefined}
            />
            {result.recipients.length > 1 && (
              <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
                {result.recipients.map(r => (
                  <Chip key={r} label={r} size="small" variant={r === recipient ? 'filled' : 'outlined'}
                    color={r === recipient ? 'primary' : 'default'} onClick={() => setRecipient(r)} />
                ))}
              </Stack>
            )}

            <TextField label="Subject" value={subject} onChange={e => setSubject(e.target.value)} fullWidth size="small" sx={{ mb: 2 }} />
            <TextField label="Body" value={body} onChange={e => setBody(e.target.value)} multiline minRows={8} fullWidth sx={{ mb: 1 }} />

            {result.note && (
              <Alert severity="info" icon={false} sx={{ mb: 2 }}>
                <Typography variant="caption" sx={{ whiteSpace: 'pre-wrap' }}>{result.note}</Typography>
              </Alert>
            )}

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'center' }, mb: 2 }}>
              <FormControlLabel
                control={<Switch checked={attachResume} onChange={e => setAttachResume(e.target.checked)} />}
                label={<Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}><AttachFileIcon fontSize="small" /><span>Attach resume</span></Stack>}
              />
              {attachResume && (
                <FormControl size="small" sx={{ minWidth: 220 }}>
                  <InputLabel>Resume version</InputLabel>
                  <Select label="Resume version" value={versionId} onChange={e => setVersionId(e.target.value)}>
                    {versions.length === 0 && <MenuItem value="" disabled>No saved versions</MenuItem>}
                    {versions.map(v => <MenuItem key={v.id} value={v.id}>{v.title}</MenuItem>)}
                  </Select>
                </FormControl>
              )}
            </Stack>

            <Divider sx={{ mb: 2 }} />

            {countdown !== null ? (
              <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                <CircularProgress size={18} />
                <Typography variant="body2">Auto-sending in {countdown}s…</Typography>
                <Button size="small" color="inherit" onClick={() => setCountdown(null)}>Cancel</Button>
              </Stack>
            ) : (
              <Button
                variant="contained" color="primary" startIcon={sending ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
                onClick={() => doSend(false)} disabled={sending || notConnected || !recipient || !subject}
              >
                {sending ? 'Sending…' : 'Send email'}
              </Button>
            )}
          </Paper>
        )}
      </CardContent>

      {/* Off-screen resume render used only to rasterize the attachment PDF. */}
      {attachResume && selectedVersion && (
        <Box sx={{ position: 'fixed', left: -99999, top: 0, pointerEvents: 'none' }} aria-hidden>
          <ResumeTemplate ref={hiddenRef} version={selectedVersion} />
        </Box>
      )}
    </Card>
  );
}

function errMsg(e: unknown, fallback: string): string {
  const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
  return detail || fallback;
}
