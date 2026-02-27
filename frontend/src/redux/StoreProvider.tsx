'use client';

import React, { useRef } from 'react';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';

import { type AppStore, makeStore, createPersistor } from './store';

const StoreProvider = ({ children }: { children: React.ReactNode }) => {
    const storeRef = useRef<AppStore | null>(null);
    const persistorRef = useRef<any>(null);

    if (!storeRef.current) {
        storeRef.current = makeStore();
        persistorRef.current = createPersistor(storeRef.current);
    }

    return (
        <Provider store={storeRef.current}>
            <PersistGate loading={null} persistor={persistorRef.current}>
                {children}
            </PersistGate>
        </Provider>
    );
};

export default StoreProvider;
