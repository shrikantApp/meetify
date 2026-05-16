import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Workspace } from '../../services/workspaceApi';
import { fetchWorkspaces, createWorkspace } from './workspaceThunks';

interface WorkspaceState {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  loading: boolean;
  error: string | null;
}

const initialState: WorkspaceState = {
  workspaces: [],
  activeWorkspaceId: null,
  loading: false,
  error: null,
};

const workspaceSlice = createSlice({
  name: 'workspace',
  initialState,
  reducers: {
    setActiveWorkspace: (state, action: PayloadAction<string>) => {
      state.activeWorkspaceId = action.payload;
    },
    clearWorkspaceError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Workspaces
      .addCase(fetchWorkspaces.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchWorkspaces.fulfilled, (state, action: PayloadAction<Workspace[]>) => {
        state.loading = false;
        state.workspaces = action.payload;
        if (action.payload.length > 0 && !state.activeWorkspaceId) {
          state.activeWorkspaceId = action.payload[0].id;
        }
      })
      .addCase(fetchWorkspaces.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Create Workspace
      .addCase(createWorkspace.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createWorkspace.fulfilled, (state, action: PayloadAction<Workspace>) => {
        state.loading = false;
        state.workspaces.push(action.payload);
        state.activeWorkspaceId = action.payload.id;
      })
      .addCase(createWorkspace.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { setActiveWorkspace, clearWorkspaceError } = workspaceSlice.actions;
export default workspaceSlice.reducer;
