'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import SearchIcon from '@mui/icons-material/Search';
import ViewKanbanIcon from '@mui/icons-material/ViewKanban';
import ViewListIcon from '@mui/icons-material/ViewList';
import LinkIcon from '@mui/icons-material/Link';
import WorkOutlineIcon from '@mui/icons-material/WorkOutlined';
import type { ApplicationStatus, JobApplication } from '../../../services/applications';
import {
  useDeleteApplicationMutation,
  useGetApplicationsQuery,
  useUpdateApplicationMutation,
} from '../../../store/prismApi';
import { useAppDispatch } from '../../../store/hooks';
import { showToast } from '../../../store/uiSlice';
import PageHeader from '../../../components/ui/PageHeader';
import StatusChip from '../../../components/ui/StatusChip';
import DataTable, { type DataTableColumn } from '../../../components/ui/DataTable';
import EmptyState from '../../../components/ui/EmptyState';
import { useConfirm } from '../../../components/ui/ConfirmDialog';
import { CardGridSkeleton } from '../../../components/ui/Skeletons';
import KanbanBoard from '../../../components/applications/KanbanBoard';
import ApplicationDialog from '../../../components/applications/ApplicationDialog';
import { STATUSES } from '../../../components/applications/statuses';

export default function ApplicationsPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const confirm = useConfirm();

  const [viewTab, setViewTab] = React.useState<'board' | 'list'>('board');
  const [search, setSearch] = React.useState('');
  const [openDialog, setOpenDialog] = React.useState(false);
  const [editingApp, setEditingApp] = React.useState<JobApplication | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const { data: applications, isLoading, error } = useGetApplicationsQuery();
  const [updateApplication] = useUpdateApplicationMutation();
  const [deleteApplication] = useDeleteApplicationMutation();

  // Derived from the cache so the detail dialog live-updates on status moves
  const selectedApp = React.useMemo(
    () => applications?.find((a) => a.id === selectedId) ?? null,
    [applications, selectedId]
  );

  const filteredApps = React.useMemo(() => {
    if (!applications) return [];
    const query = search.toLowerCase();
    if (!query) return applications;
    return applications.filter(
      (app) =>
        app.company.toLowerCase().includes(query) ||
        app.position.toLowerCase().includes(query) ||
        (app.location && app.location.toLowerCase().includes(query)) ||
        app.tags.some((tag) => tag.toLowerCase().includes(query))
    );
  }, [applications, search]);

  const handleOpenAdd = () => {
    setEditingApp(null);
    setOpenDialog(true);
  };

  const handleOpenEdit = (app: JobApplication) => {
    setEditingApp(app);
    setOpenDialog(true);
    setSelectedId(null);
  };

  const handleMoveStatus = async (appId: string, newStatus: ApplicationStatus) => {
    try {
      await updateApplication({ id: appId, payload: { status: newStatus } }).unwrap();
    } catch (err) {
      const detail = (err as { data?: { detail?: string } })?.data?.detail;
      dispatch(showToast({ message: detail || 'Failed to update status', severity: 'error' }));
    }
  };

  const handleDelete = async (app: JobApplication) => {
    const ok = await confirm({
      title: 'Delete application?',
      body: `"${app.position}" at ${app.company} will be removed permanently.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteApplication(app.id).unwrap();
      setSelectedId(null);
      dispatch(showToast({ message: 'Application deleted', severity: 'success' }));
    } catch (err) {
      const detail = (err as { data?: { detail?: string } })?.data?.detail;
      dispatch(showToast({ message: detail || 'Failed to delete application', severity: 'error' }));
    }
  };

  const listColumns: DataTableColumn<JobApplication>[] = [
    {
      key: 'company',
      header: 'Company',
      render: (app) => (
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {app.company}
        </Typography>
      ),
    },
    { key: 'position', header: 'Job Position' },
    {
      key: 'location',
      header: 'Location',
      render: (app) => `${app.location || 'Not specified'}${app.remote ? ' (Remote)' : ''}`,
    },
    {
      key: 'salary',
      header: 'Salary Range',
      render: (app) =>
        app.salary_min !== undefined || app.salary_max !== undefined
          ? `$${(app.salary_min || 0).toLocaleString()} - $${(app.salary_max || 0).toLocaleString()}`
          : '-',
    },
    {
      key: 'status',
      header: 'Status',
      render: (app) => <StatusChip status={app.status} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (app) => (
        <Stack
          direction="row"
          spacing={0.5}
          sx={{ justifyContent: 'flex-end' }}
          onClick={(e) => e.stopPropagation()}
        >
          <IconButton color="primary" size="small" onClick={() => handleOpenEdit(app)}>
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton color="error" size="small" onClick={() => handleDelete(app)}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Stack>
      ),
    },
  ];

  return (
    <Box>
      <PageHeader
        title="Applications Tracker"
        subtitle="Track details, tailor resumes, and manage recruiter communication logs."
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenAdd}>
            Add Job Position
          </Button>
        }
      />

      {/* Toolbar */}
      <Paper
        sx={{
          p: 2,
          mb: 3,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 2,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <TextField
          placeholder="Search company, position, skills..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          size="small"
          sx={{ width: { xs: '100%', md: 400 } }}
          slotProps={{
            input: {
              startAdornment: <SearchIcon sx={{ color: 'text.secondary', mr: 1 }} />,
            },
          }}
        />
        <Tabs value={viewTab} onChange={(_, val) => setViewTab(val)}>
          <Tab icon={<ViewKanbanIcon />} iconPosition="start" label="Kanban Board" value="board" />
          <Tab icon={<ViewListIcon />} iconPosition="start" label="List View" value="list" />
        </Tabs>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Failed to fetch applications.
        </Alert>
      )}

      {isLoading ? (
        <CardGridSkeleton count={6} />
      ) : viewTab === 'board' ? (
        <KanbanBoard
          applications={filteredApps}
          onMove={handleMoveStatus}
          onCardClick={(app) => setSelectedId(app.id)}
        />
      ) : (
        <DataTable
          columns={listColumns}
          rows={filteredApps}
          getRowKey={(app) => app.id}
          onRowClick={(app) => setSelectedId(app.id)}
          emptyState={
            <EmptyState
              dense
              icon={<WorkOutlineIcon />}
              title="No applications found"
              description={search ? 'Try a different search.' : 'Add your first job position to get started.'}
            />
          }
        />
      )}

      <ApplicationDialog
        open={openDialog}
        editingApp={editingApp}
        onClose={() => setOpenDialog(false)}
      />

      {/* Details Dialog */}
      <Dialog open={Boolean(selectedApp)} onClose={() => setSelectedId(null)} fullWidth maxWidth="md">
        {selectedApp && (
          <>
            <DialogTitle component="div" sx={{ pb: 1 }}>
              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="h5">{selectedApp.company}</Typography>
                  <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>
                    {selectedApp.position}
                  </Typography>
                </Box>
                <StatusChip status={selectedApp.status} size="medium" />
              </Stack>
            </DialogTitle>
            <DialogContent dividers>
              <Grid container spacing={3}>
                <Grid size={{ xs: 12 }}>
                  <Paper
                    sx={{
                      p: 2,
                      bgcolor: 'rgba(15, 23, 42, 0.02)',
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                      Move Status To:
                    </Typography>
                    <Stack direction="row" spacing={1} useFlexGap sx={{ gap: 1, flexWrap: 'wrap' }}>
                      {STATUSES.map((s) => (
                        <Button
                          key={s.value}
                          variant={selectedApp.status === s.value ? 'contained' : 'outlined'}
                          size="small"
                          color={
                            s.value === 'offered'
                              ? 'success'
                              : s.value === 'rejected'
                                ? 'error'
                                : 'primary'
                          }
                          onClick={() => handleMoveStatus(selectedApp.id, s.value)}
                        >
                          {s.label}
                        </Button>
                      ))}
                    </Stack>
                  </Paper>
                </Grid>

                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                    Job URL
                  </Typography>
                  {selectedApp.job_url ? (
                    <Button
                      component="a"
                      href={selectedApp.job_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      startIcon={<LinkIcon />}
                      size="small"
                      sx={{ px: 0, fontWeight: 600 }}
                    >
                      Open Career Listing
                    </Button>
                  ) : (
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      None provided
                    </Typography>
                  )}
                </Grid>

                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                    Salary Range
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {selectedApp.salary_min !== undefined || selectedApp.salary_max !== undefined
                      ? `$${(selectedApp.salary_min || 0).toLocaleString()} - $${(selectedApp.salary_max || 0).toLocaleString()}`
                      : 'Not Specified'}
                  </Typography>
                </Grid>

                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                    Location / Mode
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {selectedApp.location || 'Not Specified'} {selectedApp.remote && '(Remote)'}
                  </Typography>
                </Grid>

                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                    Applied Date
                  </Typography>
                  <Typography variant="body2">
                    {selectedApp.applied_date
                      ? selectedApp.applied_date.split('T')[0]
                      : 'Not applied yet'}
                  </Typography>
                </Grid>

                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                    Recruiter Contact
                  </Typography>
                  {selectedApp.contact_name ? (
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {selectedApp.contact_name}{' '}
                      {selectedApp.contact_email && `(${selectedApp.contact_email})`}
                    </Typography>
                  ) : (
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      None
                    </Typography>
                  )}
                </Grid>

                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                    Skills & Tags
                  </Typography>
                  <Box sx={{ mt: 0.5, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selectedApp.tags.length === 0 ? (
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        None
                      </Typography>
                    ) : (
                      selectedApp.tags.map((t) => <Chip key={t} label={t} size="small" />)
                    )}
                  </Box>
                </Grid>

                <Grid size={{ xs: 12 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                    Linked Documents
                  </Typography>
                  <Stack direction="row" spacing={2}>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => router.push(`/dashboard/resume?app_id=${selectedApp.id}`)}
                    >
                      Generate Tailored Resume
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      color="secondary"
                      onClick={() => router.push(`/dashboard/gmail?app_id=${selectedApp.id}`)}
                    >
                      Send Outreach Email
                    </Button>
                  </Stack>
                </Grid>

                {selectedApp.job_description && (
                  <Grid size={{ xs: 12 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                      Job Description
                    </Typography>
                    <Paper
                      sx={{
                        p: 2,
                        bgcolor: 'rgba(15, 23, 42, 0.03)',
                        border: '1px solid',
                        borderColor: 'divider',
                        maxHeight: 200,
                        overflowY: 'auto',
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{
                          whiteSpace: 'pre-line',
                          color: 'text.secondary',
                          fontFamily: 'monospace',
                          fontSize: '0.8rem',
                        }}
                      >
                        {selectedApp.job_description}
                      </Typography>
                    </Paper>
                  </Grid>
                )}

                {selectedApp.notes && (
                  <Grid size={{ xs: 12 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                      Private Notes
                    </Typography>
                    <Paper
                      sx={{
                        p: 2,
                        bgcolor: 'rgba(13, 148, 136, 0.04)',
                        border: '1px solid rgba(13, 148, 136, 0.15)',
                      }}
                    >
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                        {selectedApp.notes}
                      </Typography>
                    </Paper>
                  </Grid>
                )}
              </Grid>
            </DialogContent>
            <DialogActions sx={{ p: 3, justifyContent: 'space-between' }}>
              <Button color="error" startIcon={<DeleteIcon />} onClick={() => handleDelete(selectedApp)}>
                Delete Application
              </Button>
              <Stack direction="row" spacing={1.5}>
                <Button onClick={() => setSelectedId(null)}>Close</Button>
                <Button variant="contained" onClick={() => handleOpenEdit(selectedApp)}>
                  Edit Details
                </Button>
              </Stack>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}
