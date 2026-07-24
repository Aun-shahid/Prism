'use client';

import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  IconButton,
  Link as MuiLink,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SendIcon from '@mui/icons-material/Send';
import AddCommentIcon from '@mui/icons-material/AddComment';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import PsychologyIcon from '@mui/icons-material/Psychology';
import ManageSearchIcon from '@mui/icons-material/ManageSearch';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';
import EditNoteIcon from '@mui/icons-material/EditNote';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SyncIcon from '@mui/icons-material/Sync';
import LaunchIcon from '@mui/icons-material/Launch';
import { useAuth } from '../../../hooks/useAuth';
import { useApiKeys } from '../../../hooks/useApiKeys';
import NoApiKeyTooltip from '../../../components/NoApiKeyTooltip';
import { useConfirm } from '../../../components/ui/ConfirmDialog';
import {
  assistantService,
  AgentStep,
  ChatMessage,
  ConversationSummary,
  KnowledgeStatus,
} from '../../../services/assistant';

const SUGGESTIONS = [
  {
    label: 'Draft an outreach email',
    prompt: 'Generate an email for this job description:\n\n[paste the job description here]',
  },
  {
    label: 'Research a company',
    prompt: 'Research [company name] for me — what do they do, and where can I find their careers page?',
  },
  {
    label: 'My strongest projects',
    prompt: 'What are my strongest projects and experiences, and which roles do they position me best for?',
  },
  {
    label: 'Check my fit for a role',
    prompt: 'How well do I fit this role? What should I emphasize and what are my gaps?\n\n[paste the job description here]',
  },
];

const THINKING_PHASES = [
  'Understanding your request…',
  'Searching your career profile…',
  'Researching on the web…',
  'Drafting the response…',
];

function stepIcon(type: string) {
  switch (type) {
    case 'intent':
      return <PsychologyIcon fontSize="small" />;
    case 'retrieval':
      return <ManageSearchIcon fontSize="small" />;
    case 'research':
      return <TravelExploreIcon fontSize="small" />;
    default:
      return <EditNoteIcon fontSize="small" />;
  }
}

function AgentTrace({ steps, sources }: { steps: AgentStep[]; sources: string[] }) {
  const [open, setOpen] = React.useState(false);
  if (!steps?.length) return null;
  return (
    <Box sx={{ mb: 1 }}>
      <Button
        size="small"
        onClick={() => setOpen(!open)}
        startIcon={<AutoAwesomeIcon sx={{ fontSize: 14 }} />}
        endIcon={
          <ExpandMoreIcon
            sx={{ fontSize: 16, transform: open ? 'rotate(180deg)' : 'none', transition: '0.2s' }}
          />
        }
        sx={{ color: 'text.secondary', fontSize: '0.72rem', px: 1, py: 0.25, minWidth: 0 }}
      >
        {steps.length} step{steps.length > 1 ? 's' : ''} · how this was made
      </Button>
      <Collapse in={open}>
        <Stack
          spacing={0.75}
          sx={{
            mt: 1,
            mb: 0.5,
            pl: 1.5,
            borderLeft: '2px solid rgba(13, 148, 136,0.35)',
          }}
        >
          {steps.map((step, i) => (
            <Stack key={i} direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
              <Box sx={{ color: 'var(--prism-palette-primary-main)', mt: '1px', display: 'flex' }}>{stepIcon(step.type)}</Box>
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', lineHeight: 1.4 }}>
                  {step.label}
                </Typography>
                {step.detail && (
                  <Typography
                    variant="caption"
                    sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.4, wordBreak: 'break-word' }}
                  >
                    {step.detail}
                  </Typography>
                )}
              </Box>
            </Stack>
          ))}
          {sources?.length > 0 && (
            <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5, pt: 0.5 }}>
              {sources.slice(0, 5).map((src, i) => {
                let host = src;
                try { host = new URL(src).hostname.replace('www.', ''); } catch { /* keep raw */ }
                return (
                  <Chip
                    key={i}
                    size="small"
                    icon={<LaunchIcon sx={{ fontSize: 12 }} />}
                    label={host}
                    component="a"
                    href={src}
                    target="_blank"
                    clickable
                    sx={{ fontSize: '0.68rem', height: 22 }}
                  />
                );
              })}
            </Stack>
          )}
        </Stack>
      </Collapse>
    </Box>
  );
}

