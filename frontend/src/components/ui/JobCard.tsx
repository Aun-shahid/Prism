'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

interface JobCardProps {
  title: string;
  company?: string;
  isNew?: boolean;
  /** e.g. "2-4 yrs" */
  experience?: string | null;
  snippet?: string;
  keywords?: string[];
  discoveredAt?: string;
  /** Action buttons (open/import/mark read/dismiss...) supplied by the page. */
  actions?: React.ReactNode;
  onClick?: () => void;
  read?: boolean;
}

/** Shared job listing card used by Browse Jobs and the Watchlist feed. */
function JobCard({
  title,
  company,
  isNew,
  experience,
  snippet,
  keywords,
  discoveredAt,
  actions,
  onClick,
  read,
}: JobCardProps) {
  return (
    <Paper
      onClick={onClick}
      sx={{
        p: 2.5,
        border: '1px solid',
        borderColor: isNew ? 'rgba(13, 148, 136, 0.35)' : 'divider',
        borderRadius: 3,
        opacity: read ? 0.72 : 1,
        transition: 'border-color 150ms ease, box-shadow 150ms ease',
        ...(onClick && {
          cursor: 'pointer',
          '&:hover': { boxShadow: '0 4px 16px rgba(15, 23, 42, 0.08)' },
        }),
      }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', mb: 0.75 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mr: 0.5 }}>
          {title}
        </Typography>
        {isNew && (
          <Chip
            label="NEW"
            size="small"
            sx={{
              bgcolor: 'rgba(13, 148, 136, 0.12)',
              color: 'primary.main',
              fontSize: '0.65rem',
              height: 20,
            }}
          />
        )}
        {experience && (
          <Chip
            label={experience}
            size="small"
            variant="outlined"
            sx={{ fontSize: '0.65rem', height: 20, color: 'text.secondary' }}
          />
        )}
      </Stack>
      {company && (
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: snippet ? 0.5 : 0 }}>
          {company}
        </Typography>
      )}
      {snippet && (
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
            mb: 1,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {snippet}
        </Typography>
      )}
      {keywords && keywords.length > 0 && (
        <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', gap: 0.75, mb: 1 }}>
          {keywords.slice(0, 6).map((kw) => (
            <Chip
              key={kw}
              label={kw}
              size="small"
              sx={{
                bgcolor: 'rgba(13, 148, 136, 0.08)',
                color: 'primary.dark',
                fontSize: '0.7rem',
                height: 22,
              }}
            />
          ))}
        </Stack>
      )}
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: 'center', justifyContent: 'space-between', mt: 1 }}
      >
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {discoveredAt}
        </Typography>
        {actions && (
          <Box onClick={(e) => e.stopPropagation()}>
            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
              {actions}
            </Stack>
          </Box>
        )}
      </Stack>
    </Paper>
  );
}

export default React.memo(JobCard);
