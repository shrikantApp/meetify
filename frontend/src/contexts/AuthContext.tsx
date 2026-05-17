import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { ApiError, api } from '../services/api';
import { selectCurrentUser, selectUserProfile, setCurrentUser, setUserProfile, type UserProfile } from '../redux/auth/authSlice';
import { useAppDispatch, useAppSelector } from '../redux/store';
import { resetAppState } from '../redux/rootReducer';

interface AuthContextType {
    user: UserProfile | null;
    token: string | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (name: string, email: string, password: string) => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
    const currentUser = useAppSelector(selectCurrentUser)
    const userProfile = useAppSelector(selectUserProfile)
    const [token, setToken] = useState<string | null>(() => currentUser?.access_token || null);
    const [loading, setLoading] = useState(true);
    const dispatch = useAppDispatch()
    // On mount: if we have a stored token, fetch the user profile
    const callStoreUserProfile = (data: any) => {
        dispatch(setUserProfile(data))
    }

    const clearSession = () => {
        localStorage.removeItem('meetify_token');
        localStorage.removeItem('persist:root');
        setToken(null);
        dispatch(resetAppState());
    };

    useEffect(() => {
        const persistedToken = currentUser?.access_token || null;

        if (persistedToken) {
            localStorage.setItem('meetify_token', persistedToken);
            setToken(persistedToken);
            api.auth
                .profile()
                .then(callStoreUserProfile)
                .catch((error) => {
                    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
                        clearSession();
                    }
                })
                .finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, []);

    const login = async (email: string, password: string) => {
        const { access_token, token_type } = await api.auth.login({ email, password });
        localStorage.setItem('meetify_token', access_token);
        setToken(access_token);
        dispatch(setCurrentUser({ access_token, token_type }))
        const profile = await api.auth.profile();
        callStoreUserProfile(profile);
    };

    const register = async (name: string, email: string, password: string) => {
        const { access_token, token_type } = await api.auth.register({ name, email, password });
        localStorage.setItem('meetify_token', access_token);
        setToken(access_token);
        dispatch(setCurrentUser({ access_token, token_type }));
        const profile = await api.auth.profile();
        callStoreUserProfile(profile);
    };

    const logout = () => {
        clearSession();
    };

    return (
        <AuthContext.Provider value={{ user: userProfile, token, loading, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