function MarkdownBody({ content }: { content: string }) {
  return (
    <Box
      sx={{
        fontSize: '0.9rem',
        lineHeight: 1.65,
        wordBreak: 'break-word',
        '& p': { m: 0, mb: 1.25 },
        '& p:last-child': { mb: 0 },
        '& ul, & ol': { m: 0, mb: 1.25, pl: 2.5 },
        '& li': { mb: 0.5 },
        '& h1, & h2, & h3, & h4': { mt: 1.5, mb: 0.75, fontWeight: 700, fontSize: '1rem' },
        '& code': {
          bgcolor: 'rgba(15, 23, 42, 0.08)',
          px: 0.6,
          py: 0.1,
          borderRadius: 0.5,
          fontSize: '0.82rem',
        },
        '& pre': {
          bgcolor: 'rgba(0,0,0,0.35)',
          p: 1.5,
          borderRadius: 1,
          overflowX: 'auto',
          '& code': { bgcolor: 'transparent', p: 0 },
        },
        '& blockquote': {
          borderLeft: '3px solid rgba(13, 148, 136,0.5)',
          pl: 1.5,
          ml: 0,
          color: 'text.secondary',
        },
        '& a': { color: 'var(--prism-palette-primary-main)' },
        '& hr': { borderColor: 'rgba(15, 23, 42, 0.1)', my: 1.5 },
      }}
    >
      <ReactMarkdown>{content}</ReactMarkdown>
    </Box>
  );
}

