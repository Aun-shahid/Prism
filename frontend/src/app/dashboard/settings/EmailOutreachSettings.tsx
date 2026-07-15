'use client';

import * as React from 'react';
import {
  Box, Card, CardContent, Typography, Stack, Divider, TextField, Button,
  Switch, FormControlLabel, FormControl, InputLabel, Select, MenuItem,
  Alert, CircularProgress, Grid,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import MarkEmailReadIcon from '@mui/icons-material/MarkEmailRead';
import { emailSettingsService, EmailSettings } from '../../../services/emailSettings';
import { resumeVersionApi, ResumeVersion } from '../../../services/resumeBuilder';

const DEFAULTS: EmailSettings = {
  custom_instructions: '', tone: 'warm', length: 'short', signature: '', sender_name: '',
  attach_resume: false, default_resume_version_id: null, outbound_auto_send: false,
  daily_send_limit: 25, cc_self: false, warn_already_emailed: true,
  enable_inbound: false, inbound_auto_reply: false,
};

export default function EmailOutreachSettings() {
  const [s, setS] = React.useState<EmailSettings>(DEFAULTS);
  const [versions, setVersions] = React.useState<ResumeVersion[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        const [data, vs] = await Promise.all([
          emailSettingsService.get(),
          resumeVersionApi.getAll().catch(() => [] as ResumeVersion[]),
        ]);
        setS({ ...DEFAULTS, ...data });
        setVersions(vs);
      } catch {
        /* keep defaults */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const set = <K extends keyof EmailSettings>(key: K, value: EmailSettings[K]) =>
    setS(prev => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      const saved = await emailSettingsService.update(s);
      setS({ ...DEFAULTS, ...saved });
      setOk('Email outreach settings saved.');
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card sx={{ mt: 4 }}>
      <CardContent sx={{ p: 3 }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 3 }}>
          <MarkEmailReadIcon color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Email Outreach</Typography>
        </Stack>
        <Divider sx={{ mb: 3 }} />

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
        {ok && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setOk(null)}>{ok}</Alert>}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={28} /></Box>
        ) : (
          <Grid container spacing={3}>
            {/* How the AI writes */}
            <Grid size={{ xs: 12 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>How the AI writes</Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Tone</InputLabel>
                <Select label="Tone" value={s.tone} onChange={e => set('tone', e.target.value)}>
                  <MenuItem value="formal">Formal</MenuItem>
                  <MenuItem value="warm">Warm</MenuItem>
                  <MenuItem value="direct">Direct</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Length</InputLabel>
                <Select label="Length" value={s.length} onChange={e => set('length', e.target.value)}>
                  <MenuItem value="short">Short</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                label="Custom instructions"
                placeholder="e.g. Always mention my open-source work. Keep it under 120 words. Never use the word 'synergy'."
                value={s.custom_instructions}
                onChange={e => set('custom_instructions', e.target.value)}
                multiline minRows={3} fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="Sender name (sign-off)" value={s.sender_name}
                onChange={e => set('sender_name', e.target.value)} fullWidth size="small" />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="Signature" placeholder="Appended to every email" value={s.signature}
                onChange={e => set('signature', e.target.value)} multiline minRows={1} fullWidth size="small" />
            </Grid>

            {/* Sending behaviour */}
            <Grid size={{ xs: 12 }}>
              <Divider sx={{ my: 1 }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Sending</Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControlLabel control={<Switch checked={s.attach_resume} onChange={e => set('attach_resume', e.target.checked)} />}
                label="Attach resume by default" />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth size="small" disabled={!s.attach_resume}>
                <InputLabel>Default resume version</InputLabel>
                <Select label="Default resume version" value={s.default_resume_version_id || ''}
                  onChange={e => set('default_resume_version_id', e.target.value || null)}>
                  <MenuItem value="">— none —</MenuItem>
                  {versions.map(v => <MenuItem key={v.id} value={v.id}>{v.title}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControlLabel
                control={<Switch checked={s.outbound_auto_send} onChange={e => set('outbound_auto_send', e.target.checked)} />}
                label="Auto-send (skip review, with a cancel window)" />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="Daily send limit" type="number" value={s.daily_send_limit}
                onChange={e => set('daily_send_limit', Math.max(1, Number(e.target.value) || 1))}
                fullWidth size="small" slotProps={{ htmlInput: { min: 1, max: 200 } }} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControlLabel control={<Switch checked={s.cc_self} onChange={e => set('cc_self', e.target.checked)} />}
                label="CC myself on every email" />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControlLabel control={<Switch checked={s.warn_already_emailed} onChange={e => set('warn_already_emailed', e.target.checked)} />}
                label="Warn if I've already emailed a company" />
            </Grid>

            {/* Inbound */}
            <Grid size={{ xs: 12 }}>
              <Divider sx={{ my: 1 }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>HR replies (inbound)</Typography>
              <Typography variant="caption" color="text.secondary">
                Watches only the threads you started. Needs read access — reconnect Gmail after enabling.
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControlLabel control={<Switch checked={s.enable_inbound} onChange={e => set('enable_inbound', e.target.checked)} />}
                label="Watch for HR replies & draft responses" />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControlLabel
                control={<Switch checked={s.inbound_auto_reply} disabled={!s.enable_inbound}
                  onChange={e => set('inbound_auto_reply', e.target.checked)} />}
                label="Auto-send replies (else draft for review)" />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Button variant="contained" startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
                onClick={handleSave} disabled={saving} sx={{ mt: 1 }}>
                {saving ? 'Saving…' : 'Save Email Settings'}
              </Button>
            </Grid>
          </Grid>
        )}
      </CardContent>
    </Card>
  );
}
