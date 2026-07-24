import type { BaseQueryFn } from '@reduxjs/toolkit/query';
import type { AxiosError, AxiosRequestConfig } from 'axios';
import api from '../api';

/**
 * RTK Query base query that delegates to the shared axios instance so its
 * interceptors (Bearer injection + single-flight 401 refresh in src/api.ts)
 * keep working untouched.
 */
export interface AxiosQueryArgs {
  url: string;
  method?: AxiosRequestConfig['method'];
  data?: unknown;
  params?: Record<string, unknown>;
  timeout?: number;
  headers?: Record<string, string>;
}

export interface AxiosQueryError {
  status?: number;
  data?: unknown;
}

export const axiosBaseQuery =
  (): BaseQueryFn<AxiosQueryArgs, unknown, AxiosQueryError> =>
  async ({ url, method = 'GET', data, params, timeout, headers }) => {
    try {
      const result = await api({ url, method, data, params, timeout, headers });
      return { data: result.data };
    } catch (raw) {
      const err = raw as AxiosError;
      return {
        error: {
          status: err.response?.status,
          data: err.response?.data ?? err.message,
        },
      };
    }
  };