export default function AssistantPage() {
  const { user } = useAuth();
  const { hasActiveKey } = useApiKeys();
  const confirm = useConfirm();
  const [conversations, setConversations] = React.useState<ConversationSummary[]>([]);
  const [conversationId, setConversationId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [thinkingPhase, setThinkingPhase] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [knowledge, setKnowledge] = React.useState<KnowledgeStatus | null>(null);
  const [syncing, setSyncing] = React.useState(false);
  const [loadingConversation, setLoadingConversation] = React.useState(false);

  const bottomRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);

  const loadConversations = React.useCallback(async () => {
    try {
      setConversations(await assistantService.listConversations());
    } catch (err) {
      console.error('Failed to load conversations', err);
    }
  }, []);

  const loadKnowledge = React.useCallback(async () => {
    try {
      setKnowledge(await assistantService.getKnowledgeStatus());
    } catch (err) {
      console.error('Failed to load knowledge status', err);
    }
  }, []);

  React.useEffect(() => {
    if (user) {
      loadConversations();
      loadKnowledge();
    }
  }, [user, loadConversations, loadKnowledge]);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  // Rotate the "thinking" label while waiting for the agent
  React.useEffect(() => {
    if (!sending) return;
    setThinkingPhase(0);
    const timer = setInterval(
      () => setThinkingPhase((p) => Math.min(p + 1, THINKING_PHASES.length - 1)),
      3500,
    );
    return () => clearInterval(timer);
  }, [sending]);

  const openConversation = async (id: string) => {
    setConversationId(id);
    setError(null);
    setLoadingConversation(true);
    try {
      setMessages(await assistantService.getMessages(id));
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setError(e.response?.data?.detail || 'Failed to load conversation');
    } finally {
      setLoadingConversation(false);
    }
  };

  const newConversation = () => {
    setConversationId(null);
    setMessages([]);
    setError(null);
    inputRef.current?.focus();
  };

  const removeConversation = async (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const ok = await confirm({ title: 'Delete this conversation?', confirmLabel: 'Delete', destructive: true });
    if (!ok) return;
    try {
      await assistantService.deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (conversationId === id) newConversation();
    } catch (err) {
      console.error('Failed to delete conversation', err);
    }
  };

  const send = async (text?: string) => {
    const message = (text ?? input).trim();
    if (!message || sending || !hasActiveKey) return;
    setError(null);
    setInput('');
    setSending(true);

    const optimistic: ChatMessage = {
      id: `local-${Date.now()}`,
      role: 'user',
      content: message,
      steps: [],
      sources: [],
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const res = await assistantService.chat(message, conversationId);
      setConversationId(res.conversation_id);
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: res.reply,
          intent: res.intent,
          steps: res.steps || [],
          sources: res.sources || [],
          created_at: res.created_at,
        },
      ]);
      loadConversations();
      loadKnowledge();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setError(e.response?.data?.detail || 'Something went wrong. Please try again.');
      // Roll back the optimistic message into the input so nothing is lost
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setInput(message);
    } finally {
      setSending(false);
    }
  };

  const syncKnowledge = async () => {
    setSyncing(true);
    try {
      await assistantService.reindexKnowledge();
      await loadKnowledge();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setError(e.response?.data?.detail || 'Failed to sync knowledge base');
    } finally {
      setSyncing(false);
    }
  };

  const copyMessage = (content: string) => {
    navigator.clipboard?.writeText(content).catch(() => {});
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  };

  return (
    <Box sx={{ display: 'flex', gap: 2, height: 'calc(100vh - 112px)', minHeight: 480 }}>
      {/* Conversation sidebar */}
      <Paper
        sx={{
          width: 250,
          flexShrink: 0,
          display: { xs: 'none', lg: 'flex' },
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <Box sx={{ p: 1.5 }}>
          <Button
            fullWidth
            variant="outlined"
            startIcon={<AddCommentIcon />}
            onClick={newConversation}
          >
            New chat
          </Button>
        </Box>
        <Divider />
        <List sx={{ flex: 1, overflowY: 'auto', py: 0 }}>
          {conversations.length === 0 && (
            <Typography variant="caption" sx={{ p: 2, display: 'block', color: 'text.secondary' }}>
              Your conversations will appear here.
            </Typography>
          )}
          {conversations.map((conv) => (
            <ListItem
              key={conv.id}
              disablePadding
              secondaryAction={
                <IconButton
                  edge="end"
                  size="small"
                  onClick={(e) => removeConversation(conv.id, e)}
                  sx={{ opacity: 0.4, '&:hover': { opacity: 1, color: 'error.main' } }}
                >
                  <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                </IconButton>
              }
            >
              <ListItemButton
                selected={conv.id === conversationId}
                onClick={() => openConversation(conv.id)}
                sx={{ py: 1 }}
              >
                <ListItemText
                  primary={conv.title}
                  slotProps={{
                    primary: {
                      sx: {
                        fontSize: '0.82rem',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      },
                    },
                  }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
        <Divider />
        {/* Knowledge base status */}
        <Box sx={{ p: 1.5 }}>
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, display: 'block' }}>
                Knowledge base
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {knowledge
                  ? `${knowledge.doc_count} item${knowledge.doc_count === 1 ? '' : 's'} · ${
                      knowledge.embedding_provider ? 'semantic' : 'keyword'
                    } search`
                  : '—'}
              </Typography>
            </Box>
            <Tooltip title="Re-sync from your profile">
              <span>
                <IconButton size="small" onClick={syncKnowledge} disabled={syncing}>
                  {syncing ? <CircularProgress size={16} /> : <SyncIcon sx={{ fontSize: 18 }} />}
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Box>
      </Paper>

      {/* Chat area */}
      <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <Box
          sx={{
            px: 2.5,
            py: 1.5,
            borderBottom: '1px solid rgba(15, 23, 42, 0.08)',
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
          }}
        >
          <Avatar
            sx={{
              width: 34,
              height: 34,
              background: 'var(--prism-palette-primary-main)',
            }}
          >
            <AutoAwesomeIcon sx={{ fontSize: 18 }} />
          </Avatar>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
              AI Assistant
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Knows your profile · researches companies live · drafts emails & letters
            </Typography>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" onClose={() => setError(null)} sx={{ m: 2, mb: 0 }}>
            {error}
            {error.toLowerCase().includes('api key') && (
              <>
                {' '}
                <MuiLink href="/dashboard/settings" underline="always">
                  Add one in Settings →
                </MuiLink>
              </>
            )}
          </Alert>
        )}

        {/* Messages */}
        <Box sx={{ flex: 1, overflowY: 'auto', px: { xs: 2, md: 4 }, py: 2.5 }}>
          {loadingConversation ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : messages.length === 0 && !sending ? (
            /* Empty state */
            <Box
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                maxWidth: 620,
                mx: 'auto',
              }}
            >
              <Box
                sx={{
                  width: 64,
                  height: 64,
                  borderRadius: 3,
                  background: 'var(--prism-palette-primary-main)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mb: 2.5,
                  boxShadow: '0 8px 32px rgba(13, 148, 136,0.35)',
                }}
              >
                <AutoAwesomeIcon sx={{ fontSize: 32, color: '#fff' }} />
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>
                Hey {user?.name?.split(' ')[0] || 'there'} — what are we working on?
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3.5 }}>
                I know your experience, projects and skills. Paste a job description and I&apos;ll
                detect what you need — or try one of these:
              </Typography>
              <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
                {SUGGESTIONS.map((s) => (
                  <Chip
                    key={s.label}
                    label={s.label}
                    onClick={() => {
                      setInput(s.prompt);
                      inputRef.current?.focus();
                    }}
                    sx={{
                      borderRadius: 2,
                      py: 2.25,
                      px: 0.5,
                      fontSize: '0.82rem',
                      border: '1px solid rgba(13, 148, 136,0.3)',
                      bgcolor: 'rgba(13, 148, 136,0.08)',
                      '&:hover': { bgcolor: 'rgba(13, 148, 136,0.18)' },
                    }}
                  />
                ))}
              </Stack>
            </Box>
          ) : (
            <Stack spacing={2.5} sx={{ maxWidth: 760, mx: 'auto' }}>
              {messages.map((msg) => (
                <Box
                  key={msg.id}
                  sx={{
                    display: 'flex',
                    justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  }}
                >
                  {msg.role === 'user' ? (
                    <Paper
                      sx={{
                        px: 2,
                        py: 1.25,
                        maxWidth: '80%',
                        bgcolor: 'rgba(13, 148, 136,0.18)',
                        border: '1px solid rgba(13, 148, 136,0.25)',
                        borderRadius: '14px 14px 4px 14px',
                      }}
                    >
                      <Typography sx={{ fontSize: '0.9rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {msg.content}
                      </Typography>
                    </Paper>
                  ) : (
                    <Box sx={{ maxWidth: '92%', width: '100%' }}>
                      <AgentTrace steps={msg.steps} sources={msg.sources} />
                      <Paper
                        sx={{
                          px: 2.5,
                          py: 2,
                          bgcolor: 'rgba(15, 23, 42, 0.025)',
                          border: '1px solid rgba(15, 23, 42, 0.08)',
                          borderRadius: '4px 14px 14px 14px',
                          position: 'relative',
                          '&:hover .copy-btn': { opacity: 1 },
                        }}
                      >
                        <MarkdownBody content={msg.content} />
                        <Tooltip title="Copy">
                          <IconButton
                            className="copy-btn"
                            size="small"
                            onClick={() => copyMessage(msg.content)}
                            sx={{
                              position: 'absolute',
                              top: 6,
                              right: 6,
                              opacity: 0,
                              transition: '0.15s',
                            }}
                          >
                            <ContentCopyIcon sx={{ fontSize: 15 }} />
                          </IconButton>
                        </Tooltip>
                      </Paper>
                    </Box>
                  )}
                </Box>
              ))}

              {/* Thinking indicator */}
              {sending && (
                <Box sx={{ display: 'flex' }}>
                  <Paper
                    sx={{
                      px: 2.5,
                      py: 1.75,
                      bgcolor: 'rgba(15, 23, 42, 0.025)',
                      border: '1px solid rgba(13, 148, 136,0.25)',
                      borderRadius: '4px 14px 14px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                    }}
                  >
                    <CircularProgress size={16} sx={{ color: 'var(--prism-palette-primary-main)' }} />
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {THINKING_PHASES[thinkingPhase]}
                    </Typography>
                  </Paper>
                </Box>
              )}
              <div ref={bottomRef} />
            </Stack>
          )}
        </Box>

        {/* Composer */}
        <Box sx={{ p: 2, borderTop: '1px solid rgba(15, 23, 42, 0.08)' }}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-end', maxWidth: 760, mx: 'auto' }}>
            <TextField
              fullWidth
              multiline
              maxRows={8}
              placeholder="Ask anything, paste a job description, or name a company…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              inputRef={inputRef}
              disabled={sending}
              slotProps={{ input: { sx: { borderRadius: 3, fontSize: '0.9rem' } } }}
            />
            <NoApiKeyTooltip blocked={!hasActiveKey}>
              <IconButton
                onClick={() => send()}
                disabled={sending || !input.trim() || !hasActiveKey}
                sx={{
                  width: 44,
                  height: 44,
                  background: input.trim()
                    ? 'var(--prism-palette-primary-main)'
                    : 'rgba(15, 23, 42, 0.06)',
                  color: '#fff',
                  '&:hover': { opacity: 0.9 },
                  '&.Mui-disabled': { color: 'rgba(15, 23, 42, 0.3)' },
                }}
              >
                <SendIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </NoApiKeyTooltip>
          </Stack>
          <Typography
            variant="caption"
            sx={{ display: 'block', textAlign: 'center', color: 'text.secondary', mt: 1, fontSize: '0.68rem' }}
          >
            Enter to send · Shift+Enter for a new line · Answers are grounded in your profile — verify before sending
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}
