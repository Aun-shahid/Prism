'use client';

import * as React from 'react';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';

export interface DataTableColumn<T> {
  key: string;
  header: React.ReactNode;
  render?: (row: T) => React.ReactNode;
  align?: 'left' | 'right' | 'center';
  width?: number | string;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[] | undefined;
  getRowKey: (row: T) => string;
  loading?: boolean;
  skeletonRows?: number;
  /** Rendered inside the table shell when there are no rows. */
  emptyState?: React.ReactNode;
  onRowClick?: (row: T) => void;
  size?: 'small' | 'medium';
  maxHeight?: number | string;
}

export default function DataTable<T>({
  columns,
  rows,
  getRowKey,
  loading,
  skeletonRows = 5,
  emptyState,
  onRowClick,
  size = 'medium',
  maxHeight,
}: DataTableProps<T>) {
  const showSkeleton = loading && (!rows || rows.length === 0);
  const showEmpty = !loading && rows && rows.length === 0;

  return (
    <TableContainer
      component={Paper}
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 3.5,
        boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05)',
        ...(maxHeight ? { maxHeight } : {}),
      }}
    >
      <Table stickyHeader size={size}>
        <TableHead>
          <TableRow>
            {columns.map((col) => (
              <TableCell
                key={col.key}
                align={col.align}
                sx={{ width: col.width, bgcolor: 'background.paper' }}
              >
                {col.header}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {showSkeleton &&
            Array.from({ length: skeletonRows }, (_, r) => (
              <TableRow key={`skeleton-${r}`}>
                {columns.map((col) => (
                  <TableCell key={col.key} align={col.align}>
                    <Skeleton height={20} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          {showEmpty && (
            <TableRow>
              <TableCell colSpan={columns.length} sx={{ border: 0, p: 0 }}>
                {emptyState}
              </TableCell>
            </TableRow>
          )}
          {!showSkeleton &&
            rows?.map((row) => (
              <TableRow
                key={getRowKey(row)}
                hover={Boolean(onRowClick)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                sx={onRowClick ? { cursor: 'pointer' } : undefined}
              >
                {columns.map((col) => (
                  <TableCell key={col.key} align={col.align}>
                    {col.render
                      ? col.render(row)
                      : String((row as Record<string, unknown>)[col.key] ?? '')}
                  </TableCell>
                ))}
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
