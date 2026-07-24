'use client';

import * as React from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { JobApplication } from '../../services/applications';

interface KanbanCardProps {
  app: JobApplication;
  dragging: boolean;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, appId: string) => void;
  onDragEnd: () => void;
  onClick: (app: JobApplication) => void;
}

function KanbanCard({ app, dragging, onDragStart, onDragEnd, onClick }: KanbanCardProps) {
  return (
    <Card
      draggable
      onDragStart={(e) => onDragStart(e, app.id)}
      onDragEnd={onDragEnd}
      onClick={() => onClick(app)}
      sx={{
        cursor: dragging ? 'grabbing' : 'grab',
        opacity: dragging ? 0.45 : 1,
        transform: dragging ? 'rotate(2deg) scale(1.02)' : 'none',
        boxShadow: dragging ? '0 12px 24px rgba(15, 23, 42, 0.18)' : undefined,
        transition: 'transform 150ms ease, opacity 150ms ease, box-shadow 150ms ease, border-color 150ms ease',
        '&:hover': { transform: dragging ? undefined : 'translateY(-2px)', borderColor: 'primary.main' },
      }}
    >
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          {app.company}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1, fontSize: '0.85rem' }}>
          {app.position}
        </Typography>
        {app.location && (
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
            {app.location} {app.remote && '(Remote)'}
          </Typography>
        )}
        {app.tags.length > 0 && (
          <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
            {app.tags.slice(0, 2).map((t) => (
              <Chip key={t} label={t} size="small" sx={{ fontSize: '0.7rem', height: 18 }} />
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

export default React.memo(KanbanCard);
