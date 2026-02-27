'use client';

import { createSlice } from '@reduxjs/toolkit';
import type { RootState } from '../store';

export const authSlice = createSlice({
    name: 'auth',
    initialState: {
        currentUser: {
            access_token: '',
            token_type: '',
        },
        userProfile: {
            id: "",
            name: "",
            email: "",
            createdAt: "",
            updatedAt: "",
        }
    },
    reducers: {
        setCurrentUser: (state, action) => {
            state.currentUser = action.payload;
        },
        setUserProfile: (state, action) => {
            state.userProfile = action?.payload;
        }
    }
});

// Action creators are generated for each case reducer function
export const { setCurrentUser, setUserProfile } = authSlice.actions;

export default authSlice.reducer;
export const selectCurrentUser = (state: RootState) =>
    state?.auth?.currentUser;
export const selectUserProfile = (state: RootState) =>
    state?.auth?.userProfile;