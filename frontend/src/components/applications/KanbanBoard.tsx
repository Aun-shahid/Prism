'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import type { ApplicationStatus, JobApplication } from '../../services/applications';
import KanbanColumn from './KanbanColumn';
import { STATUSES } from './statuses';

interface KanbanBoardProps {
  applications: JobApplication[];
  onMove: (appId: string, status: ApplicationStatus) => void;
  onCardClick: (app: JobApplication) => void;
}

export default function KanbanBoard({ applications, onMove, onCardClick }: KanbanBoardProps) {
  const [draggedId, setDraggedId] = React.useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = React.useState<ApplicationStatus | null>(null);

  const handleCardDragStart = React.useCallback((e: React.DragEvent<HTMLDivElement>, appId: string) => {
    setDraggedId(appId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', appId);
  }, []);

  const handleCardDragEnd = React.useCallback(() => {
    setDraggedId(null);
    setDragOverCol(null);
  }, []);

  const handleColumnDragOver = React.useCallback(
    (e: React.DragEvent<HTMLDivElement>, status: ApplicationStatus) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDragOverCol((prev) => (prev === status ? prev : status));
    },
    []
  );

  const handleColumnDragLeave = React.useCallback((status: ApplicationStatus) => {
    setDragOverCol((prev) => (prev === status ? null : prev));
  }, []);

  const handleColumnDrop = (e: React.DragEvent<HTMLDivElement>, newStatus: ApplicationStatus) => {
    e.preventDefault();
    setDragOverCol(null);
    const appId = draggedId || e.dataTransfer.getData('text/plain');
    setDraggedId(null);
    if (!appId) return;
    const app = applications.find((a) => a.id === appId);
    if (!app || app.status === newStatus) return;
    onMove(appId, newStatus);
  };

  return (
    <Box sx={{ overflowX: 'auto', pb: 2 }}>
      <Grid container spacing={2} sx={{ minWidth: 1000 }}>
        {STATUSES.map((col) => (
          <Grid size={{ xs: 2 }} key={col.value} sx={{ minWidth: 200 }}>
            <KanbanColumn
              status={col.value}
              label={col.label}
              apps={applications.filter((app) => app.status === col.value)}
              isDragOver={dragOverCol === col.value}
              draggedId={draggedId}
              onDragOver={handleColumnDragOver}
              onDragLeave={handleColumnDragLeave}
              onDrop={handleColumnDrop}
              onCardDragStart={handleCardDragStart}
              onCardDragEnd={handleCardDragEnd}
              onCardClick={onCardClick}
            />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
