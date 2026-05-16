import { createAsyncThunk } from '@reduxjs/toolkit';
import { workspaceApi } from '../../services/workspaceApi';
import type { Workspace } from '../../services/workspaceApi';

export const fetchWorkspaces = createAsyncThunk(
  'workspace/fetchWorkspaces',
  async (_, { rejectWithValue }) => {
    try {
      const response = await workspaceApi.getWorkspaces();
      return response;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch workspaces');
    }
  }
);

export const createWorkspace = createAsyncThunk(
  'workspace/createWorkspace',
  async (name: string, { rejectWithValue }) => {
    try {
      const response = await workspaceApi.createWorkspace(name);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create workspace');
    }
  }
);
