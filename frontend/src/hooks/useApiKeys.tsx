'use client';

import * as React from 'react';
import { useGetApiKeysQuery } from '../store/prismApi';

/**
 * Thin wrapper over the RTK Query api-keys cache. Keeps the pre-Redux return
 * shape so consumers (NoApiKeyTooltip, assistant, settings, ...) are unchanged.
 */
export function useApiKeys() {
  const { data, isLoading, refetch } = useGetApiKeysQuery();

  const activeProviders = React.useMemo(
    () => (data ?? []).filter((k) => k.is_active).map((k) => k.provider as string),
    [data]
  );

  const refresh = React.useCallback(async () => {
    await refetch();
  }, [refetch]);

  return {
    hasActiveKey: activeProviders.length > 0,
    activeProviders,
    loading: isLoading,
    refresh,
  };
}
