'use client';

import * as React from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useApiKeys } from '../../../hooks/useApiKeys';
import { usersService } from '../../../services/users';
import { apiKeysService, APIKey } from '../../../services/apiKeys';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  TextField,
  Button,
  Stack,
  Alert,
  CircularProgress,
  Divider,
  Paper,
  IconButton,
  Switch,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  List,
  Tabs,
  Tab,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import KeyIcon from '@mui/icons-material/Key';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import MarkEmailReadIcon from '@mui/icons-material/MarkEmailRead';
import EmailOutreachSettings from './EmailOutreachSettings';

export default function SettingsPage() {
  const { user, checkAuth } = useAuth();
  const { refresh: refreshApiKeys } = useApiKeys();
  const isAdmin = user?.role === 'super_admin';

  // Tabs — admins only ever see Account (API Keys / Email Outreach are hidden for them below too).
  const [tab, setTab] = React.useState(0);

  // Settings states
  const [keys, setKeys] = React.useState<APIKey[]>([]);
  const [loadingKeys, setLoadingKeys] = React.useState(true);

  // Account forms
  const [name, setName] = React.useState(user?.name || '');
  const [username, setUsername] = React.useState(user?.username || '');
  const [email, setEmail] = React.useState(user?.email || '');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');

  // Dialog state for adding a key
  const [openKeyDialog, setOpenKeyDialog] = React.useState(false);
  const [keyForm, setKeyForm] = React.useState({
    provider: 'openai' as 'openai' | 'gemini' | 'claude',
    api_key: '',
    label: ''
  });

  const [savingAccount, setSavingAccount] = React.useState(false);
  const [savingKey, setSavingKey] = React.useState(false);
  const [keyDialogError, setKeyDialogError] = React.useState<string | null>(null);

  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  const loadAPIKeys = React.useCallback(async () => {
    setLoadingKeys(true);
    try {
      const data = await apiKeysService.listKeys();
      setKeys(data);
    } catch (err: any) {
      // Endpoint might fail if offline
    } finally {
      setLoadingKeys(false);
    }
  }, []);

  React.useEffect(() => {
    loadAPIKeys();
  }, [loadAPIKeys]);

  // Handle Account Info Save
  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError(null);
    setSuccess(null);
    setSavingAccount(true);

    if (password && password !== confirmPassword) {
      setError('Passwords do not match.');
      setSavingAccount(false);
      return;
    }

    try {
      const payload: any = {
        name,
        username,
        email,
      };
      if (password) {
        payload.password = password;
      }

      await usersService.updateUser(user.id, payload);
      setSuccess('Account profile updated successfully.');
      setPassword('');
      setConfirmPassword('');
      // Refresh Auth Context
      await checkAuth();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update account settings.');
    } finally {
      setSavingAccount(false);
    }
  };

  // --- API Key Handlers ---
  const handleToggleKey = async (key: APIKey) => {
    try {
      const nextActive = !key.is_active;
      await apiKeysService.toggleKey(key.id, nextActive);
      setKeys(prev => prev.map(k => {
        if (k.id === key.id) {
          return { ...k, is_active: nextActive };
        }
        if (nextActive) {
          // If we activated a key, deactivate all others
          return { ...k, is_active: false };
        }
        return k;
      }));
      await refreshApiKeys();
    } catch (err: any) {
      alert('Failed to toggle API key status.');
    }
  };

  const handleDeleteKey = async (id: string) => {
    if (!confirm('Are you sure you want to delete this API key?')) return;
    try {
      await apiKeysService.deleteKey(id);
      setKeys(prev => prev.filter(k => k.id !== id));
      await refreshApiKeys();
    } catch (err: any) {
      alert('Failed to delete API key.');
    }
  };

  const handleSaveKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyForm.api_key.trim()) return;
    setSavingKey(true);
    setKeyDialogError(null);
    try {
      const newKey = await apiKeysService.storeKey({
        provider: keyForm.provider,
        api_key: keyForm.api_key.trim(),
        label: keyForm.label.trim() || undefined
      });
      setKeys(prev => {
        // Remove old key for same provider, and deactivate all others (since new key is active)
        const filtered = prev
          .filter(k => k.provider !== keyForm.provider)
          .map(k => ({ ...k, is_active: false }));
        return [...filtered, newKey];
      });
      await refreshApiKeys();
      setOpenKeyDialog(false);
      setKeyForm({ provider: 'openai', api_key: '', label: '' });
      setSuccess('API key verified and configured successfully.');
    } catch (err: any) {
      setKeyDialogError(err.response?.data?.detail || 'Failed to configure API key.');
    } finally {
      setSavingKey(false);
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
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: -0.5 }}>
          Workspace Settings
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
          Manage your personal details, credentials, and encrypted third-party API configurations.
        </Typography>
      </Box>

      {success && <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>{success}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}

      <Tabs
        value={tab}
        onChange={(_e, v) => setTab(v)}
        sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
      >
        {tabs.map((t, i) => (
          <Tab key={i} label={t.label} icon={t.icon} iconPosition="start" sx={{ minHeight: 48, textTransform: 'none', fontWeight: 600 }} />
        ))}
      </Tabs>

      {/* --- Account --- */}
      {tab === 0 && (
        <Grid container>
          <Grid size={{ xs: 12, md: 8, lg: 6 }}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Box component="form" onSubmit={handleSaveAccount}>
                  <Stack spacing={3}>
                    <TextField
                      label="Full Name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      fullWidth
                    />
                    <TextField
                      label="Username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      fullWidth
                    />
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
        </Grid>
      )}

      {/* --- API Keys --- */}
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
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={30} /></Box>
                ) : keys.length === 0 ? (
                  <Paper sx={{ p: 4, textAlign: 'center', color: 'text.secondary', border: '1px dashed rgba(255,255,255,0.08)' }}>
                    No API keys configured yet. AI tools require at least one provider key.
                  </Paper>
                ) : (
                  <List>
                    {keys.map((k) => (
                      <Paper key={k.id} sx={{ p: 2, mb: 2, bgcolor: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)' }}>
                        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                          <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                              {k.provider.toUpperCase()}
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              {k.label || 'Default Key'}
                            </Typography>
                          </Box>

                          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                            <Switch
                              checked={k.is_active}
                              onChange={() => handleToggleKey(k)}
                              size="small"
                            />
                            <IconButton size="small" color="error" onClick={() => handleDeleteKey(k.id)}>
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

      {/* --- Email Outreach --- */}
      {tab === 2 && !isAdmin && <EmailOutreachSettings />}

      {/* Configure Key Dialog */}
      <Dialog open={openKeyDialog} onClose={() => setOpenKeyDialog(false)} fullWidth maxWidth="xs">
        <Box component="form" onSubmit={handleSaveKey}>
          <DialogTitle sx={{ fontWeight: 800 }}>Add AI Provider Key</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={3} sx={{ mt: 1 }}>
              {keyDialogError && <Alert severity="error" onClose={() => setKeyDialogError(null)}>{keyDialogError}</Alert>}
              <FormControl fullWidth>
                <InputLabel id="provider-select-label">AI Provider</InputLabel>
                <Select
                  labelId="provider-select-label"
                  label="AI Provider"
                  value={keyForm.provider}
                  onChange={(e) => setKeyForm(prev => ({ ...prev, provider: e.target.value as any }))}
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
                onChange={(e) => setKeyForm(prev => ({ ...prev, api_key: e.target.value }))}
                required
                fullWidth
              />

              <TextField
                label="Key Label (Optional)"
                placeholder="e.g. My Personal OpenAI Key"
                value={keyForm.label}
                onChange={(e) => setKeyForm(prev => ({ ...prev, label: e.target.value }))}
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
