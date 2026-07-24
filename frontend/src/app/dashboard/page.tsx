'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import UserOverview from '../../components/dashboard/UserOverview';
import AdminOverview from '../../components/dashboard/AdminOverview';
import UserManagementTable from '../../components/dashboard/UserManagementTable';

export default function DashboardPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get('tab') || 'overview';
  const isAdmin = user?.role === 'super_admin';

  if (isAdmin && currentTab === 'users') {
    return <UserManagementTable />;
  }
  if (isAdmin) {
    return <AdminOverview />;
  }
  return <UserOverview />;
}
