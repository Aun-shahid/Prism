'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlined';
import EmptyState from '../components/ui/EmptyState';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  React.useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Box sx={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <EmptyState
        icon={<ErrorOutlineIcon />}
        title="Something went wrong"
        description="An unexpected error occurred. Try again — if it keeps happening, reload the page."
        action={
          <Button variant="contained" onClick={reset}>
            Try again
          </Button>
        }
      />
    </Box>
  );
}
