'use client';

import * as React from 'react';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import type { ApplicationStatus, JobApplication } from '../../services/applications';
import KanbanCard from './KanbanCard';

interface KanbanColumnProps {
  status: ApplicationStatus;
  label: string;
  apps: JobApplication[];
  isDragOver: boolean;
  draggedId: string | null;
  onDragOver: (e: React.DragEvent<HTMLDivElement>, status: ApplicationStatus) => void;
  onDragLeave: (status: ApplicationStatus) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>, status: ApplicationStatus) => void;
  onCardDragStart: (e: React.DragEvent<HTMLDivElement>, appId: string) => void;
  onCardDragEnd: () => void;
  onCardClick: (app: JobApplication) => void;
}

export default function KanbanColumn({
  status,
  label,
  apps,
  isDragOver,
  draggedId,
  onDragOver,
  onDragLeave,
  onDrop,
  onCardDragStart,
  onCardDragEnd,
  onCardClick,
}: KanbanColumnProps) {
  const [stackRef] = useAutoAnimate<HTMLDivElement>();

  return (
    <Paper
      onDragOver={(e) => onDragOver(e, status)}
      onDragLeave={() => onDragLeave(status)}
      onDrop={(e) => onDrop(e, status)}
      sx={(t) => {
        const tokens = (t.vars ?? t).palette.appStatus[status];
        return {
          p: 1.5,
          minHeight: '60vh',
          bgcolor: isDragOver ? 'rgba(13, 148, 136, 0.08)' : 'rgba(15, 23, 42, 0.02)',
          borderTop: `3px solid ${tokens?.fg ?? (t.vars ?? t).palette.primary.main}`,
          outline: isDragOver ? '2px dashed' : '2px dashed transparent',
          outlineColor: isDragOver ? 'primary.main' : 'transparent',
          outlineOffset: '-2px',
          transition: 'background-color 0.15s, outline-color 0.15s',
        };
      }}
    >
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          {label}
        </Typography>
        <Chip label={apps.length} size="small" sx={{ fontWeight: 700, height: 20 }} />
      </Stack>

      <Stack spacing={1.5} ref={stackRef}>
        {apps.map((app) => (
          <KanbanCard
            key={app.id}
            app={app}
            dragging={draggedId === app.id}
            onDragStart={onCardDragStart}
            onDragEnd={onCardDragEnd}
            onClick={onCardClick}
          />
        ))}
      </Stack>
    </Paper>
  );
}
