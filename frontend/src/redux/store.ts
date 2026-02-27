import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { type TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import {
    persistReducer,
    persistStore,
    FLUSH,
    REHYDRATE,
    PAUSE,
    PERSIST,
    PURGE,
    REGISTER,
} from 'redux-persist';
import storage from 'redux-persist/lib/storage'; // localStorage

import AuthReducer from './auth/authSlice';

// Combine reducers
const rootReducer = combineReducers({
    auth: AuthReducer,
});

// Persist config
const persistConfig = {
    key: 'root',
    storage,
    // whitelist: ['auth'], // only persist auth slice
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const makeStore = () => {
    const store = configureStore({
        reducer: persistedReducer,
        middleware: (getDefaultMiddleware) =>
            getDefaultMiddleware({
                serializableCheck: {
                    ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
                },
            }),
    });

    return store;
};

// Types
export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

// Persistor creator
export const createPersistor = (store: AppStore) => persistStore(store);
