import { combineReducers } from '@reduxjs/toolkit';
import { createAction } from '@reduxjs/toolkit';

import AuthReducer from './auth/authSlice';
import chatReducer from './chat/chatSlice';
import workspaceReducer from './workspace/workspaceSlice';
import notificationReducer from './notifications/notificationSlice';

export const reducers = {
  auth: AuthReducer,
  chat: chatReducer,
  workspace: workspaceReducer,
  notifications: notificationReducer,
};

const appReducer = combineReducers(reducers);

export const resetAppState = createAction('app/resetState');

export const rootReducer = (state: ReturnType<typeof appReducer> | undefined, action: Parameters<typeof appReducer>[1]) => {
  if (resetAppState.match(action)) {
    return appReducer(undefined, action);
  }

  return appReducer(state, action);
};
