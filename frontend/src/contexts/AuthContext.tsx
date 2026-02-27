import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { api } from '../services/api';
import { selectCurrentUser, selectUserProfile, setCurrentUser, setUserProfile } from '../redux/auth/authSlice';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../redux/store';

interface User {
    id: string;
    name: string;
    email: string;
}

interface AuthContextType {
    user: User | null;
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
    const [token, setToken] = useState<string | null>(() => currentUser?.access_token);
    const [loading, setLoading] = useState(true);
    const dispatch = useDispatch()
    // On mount: if we have a stored token, fetch the user profile
    const callStoreUserProfile = (data: any) => {
        dispatch(setUserProfile(data))
    }
    useEffect(() => {
        if (token) {
            api.auth
                .profile()
                .then(callStoreUserProfile)
                .catch(() => logout())
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
        const { access_token } = await api.auth.register({ name, email, password });
        localStorage.setItem('meetify_token', access_token);
        setToken(access_token);
        const profile = await api.auth.profile();
        callStoreUserProfile(profile);
    };

    const logout = () => {
        localStorage.removeItem('meetify_token');
        setToken(null);
        callStoreUserProfile(null);
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
