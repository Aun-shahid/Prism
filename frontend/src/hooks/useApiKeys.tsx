'use client';

import * as React from 'react';
import { apiKeysService } from '../services/apiKeys';

interface ApiKeysContextType {
  hasActiveKey: boolean;
  activeProviders: string[];
  loading: boolean;
  refresh: () => Promise<void>;
}

const ApiKeysContext = React.createContext<ApiKeysContextType | undefined>(undefined);

export function ApiKeysProvider({ children }: { children: React.ReactNode }) {
  const [activeProviders, setActiveProviders] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);

  const refresh = React.useCallback(async () => {
    try {
      setLoading(true);
      const keys = await apiKeysService.listKeys();
      setActiveProviders(keys.filter(k => k.is_active).map(k => k.provider));
    } catch {
      // Endpoint may be briefly unavailable — leave the last known state alone
      // rather than incorrectly disabling every AI action in the app.
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const value = React.useMemo(
    () => ({
      hasActiveKey: activeProviders.length > 0,
      activeProviders,
      loading,
      refresh,
    }),
    [activeProviders, loading, refresh]
  );

  return <ApiKeysContext.Provider value={value}>{children}</ApiKeysContext.Provider>;
}

export function useApiKeys() {
  const context = React.useContext(ApiKeysContext);
  if (context === undefined) {
    throw new Error('useApiKeys must be used within an ApiKeysProvider');
  }
  return context;
}
