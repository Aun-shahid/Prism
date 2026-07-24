'use client';

import * as React from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import List from '@mui/material/List';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';
import { Country, City } from 'country-state-city';
import type { GeneralScraperSource } from '../../services/scraper';
import {
  useAddGeneralSourceMutation,
  useDeleteGeneralSourceMutation,
  useGetGeneralSourcesQuery,
  useTriggerGeneralScrapeMutation,
  useUpdateGeneralSourceMutation,
} from '../../store/prismApi';
import { useAppDispatch } from '../../store/hooks';
import { showToast } from '../../store/uiSlice';
import { useConfirm } from '../ui/ConfirmDialog';

interface CountryOption {
  isoCode: string;
  name: string;
}

interface CityOption {
  name: string;
}

interface AdminFeedsProps {
  manageOpen: boolean;
  addOpen: boolean;
  onCloseManage: () => void;
  onCloseAdd: () => void;
  onOpenAdd: () => void;
}

/** Admin-only general feed source dialogs (manage / add / edit). */
export default function AdminFeeds({
  manageOpen,
  addOpen,
  onCloseManage,
  onCloseAdd,
  onOpenAdd,
}: AdminFeedsProps) {
  const dispatch = useAppDispatch();
  const confirm = useConfirm();

  const { data: generalSources = [], isLoading } = useGetGeneralSourcesQuery();
  const [addGeneralSource] = useAddGeneralSourceMutation();
  const [updateGeneralSource] = useUpdateGeneralSourceMutation();
  const [deleteGeneralSource] = useDeleteGeneralSourceMutation();
  const [triggerGeneralScrape, { isLoading: scanningGeneral, originalArgs: scanningGeneralId }] =
    useTriggerGeneralScrapeMutation();

  // Add form
  const [generalForm, setGeneralForm] = React.useState({
    name: '',
    url: '',
    source_type: 'rss',
    locations: [] as string[],
  });
  const [selectedCountry, setSelectedCountry] = React.useState<CountryOption | null>(null);
  const [selectedCity, setSelectedCity] = React.useState<CityOption | null>(null);

  const citiesList = React.useMemo(() => {
    if (!selectedCountry) return [];
    return City.getCitiesOfCountry(selectedCountry.isoCode) || [];
  }, [selectedCountry]);

  // Edit form
  const [editForm, setEditForm] = React.useState<{
    id: string;
    name: string;
    url: string;
    source_type: string;
    locations: string[];
  } | null>(null);
  const [selectedEditCountry, setSelectedEditCountry] = React.useState<CountryOption | null>(null);
  const [selectedEditCity, setSelectedEditCity] = React.useState<CityOption | null>(null);

  const editCitiesList = React.useMemo(() => {
    if (!selectedEditCountry) return [];
    return City.getCitiesOfCountry(selectedEditCountry.isoCode) || [];
  }, [selectedEditCountry]);

  const handleAddLocation = () => {
    if (!selectedCountry) return;
    const locString = selectedCity ? `${selectedCity.name}, ${selectedCountry.name}` : selectedCountry.name;
    if (!generalForm.locations.includes(locString)) {
      setGeneralForm((prev) => ({ ...prev, locations: [...prev.locations, locString] }));
    }
    setSelectedCountry(null);
    setSelectedCity(null);
  };

  const handleSaveGeneralSource = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addGeneralSource(generalForm).unwrap();
      onCloseAdd();
      setGeneralForm({ name: '', url: '', source_type: 'rss', locations: [] });
      setSelectedCountry(null);
      setSelectedCity(null);
      dispatch(showToast({ message: 'General feed source added', severity: 'success' }));
    } catch {
      dispatch(showToast({ message: 'Failed to save general feed source', severity: 'error' }));
    }
  };

  const handleOpenEdit = (source: GeneralScraperSource) => {
    setEditForm({
      id: source.id,
      name: source.name,
      url: source.url,
      source_type: source.source_type,
      locations: source.locations || [],
    });
    setSelectedEditCountry(null);
    setSelectedEditCity(null);
  };

  const handleAddEditLocation = () => {
    if (!selectedEditCountry || !editForm) return;
    const locString = selectedEditCity
      ? `${selectedEditCity.name}, ${selectedEditCountry.name}`
      : selectedEditCountry.name;
    if (!editForm.locations.includes(locString)) {
      setEditForm({ ...editForm, locations: [...editForm.locations, locString] });
    }
    setSelectedEditCountry(null);
    setSelectedEditCity(null);
  };

  const handleUpdateGeneralSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm) return;
    try {
      await updateGeneralSource({
        id: editForm.id,
        payload: { name: editForm.name, url: editForm.url, locations: editForm.locations },
      }).unwrap();
      setEditForm(null);
      dispatch(showToast({ message: 'General feed source updated', severity: 'success' }));
    } catch {
      dispatch(showToast({ message: 'Failed to update general feed source', severity: 'error' }));
    }
  };

  const handleDeleteGeneralSource = async (source: GeneralScraperSource) => {
    const ok = await confirm({
      title: 'Remove this feed source?',
      body: `"${source.name}" will stop being scanned.`,
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteGeneralSource(source.id).unwrap();
      dispatch(showToast({ message: 'General source removed', severity: 'success' }));
    } catch {
      dispatch(showToast({ message: 'Failed to delete general source', severity: 'error' }));
    }
  };

  const handleToggleStatus = async (source: GeneralScraperSource) => {
    try {
      await updateGeneralSource({
        id: source.id,
        payload: { is_active: !source.is_active },
      }).unwrap();
    } catch {
      dispatch(showToast({ message: 'Failed to update source status', severity: 'error' }));
    }
  };

  const handleTriggerScrape = async (id: string) => {
    try {
      const scraped = await triggerGeneralScrape(id).unwrap();
      dispatch(
        showToast({ message: `General scan complete! Found ${scraped.length} matching jobs.`, severity: 'success' })
      );
    } catch {
      dispatch(
        showToast({
          message: 'Scan completed but failed to parse feed. Check source URL access restrictions.',
          severity: 'error',
        })
      );
    }
  };

  return (
    <>
      {/* Manage feeds */}
      <Dialog open={manageOpen} onClose={onCloseManage} fullWidth maxWidth="md">
        <DialogTitle
          component="div"
          sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <Typography variant="h6" component="div">
            General Sources & RSS Feeds ({generalSources.length})
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            size="small"
            onClick={() => {
              onCloseManage();
              onOpenAdd();
            }}
          >
            Add Feed
          </Button>
        </DialogTitle>
        <DialogContent dividers>
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={30} />
            </Box>
          ) : generalSources.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 4 }}>
              No general scraper sources configured.
            </Typography>
          ) : (
            <List sx={{ pt: 1 }}>
              {generalSources.map((s) => (
                <Paper
                  key={s.id}
                  sx={{
                    p: 2,
                    mb: 2,
                    bgcolor: 'rgba(15, 23, 42, 0.01)',
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box sx={{ maxWidth: '70%' }}>
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            bgcolor: s.is_active ? 'success.main' : 'error.main',
                          }}
                        />
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                          {s.name}
                        </Typography>
                      </Stack>
                      <Typography
                        variant="caption"
                        sx={{
                          color: 'text.secondary',
                          display: 'block',
                          textOverflow: 'ellipsis',
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                          mt: 0.5,
                        }}
                      >
                        {s.url}
                      </Typography>

                      <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        <Chip
                          label={s.source_type.toUpperCase().replace('PRESET_', '').replace('_', ' ')}
                          size="small"
                          color={s.source_type === 'rss' ? 'primary' : 'secondary'}
                          variant="outlined"
                          sx={{ height: 18, fontSize: '0.65rem' }}
                        />
                        {s.locations?.map((loc) => (
                          <Chip
                            key={loc}
                            label={loc}
                            size="small"
                            variant="outlined"
                            sx={{ height: 18, fontSize: '0.65rem' }}
                          />
                        ))}
                      </Box>
                    </Box>

                    <Stack spacing={0.5} sx={{ alignItems: 'flex-end' }}>
                      <Switch checked={s.is_active} onChange={() => handleToggleStatus(s)} size="small" />
                      <Stack direction="row" spacing={0.5} sx={{ mt: 1 }}>
                        <Tooltip title="Scan this platform now">
                          <IconButton
                            size="small"
                            color="secondary"
                            onClick={() => handleTriggerScrape(s.id)}
                            disabled={scanningGeneral}
                          >
                            {scanningGeneral && scanningGeneralId === s.id ? (
                              <CircularProgress size={16} />
                            ) : (
                              <RefreshIcon fontSize="small" />
                            )}
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit scraper source">
                          <IconButton size="small" color="primary" onClick={() => handleOpenEdit(s)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {s.source_type === 'rss' && (
                          <IconButton size="small" color="error" onClick={() => handleDeleteGeneralSource(s)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        )}
                      </Stack>
                    </Stack>
                  </Stack>
                </Paper>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={onCloseManage} variant="outlined">
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add general source */}
      <Dialog open={addOpen} onClose={onCloseAdd} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={handleSaveGeneralSource}>
          <DialogTitle>Add General Feed Source</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={3} sx={{ mt: 1 }}>
              <TextField
                label="Feed Name"
                placeholder="e.g. StackOverflow Jobs RSS"
                value={generalForm.name}
                onChange={(e) => setGeneralForm((prev) => ({ ...prev, name: e.target.value }))}
                required
                fullWidth
              />
              <TextField
                label="Feed / API URL"
                placeholder="https://example.com/rss"
                value={generalForm.url}
                onChange={(e) => setGeneralForm((prev) => ({ ...prev, url: e.target.value }))}
                required
                fullWidth
              />

              <FormControl fullWidth>
                <InputLabel id="general-source-type-label">Feed Type</InputLabel>
                <Select
                  labelId="general-source-type-label"
                  label="Feed Type"
                  value={generalForm.source_type}
                  onChange={(e) => setGeneralForm((prev) => ({ ...prev, source_type: e.target.value }))}
                >
                  <MenuItem value="rss">RSS Feed (Standard XML)</MenuItem>
                </Select>
              </FormControl>

              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                  Target Locations (e.g. United Kingdom, Pakistan)
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
                  <Autocomplete
                    options={Country.getAllCountries()}
                    getOptionLabel={(option) => option.name}
                    value={selectedCountry as ReturnType<typeof Country.getAllCountries>[number] | null}
                    onChange={(_, newValue) => {
                      setSelectedCountry(newValue);
                      setSelectedCity(null);
                    }}
                    renderInput={(params) => <TextField {...params} label="Country" size="small" />}
                    sx={{ flex: 1 }}
                  />
                  <Autocomplete
                    options={citiesList}
                    getOptionLabel={(option) => option.name}
                    value={selectedCity as (typeof citiesList)[number] | null}
                    onChange={(_, newValue) => setSelectedCity(newValue)}
                    disabled={!selectedCountry}
                    renderInput={(params) => <TextField {...params} label="City (Optional)" size="small" />}
                    sx={{ flex: 1 }}
                  />
                  <Button variant="outlined" onClick={handleAddLocation} disabled={!selectedCountry}>
                    Add
                  </Button>
                </Stack>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {generalForm.locations.map((loc) => (
                    <Chip
                      key={loc}
                      label={loc}
                      onDelete={() =>
                        setGeneralForm((prev) => ({
                          ...prev,
                          locations: prev.locations.filter((l) => l !== loc),
                        }))
                      }
                      size="small"
                    />
                  ))}
                </Box>
              </Box>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={onCloseAdd}>Cancel</Button>
            <Button variant="contained" type="submit">
              Save Source
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Edit general source */}
      <Dialog open={Boolean(editForm)} onClose={() => setEditForm(null)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={handleUpdateGeneralSource}>
          <DialogTitle>Edit General Feed Source</DialogTitle>
          <DialogContent dividers>
            {editForm && (
              <Stack spacing={3} sx={{ mt: 1 }}>
                <TextField
                  label="Feed Name"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  required
                  disabled={!editForm.source_type.includes('rss')}
                  fullWidth
                />
                <TextField
                  label="Feed / API URL"
                  value={editForm.url}
                  onChange={(e) => setEditForm({ ...editForm, url: e.target.value })}
                  required
                  disabled={!editForm.source_type.includes('rss')}
                  fullWidth
                />

                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                    Target Locations (e.g. United Kingdom, Pakistan)
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
                    <Autocomplete
                      options={Country.getAllCountries()}
                      getOptionLabel={(option) => option.name}
                      value={selectedEditCountry as ReturnType<typeof Country.getAllCountries>[number] | null}
                      onChange={(_, newValue) => {
                        setSelectedEditCountry(newValue);
                        setSelectedEditCity(null);
                      }}
                      renderInput={(params) => <TextField {...params} label="Country" size="small" />}
                      sx={{ flex: 1 }}
                    />
                    <Autocomplete
                      options={editCitiesList}
                      getOptionLabel={(option) => option.name}
                      value={selectedEditCity as (typeof editCitiesList)[number] | null}
                      onChange={(_, newValue) => setSelectedEditCity(newValue)}
                      disabled={!selectedEditCountry}
                      renderInput={(params) => <TextField {...params} label="City (Optional)" size="small" />}
                      sx={{ flex: 1 }}
                    />
                    <Button variant="outlined" onClick={handleAddEditLocation} disabled={!selectedEditCountry}>
                      Add
                    </Button>
                  </Stack>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {editForm.locations.map((loc) => (
                      <Chip
                        key={loc}
                        label={loc}
                        onDelete={() =>
                          setEditForm({ ...editForm, locations: editForm.locations.filter((l) => l !== loc) })
                        }
                        size="small"
                      />
                    ))}
                  </Box>
                </Box>
              </Stack>
            )}
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => setEditForm(null)}>Cancel</Button>
            <Button variant="contained" type="submit">
              Save Changes
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </>
  );
}
