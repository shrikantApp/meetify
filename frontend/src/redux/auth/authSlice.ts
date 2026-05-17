'use client';

import { createSlice } from '@reduxjs/toolkit';
import type { RootState } from '../store';

export interface UserProfile {
    id: string;
    name: string;
    fullName?: string | null;
    email: string;
    title?: string | null;
    designation?: string | null;
    phoneNumber?: string | null;
    dateOfBirth?: string | null;
    avatarUrl?: string | null;
    isOnline?: boolean;
    lastSeen?: string | null;
    createdAt: string;
    updatedAt: string;
}

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
            fullName: "",
            email: "",
            title: "",
            designation: "",
            phoneNumber: "",
            dateOfBirth: "",
            avatarUrl: "",
            isOnline: false,
            lastSeen: "",
            createdAt: "",
            updatedAt: "",
        } as UserProfile,
    },
    reducers: {
        setCurrentUser: (state, action) => {
            state.currentUser = action.payload;
        },
        setUserProfile: (state, action) => {
            state.userProfile = action?.payload ?? {
                id: "",
                name: "",
                fullName: "",
                email: "",
                title: "",
                designation: "",
                phoneNumber: "",
                dateOfBirth: "",
                avatarUrl: "",
                isOnline: false,
                lastSeen: "",
                createdAt: "",
                updatedAt: "",
            };
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
