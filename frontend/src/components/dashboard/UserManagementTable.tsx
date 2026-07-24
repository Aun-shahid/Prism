'use client';

import * as React from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import DeleteIcon from '@mui/icons-material/Delete';
import PeopleIcon from '@mui/icons-material/PeopleOutlined';
import { useAuth } from '../../hooks/useAuth';
import {
  useDeleteUserMutation,
  useGetUsersQuery,
  useUpdateUserMutation,
} from '../../store/prismApi';
import { useAppDispatch } from '../../store/hooks';
import { showToast } from '../../store/uiSlice';
import type { User } from '../../services/users';
import PageHeader from '../ui/PageHeader';
import DataTable, { type DataTableColumn } from '../ui/DataTable';
import EmptyState from '../ui/EmptyState';
import { useConfirm } from '../ui/ConfirmDialog';

export default function UserManagementTable() {
  const { user: currentUser } = useAuth();
  const dispatch = useAppDispatch();
  const confirm = useConfirm();

  const { data: users, isLoading, error } = useGetUsersQuery();
  const [updateUser] = useUpdateUserMutation();
  const [deleteUser] = useDeleteUserMutation();

  const fail = (message: string) => dispatch(showToast({ message, severity: 'error' }));

  const handleToggleRole = async (usr: User) => {
    const newRole = usr.role === 'super_admin' ? 'user' : 'super_admin';
    try {
      await updateUser({ userId: usr.id, payload: { role: newRole } }).unwrap();
      dispatch(showToast({ message: `${usr.name} is now ${newRole.replace('_', ' ')}`, severity: 'success' }));
    } catch {
      fail('Failed to update user role');
    }
  };

  const handleToggleStatus = async (usr: User) => {
    try {
      await updateUser({ userId: usr.id, payload: { is_active: !usr.is_active } }).unwrap();
      dispatch(
        showToast({ message: `${usr.name} ${usr.is_active ? 'blocked' : 'activated'}`, severity: 'success' })
      );
    } catch {
      fail('Failed to update user status');
    }
  };

  const handleDelete = async (usr: User) => {
    const ok = await confirm({
      title: 'Delete user?',
      body: `${usr.name} (${usr.email}) and their data will be removed permanently.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteUser(usr.id).unwrap();
      dispatch(showToast({ message: 'User deleted', severity: 'success' }));
    } catch {
      fail('Failed to delete user');
    }
  };

  const columns: DataTableColumn<User>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (usr) => (
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {usr.name}
        </Typography>
      ),
    },
    { key: 'username', header: 'Username', render: (usr) => usr.username || '-' },
    { key: 'email', header: 'Email' },
    {
      key: 'role',
      header: 'Role',
      render: (usr) => (
        <Chip
          label={usr.role === 'super_admin' ? 'Admin' : 'User'}
          size="small"
          sx={
            usr.role === 'super_admin'
              ? { bgcolor: 'rgba(13, 148, 136, 0.12)', color: 'primary.dark' }
              : undefined
          }
        />
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (usr) => (
        <Chip
          label={usr.is_active ? 'Active' : 'Inactive'}
          color={usr.is_active ? 'success' : 'error'}
          variant="outlined"
          size="small"
        />
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (usr) => (
        <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
          <Button size="small" variant="outlined" onClick={() => handleToggleRole(usr)}>
            Role
          </Button>
          <Button
            size="small"
            variant="outlined"
            color={usr.is_active ? 'warning' : 'success'}
            onClick={() => handleToggleStatus(usr)}
          >
            {usr.is_active ? 'Block' : 'Activate'}
          </Button>
          <IconButton
            color="error"
            size="small"
            disabled={usr.id === currentUser?.id}
            onClick={() => handleDelete(usr)}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Stack>
      ),
    },
  ];

  return (
    <Box>
      <PageHeader title="User Management" subtitle="Manage platform accounts, roles and access." />
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Failed to retrieve users.
        </Alert>
      )}
      <DataTable
        columns={columns}
        rows={users}
        getRowKey={(usr) => usr.id}
        loading={isLoading}
        emptyState={<EmptyState dense icon={<PeopleIcon />} title="No users found" />}
      />
    </Box>
  );
}
