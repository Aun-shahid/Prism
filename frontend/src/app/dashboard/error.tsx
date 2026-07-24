'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlined';
import EmptyState from '../../components/ui/EmptyState';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  React.useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 8 }}>
      <EmptyState
        icon={<ErrorOutlineIcon />}
        title="This page hit an error"
        description="Your data is safe. Try again, or navigate to another section."
        action={
          <Button variant="contained" onClick={reset}>
            Try again
          </Button>
        }
      />
    </Box>
  );
}
