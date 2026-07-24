'use client';

import * as React from 'react';
import {
  Box, Card, CardContent, Typography, Button, Stack, Alert, CircularProgress,
  Chip, Paper, TextField, Divider,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import SendIcon from '@mui/icons-material/Send';
import CloseIcon from '@mui/icons-material/Close';
import ForumIcon from '@mui/icons-material/Forum';
import { GmailStatus } from '../../../services/gmail';
import { outreachService, InboundReply } from '../../../services/outreach';
import { useApiKeys } from '../../../hooks/useApiKeys';
import NoApiKeyTooltip from '../../../components/NoApiKeyTooltip';
import {
  prismApi,
  useGetEmailSettingsQuery,
  useGetInboundRepliesQuery,
} from '../../../store/prismApi';
import { useAppDispatch } from '../../../store/hooks';

interface Props {
  status: GmailStatus | null;
}

const CATEGORY_COLOR: Record<string, 'success' | 'info' | 'default' | 'warning'> = {
  interview_request: 'success',
  question: 'info',
  rejection: 'warning',
  other: 'default',
};

export default function HrReplies({ status }: Props) {
  const { hasActiveKey } = useApiKeys();
  const dispatch = useAppDispatch();
  const { data: settings } = useGetEmailSettingsQuery();
  const { data: replies = [], isLoading: loading, refetch } = useGetInboundRepliesQuery();
  const enabled = !!settings?.enable_inbound;

  const [polling, setPolling] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);
  const [drafts, setDrafts] = React.useState<Record<string, string>>({});
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const removeReplyFromCache = (id: string) => {
    dispatch(
      prismApi.util.updateQueryData('getInboundReplies', undefined, (draft) => {
        const index = draft.findIndex((x) => x.id === id);
        if (index !== -1) draft.splice(index, 1);
      })
    );
  };

  const handlePoll = async () => {
    setPolling(true);
    setError(null);
    setInfo(null);
    try {
      const res = await outreachService.poll();
      if (!res.enabled) setInfo('Inbound replies are off. Turn them on in Settings → Email Outreach.');
      else if (!res.inbound_ready) setError('Reconnect Gmail (Connect button) to grant read access for replies.');
      else setInfo(res.handled > 0 ? `Found ${res.handled} new repl${res.handled === 1 ? 'y' : 'ies'}.` : 'No new replies.');
      await refetch();
    } catch (e: unknown) {
      setError(errMsg(e, 'Failed to check for replies.'));
    } finally {
      setPolling(false);
    }
  };

  const handleSend = async (r: InboundReply) => {
    setBusyId(r.id);
    setError(null);
    try {
      await outreachService.sendReply(r.id, drafts[r.id] ?? r.draft_reply ?? undefined);
      setInfo('Reply sent.');
      removeReplyFromCache(r.id);
    } catch (e: unknown) {
      setError(errMsg(e, 'Failed to send the reply.'));
    } finally {
      setBusyId(null);
    }
  };

  const handleDismiss = async (id: string) => {
    setBusyId(id);
    try {
      await outreachService.dismissReply(id);
      removeReplyFromCache(id);
    } catch {
      /* ignore */
    } finally {
      setBusyId(null);
    }
  };

  const needsReconnect = enabled && status?.is_connected && status?.inbound_ready === false;

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <ForumIcon color="primary" />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>HR Replies</Typography>
          </Stack>
          <NoApiKeyTooltip blocked={!hasActiveKey}>
            <Button size="small" startIcon={polling ? <CircularProgress size={14} /> : <RefreshIcon />} onClick={handlePoll} disabled={polling || !hasActiveKey}>
              Check now
            </Button>
          </NoApiKeyTooltip>
        </Stack>

        {!enabled && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Turn on <b>Auto-reply to HR</b> in Settings → Email Outreach to have Prism watch for
            replies and draft responses.
          </Alert>
        )}
        {needsReconnect && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Reconnect Gmail to grant read access — reply monitoring needs the wider permission.
          </Alert>
        )}
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
        {info && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setInfo(null)}>{info}</Alert>}

        {loading ? (
          <Box sx={{ textAlign: 'center', py: 3 }}><CircularProgress size={22} /></Box>
        ) : replies.length === 0 ? (
          <Typography variant="body2" color="text.secondary">No replies yet.</Typography>
        ) : (
          <Stack spacing={2}>
            {replies.map(r => (
              <Paper key={r.id} variant="outlined" sx={{ p: 2 }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1, flexWrap: 'wrap', gap: 1 }}>
                  {r.category && (
                    <Chip size="small" label={r.category.replace(/_/g, ' ')} color={CATEGORY_COLOR[r.category] || 'default'} />
                  )}
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{r.from_email || 'Recruiter'}</Typography>
                  <Typography variant="caption" color="text.secondary">{r.subject}</Typography>
                </Stack>

                {r.handled === 'auto_replied' && (
                  <Chip size="small" color="success" variant="outlined" label="Auto-replied" sx={{ mb: 1 }} />
                )}

                {r.draft_reply != null && r.handled !== 'auto_replied' && (
                  <>
                    <Typography variant="caption" color="text.secondary">Drafted reply (editable):</Typography>
                    <TextField
                      value={drafts[r.id] ?? r.draft_reply ?? ''}
                      onChange={e => setDrafts(prev => ({ ...prev, [r.id]: e.target.value }))}
                      multiline minRows={4} fullWidth size="small" sx={{ my: 1 }}
                    />
                    <Divider sx={{ mb: 1 }} />
                    <Stack direction="row" spacing={1}>
                      <Button size="small" variant="contained" startIcon={busyId === r.id ? <CircularProgress size={14} color="inherit" /> : <SendIcon />}
                        onClick={() => handleSend(r)} disabled={busyId === r.id || !status?.is_connected}>
                        Approve &amp; Send
                      </Button>
                      <Button size="small" color="inherit" startIcon={<CloseIcon />} onClick={() => handleDismiss(r.id)} disabled={busyId === r.id}>
                        Dismiss
                      </Button>
                    </Stack>
                  </>
                )}

                {r.draft_reply == null && r.handled !== 'auto_replied' && (
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <Typography variant="body2" color="text.secondary">No reply needed.</Typography>
                    <Button size="small" color="inherit" startIcon={<CloseIcon />} onClick={() => handleDismiss(r.id)} disabled={busyId === r.id}>
                      Dismiss
                    </Button>
                  </Stack>
                )}
              </Paper>
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

function errMsg(e: unknown, fallback: string): string {
  const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
  return detail || fallback;
}
