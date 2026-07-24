'use client';

import * as React from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { usersService } from '../../../services/users';
import type { APIKey } from '../../../services/apiKeys';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import List from '@mui/material/List';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import SaveIcon from '@mui/icons-material/Save';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import KeyIcon from '@mui/icons-material/Key';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import MarkEmailReadIcon from '@mui/icons-material/MarkEmailRead';
import LanguageIcon from '@mui/icons-material/Language';
import EmailOutreachSettings from './EmailOutreachSettings';
import GoogleTranslate from '../../../components/GoogleTranslate';
import {
  useDeleteApiKeyMutation,
  useGetApiKeysQuery,
  useStoreApiKeyMutation,
  useToggleApiKeyMutation,
} from '../../../store/prismApi';
import { useAppDispatch } from '../../../store/hooks';
import { showToast } from '../../../store/uiSlice';
import PageHeader from '../../../components/ui/PageHeader';
import { useConfirm } from '../../../components/ui/ConfirmDialog';

export default function SettingsPage() {
  const { user, checkAuth } = useAuth();
  const dispatch = useAppDispatch();
  const confirm = useConfirm();
  const isAdmin = user?.role === 'super_admin';

  const [tab, setTab] = React.useState(0);

  // API keys — shared RTK cache (also feeds useApiKeys/NoApiKeyTooltip)
  const { data: keys = [], isLoading: loadingKeys } = useGetApiKeysQuery();
  const [storeApiKey, { isLoading: savingKey }] = useStoreApiKeyMutation();
  const [toggleApiKey] = useToggleApiKeyMutation();
  const [deleteApiKey] = useDeleteApiKeyMutation();

  // Account form
  const [name, setName] = React.useState(user?.name || '');
  const [username, setUsername] = React.useState(user?.username || '');
  const [email, setEmail] = React.useState(user?.email || '');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [savingAccount, setSavingAccount] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Add-key dialog
  const [openKeyDialog, setOpenKeyDialog] = React.useState(false);
  const [keyForm, setKeyForm] = React.useState({
    provider: 'openai' as 'openai' | 'gemini' | 'claude',
    api_key: '',
    label: '',
  });
  const [keyDialogError, setKeyDialogError] = React.useState<string | null>(null);

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError(null);
    setSavingAccount(true);

    if (password && password !== confirmPassword) {
      setError('Passwords do not match.');
      setSavingAccount(false);
      return;
    }

    try {
      const payload: Record<string, string> = { name, username, email };
      if (password) payload.password = password;
      await usersService.updateUser(user.id, payload);
      dispatch(showToast({ message: 'Account profile updated', severity: 'success' }));
      setPassword('');
      setConfirmPassword('');
      await checkAuth();
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail || 'Failed to update account settings.');
    } finally {
      setSavingAccount(false);
    }
  };

  const handleToggleKey = async (key: APIKey) => {
    try {
      await toggleApiKey({ keyId: key.id, isActive: !key.is_active }).unwrap();
    } catch {
      dispatch(showToast({ message: 'Failed to toggle API key status', severity: 'error' }));
    }
  };

  const handleDeleteKey = async (key: APIKey) => {
    const ok = await confirm({
      title: 'Delete this API key?',
      body: `The ${key.provider.toUpperCase()} key will be removed. AI features using it will stop working.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteApiKey(key.id).unwrap();
      dispatch(showToast({ message: 'API key deleted', severity: 'success' }));
    } catch {
      dispatch(showToast({ message: 'Failed to delete API key', severity: 'error' }));
    }
  };

  const handleSaveKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyForm.api_key.trim()) return;
    setKeyDialogError(null);
    try {
      await storeApiKey({
        provider: keyForm.provider,
        api_key: keyForm.api_key.trim(),
        label: keyForm.label.trim() || undefined,
      }).unwrap();
      setOpenKeyDialog(false);
      setKeyForm({ provider: 'openai', api_key: '', label: '' });
      dispatch(showToast({ message: 'API key verified and configured', severity: 'success' }));
    } catch (err) {
      const detail = (err as { data?: { detail?: string } })?.data?.detail;
      setKeyDialogError(detail || 'Failed to configure API key.');
    }
  };

  const tabs = isAdmin
    ? [{ label: 'Account', icon: <ManageAccountsIcon fontSize="small" /> }]
    : [
        { label: 'Account', icon: <ManageAccountsIcon fontSize="small" /> },
        { label: 'API Keys', icon: <KeyIcon fontSize="small" /> },
        { label: 'Email Outreach', icon: <MarkEmailReadIcon fontSize="small" /> },
      ];

  return (
    <Box>
      <PageHeader
        title="Workspace Settings"
        subtitle="Manage your personal details, credentials, and encrypted third-party API configurations."
      />

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
        {tabs.map((t, i) => (
          <Tab key={i} label={t.label} icon={t.icon} iconPosition="start" sx={{ minHeight: 48 }} />
        ))}
      </Tabs>

      {/* Account */}
      {tab === 0 && (
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, md: 8, lg: 6 }}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Box component="form" onSubmit={handleSaveAccount}>
                  <Stack spacing={3}>
                    <TextField label="Full Name" value={name} onChange={(e) => setName(e.target.value)} required fullWidth />
                    <TextField label="Username" value={username} onChange={(e) => setUsername(e.target.value)} required fullWidth />
                    <TextField
                      label="Email Address"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      fullWidth
                    />

                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 2, mb: 1 }}>
                      Change Password (leave blank to keep current)
                    </Typography>

                    <TextField
                      label="New Password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      fullWidth
                    />
                    <TextField
                      label="Confirm New Password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      fullWidth
                    />

                    <Button
                      type="submit"
                      variant="contained"
                      startIcon={savingAccount ? <CircularProgress size={20} /> : <SaveIcon />}
                      disabled={savingAccount}
                      sx={{ alignSelf: 'flex-start', mt: 2 }}
                    >
                      Save Profile Settings
                    </Button>
                  </Stack>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 4, lg: 4 }}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
                  <LanguageIcon fontSize="small" sx={{ color: 'primary.main' }} />
                  <Typography variant="h6">Language</Typography>
                </Stack>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                  Translate the app interface. Your choice persists across pages.
                </Typography>
                <GoogleTranslate />
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* API Keys */}
      {tab === 1 && !isAdmin && (
        <Grid container>
          <Grid size={{ xs: 12, md: 8, lg: 6 }}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                  <Typography variant="body2" sx={{ color: 'text.secondary', flex: 1, mr: 2 }}>
                    Keys are stored encrypted on the backend database, and verified with the provider when added.
                  </Typography>
                  <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={() => setOpenKeyDialog(true)}>
                    Configure Key
                  </Button>
                </Stack>

                {loadingKeys ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress size={30} />
                  </Box>
                ) : keys.length === 0 ? (
                  <Paper
                    sx={{
                      p: 4,
                      textAlign: 'center',
                      color: 'text.secondary',
                      border: '1px dashed',
                      borderColor: 'divider',
                    }}
                  >
                    No API keys configured yet. AI tools require at least one provider key.
                  </Paper>
                ) : (
                  <List>
                    {keys.map((k) => (
                      <Paper
                        key={k.id}
                        sx={{
                          p: 2,
                          mb: 2,
                          bgcolor: 'rgba(15, 23, 42, 0.01)',
                          border: '1px solid',
                          borderColor: 'divider',
                        }}
                      >
                        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                          <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                              {k.provider.toUpperCase()}
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              {k.label || 'Default Key'}
                            </Typography>
                          </Box>

                          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                            <Switch checked={k.is_active} onChange={() => handleToggleKey(k)} size="small" />
                            <IconButton size="small" color="error" onClick={() => handleDeleteKey(k)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Stack>
                        </Stack>
                      </Paper>
                    ))}
                  </List>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Email Outreach */}
      {tab === 2 && !isAdmin && <EmailOutreachSettings />}

      {/* Configure key dialog */}
      <Dialog open={openKeyDialog} onClose={() => setOpenKeyDialog(false)} fullWidth maxWidth="xs">
        <Box component="form" onSubmit={handleSaveKey}>
          <DialogTitle>Add AI Provider Key</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={3} sx={{ mt: 1 }}>
              {keyDialogError && (
                <Alert severity="error" onClose={() => setKeyDialogError(null)}>
                  {keyDialogError}
                </Alert>
              )}
              <FormControl fullWidth>
                <InputLabel id="provider-select-label">AI Provider</InputLabel>
                <Select
                  labelId="provider-select-label"
                  label="AI Provider"
                  value={keyForm.provider}
                  onChange={(e) =>
                    setKeyForm((prev) => ({
                      ...prev,
                      provider: e.target.value as 'openai' | 'gemini' | 'claude',
                    }))
                  }
                >
                  <MenuItem value="openai">OpenAI (GPT-4 / ChatGPT)</MenuItem>
                  <MenuItem value="gemini">Google Gemini</MenuItem>
                  <MenuItem value="claude">Anthropic Claude</MenuItem>
                </Select>
              </FormControl>

              <TextField
                label="API Key"
                type="password"
                placeholder="sk-..."
                value={keyForm.api_key}
                onChange={(e) => setKeyForm((prev) => ({ ...prev, api_key: e.target.value }))}
                required
                fullWidth
              />

              <TextField
                label="Key Label (Optional)"
                placeholder="e.g. My Personal OpenAI Key"
                value={keyForm.label}
                onChange={(e) => setKeyForm((prev) => ({ ...prev, label: e.target.value }))}
                fullWidth
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => setOpenKeyDialog(false)}>Cancel</Button>
            <Button variant="contained" type="submit" disabled={savingKey}>
              {savingKey ? <CircularProgress size={20} /> : 'Verify & Save Key'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
}
