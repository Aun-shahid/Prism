import { createSlice, nanoid, type PayloadAction } from '@reduxjs/toolkit';

export type ToastSeverity = 'success' | 'info' | 'warning' | 'error';

export interface Toast {
  id: string;
  message: string;
  title?: string;
  severity: ToastSeverity;
}

interface UiState {
  sidebarCollapsed: boolean;
  toasts: Toast[];
}

const initialState: UiState = {
  sidebarCollapsed: false,
  toasts: [],
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleSidebar(state) {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },
    setSidebarCollapsed(state, action: PayloadAction<boolean>) {
      state.sidebarCollapsed = action.payload;
    },
    showToast: {
      reducer(state, action: PayloadAction<Toast>) {
        state.toasts.push(action.payload);
      },
      prepare(toast: { message: string; title?: string; severity?: ToastSeverity }) {
        return {
          payload: {
            id: nanoid(),
            message: toast.message,
            title: toast.title,
            severity: toast.severity ?? 'info',
          } satisfies Toast,
        };
      },
    },
    dismissToast(state, action: PayloadAction<string>) {
      state.toasts = state.toasts.filter((t) => t.id !== action.payload);
    },
  },
});

export const { toggleSidebar, setSidebarCollapsed, showToast, dismissToast } =
  uiSlice.actions;
export default uiSlice.reducer;
