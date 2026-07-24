'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import type { ApplicationStatus, JobApplication } from '../../services/applications';
import {
  useCreateApplicationMutation,
  useUpdateApplicationMutation,
} from '../../store/prismApi';
import { useAppDispatch } from '../../store/hooks';
import { showToast } from '../../store/uiSlice';
import { STATUSES } from './statuses';

interface ApplicationDialogProps {
  open: boolean;
  editingApp: JobApplication | null;
  onClose: () => void;
}

interface FormState {
  company: string;
  position: string;
  job_url: string;
  job_description: string;
  status: ApplicationStatus;
  salary_min: string;
  salary_max: string;
  location: string;
  remote: boolean;
  applied_date: string;
  notes: string;
  contact_name: string;
  contact_email: string;
  tags: string[];
}

const emptyForm = (): FormState => ({
  company: '',
  position: '',
  job_url: '',
  job_description: '',
  status: 'wishlist',
  salary_min: '',
  salary_max: '',
  location: '',
  remote: false,
  applied_date: new Date().toISOString().split('T')[0],
  notes: '',
  contact_name: '',
  contact_email: '',
  tags: [],
});

const formFromApp = (app: JobApplication): FormState => ({
  company: app.company,
  position: app.position,
  job_url: app.job_url || '',
  job_description: app.job_description || '',
  status: app.status,
  salary_min: app.salary_min !== undefined ? app.salary_min.toString() : '',
  salary_max: app.salary_max !== undefined ? app.salary_max.toString() : '',
  location: app.location || '',
  remote: app.remote || false,
  applied_date: app.applied_date ? app.applied_date.split('T')[0] : '',
  notes: app.notes || '',
  contact_name: app.contact_name || '',
  contact_email: app.contact_email || '',
  tags: app.tags || [],
});

export default function ApplicationDialog({ open, editingApp, onClose }: ApplicationDialogProps) {
  const dispatch = useAppDispatch();
  const [createApplication, { isLoading: creating }] = useCreateApplicationMutation();
  const [updateApplication, { isLoading: updating }] = useUpdateApplicationMutation();

  const [formState, setFormState] = React.useState<FormState>(emptyForm);
  const [tagInput, setTagInput] = React.useState('');

  // Reset the form whenever the dialog (re)opens — adjust-state-during-render
  // pattern instead of an effect, so there's no cascading re-render.
  const [prevOpen, setPrevOpen] = React.useState(open);
  const [prevApp, setPrevApp] = React.useState(editingApp);
  if (open !== prevOpen || editingApp !== prevApp) {
    setPrevOpen(open);
    setPrevApp(editingApp);
    if (open) {
      setFormState(editingApp ? formFromApp(editingApp) : emptyForm());
      setTagInput('');
    }
  }

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (tag && !formState.tags.includes(tag)) {
      setFormState((prev) => ({ ...prev, tags: [...prev.tags, tag] }));
      setTagInput('');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...formState,
      salary_min: formState.salary_min ? parseFloat(formState.salary_min) : undefined,
      salary_max: formState.salary_max ? parseFloat(formState.salary_max) : undefined,
      applied_date: formState.applied_date
        ? new Date(formState.applied_date).toISOString()
        : undefined,
    };
    try {
      if (editingApp) {
        await updateApplication({ id: editingApp.id, payload }).unwrap();
        dispatch(showToast({ message: 'Application updated', severity: 'success' }));
      } else {
        await createApplication(payload).unwrap();
        dispatch(showToast({ message: 'Application added to your tracker', severity: 'success' }));
      }
      onClose();
    } catch (err) {
      const detail = (err as { data?: { detail?: string } })?.data?.detail;
      dispatch(showToast({ message: detail || 'Failed to save application', severity: 'error' }));
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <Box component="form" onSubmit={handleSave}>
        <DialogTitle>{editingApp ? 'Edit Job Position' : 'Track New Job Application'}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Company Name"
                name="company"
                value={formState.company}
                onChange={handleFormChange}
                fullWidth
                required
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Job Position"
                name="position"
                value={formState.position}
                onChange={handleFormChange}
                fullWidth
                required
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <InputLabel id="form-status-label">Status</InputLabel>
                <Select
                  labelId="form-status-label"
                  label="Status"
                  value={formState.status}
                  onChange={(e) =>
                    setFormState((prev) => ({ ...prev, status: e.target.value as ApplicationStatus }))
                  }
                >
                  {STATUSES.map((s) => (
                    <MenuItem key={s.value} value={s.value}>
                      {s.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Applied Date"
                name="applied_date"
                type="date"
                value={formState.applied_date}
                onChange={handleFormChange}
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                label="Job Posting URL"
                name="job_url"
                value={formState.job_url}
                onChange={handleFormChange}
                fullWidth
                placeholder="https://company.com/careers/job"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label="Min Salary ($)"
                name="salary_min"
                type="number"
                value={formState.salary_min}
                onChange={handleFormChange}
                fullWidth
                placeholder="e.g. 100000"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label="Max Salary ($)"
                name="salary_max"
                type="number"
                value={formState.salary_max}
                onChange={handleFormChange}
                fullWidth
                placeholder="e.g. 130000"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }} sx={{ display: 'flex', alignItems: 'center' }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formState.remote}
                    onChange={(e) => setFormState((prev) => ({ ...prev, remote: e.target.checked }))}
                    name="remote"
                    color="primary"
                  />
                }
                label="Remote Job"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Job Location"
                name="location"
                value={formState.location}
                onChange={handleFormChange}
                fullWidth
                placeholder="e.g. New York, NY"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Stack direction="row" spacing={1}>
                <TextField
                  label="Add Skills / Tags"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                  fullWidth
                  placeholder="e.g. Python, React"
                />
                <Button onClick={handleAddTag} variant="outlined">
                  Add
                </Button>
              </Stack>
              <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {formState.tags.map((t) => (
                  <Chip
                    key={t}
                    label={t}
                    onDelete={() =>
                      setFormState((prev) => ({ ...prev, tags: prev.tags.filter((x) => x !== t) }))
                    }
                    size="small"
                  />
                ))}
              </Box>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Contact Recruiter Name"
                name="contact_name"
                value={formState.contact_name}
                onChange={handleFormChange}
                fullWidth
                placeholder="e.g. Sarah Jenkins"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Contact Recruiter Email"
                name="contact_email"
                value={formState.contact_email}
                onChange={handleFormChange}
                fullWidth
                placeholder="recruiter@company.com"
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                label="Job Description"
                name="job_description"
                value={formState.job_description}
                onChange={handleFormChange}
                multiline
                rows={4}
                fullWidth
                placeholder="Paste the full job posting description here..."
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                label="Private Notes"
                name="notes"
                value={formState.notes}
                onChange={handleFormChange}
                multiline
                rows={3}
                fullWidth
                placeholder="E.g. Referral from Jane, follow up on Friday..."
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="contained" type="submit" disabled={creating || updating}>
            {editingApp ? 'Save Changes' : 'Track Position'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
