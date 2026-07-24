'use client';

import * as React from 'react';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { dismissToast } from '../../store/uiSlice';

/**
 * Single global toast outlet fed by the ui slice — dispatch showToast(...)
 * from anywhere instead of mounting per-page Snackbars.
 */
export default function AppToaster() {
  const dispatch = useAppDispatch();
  const toast = useAppSelector((s) => s.ui.toasts[0]);

  if (!toast) return null;

  const handleClose = (_?: unknown, reason?: string) => {
    if (reason === 'clickaway') return;
    dispatch(dismissToast(toast.id));
  };

  return (
    <Snackbar
      key={toast.id}
      open
      autoHideDuration={5000}
      onClose={handleClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
    >
      <Alert
        onClose={handleClose}
        severity={toast.severity}
        variant="outlined"
        sx={{ bgcolor: 'background.paper', boxShadow: 3, minWidth: 280 }}
      >
        {toast.title && <AlertTitle>{toast.title}</AlertTitle>}
        {toast.message}
      </Alert>
    </Snackbar>
  );
}
