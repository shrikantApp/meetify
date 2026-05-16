import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Video, Mail, Lock, ArrowRight, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';

export default function LoginPage() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await login(email, password);
            navigate('/dashboard');
        } catch (err: any) {
            setError(err.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-screen w-full flex items-center justify-center relative overflow-y-auto bg-[#05060a] py-8">
            {/* Animated Background Mesh */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-[var(--accent-primary)]/10 blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-[var(--accent-secondary)]/10 blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
            </div>

            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="z-10 w-full max-w-[420px] p-4"
            >
                <div className="glass-morphism rounded-[2.5rem] p-8 md:p-10 premium-shadow border border-white/10 relative overflow-hidden">
                    {/* Decorative element */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-white/5 to-transparent rounded-bl-full -mr-16 -mt-16" />
                    
                    <div className="flex flex-col items-center mb-10">
                        <motion.div 
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="w-16 h-16 premium-gradient rounded-2xl flex items-center justify-center mb-6 shadow-2xl shadow-[var(--accent-primary)]/20"
                        >
                            <Video className="text-white w-8 h-8" />
                        </motion.div>
                        <h1 className="text-3xl font-black text-white tracking-tight mb-2">Welcome Back</h1>
                        <p className="text-[13px] font-semibold text-[var(--text-secondary)] uppercase tracking-[0.2em] opacity-70">
                            Enterprise Chat & Meetings
                        </p>
                    </div>

                    {error && (
                        <motion.div 
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold flex items-center gap-3"
                        >
                            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                            {error}
                        </motion.div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest ml-1">Email Address</label>
                            <div className="relative group">
                                <Mail className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] group-focus-within:text-[var(--accent-primary)] transition-colors" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="name@company.com"
                                    required
                                    className="w-full pl-11 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-2xl focus:ring-4 focus:ring-[var(--accent-primary)]/10 focus:border-[var(--accent-primary)] outline-none transition-all font-semibold text-sm text-white placeholder-white/20"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-center px-1">
                                <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Password</label>
                                <a href="#" className="text-[10px] font-bold text-[var(--accent-primary)] uppercase tracking-widest hover:underline">Forgot?</a>
                            </div>
                            <div className="relative group">
                                <Lock className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] group-focus-within:text-[var(--accent-primary)] transition-colors" />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••••••"
                                    required
                                    className="w-full pl-11 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-2xl focus:ring-4 focus:ring-[var(--accent-primary)]/10 focus:border-[var(--accent-primary)] outline-none transition-all font-semibold text-sm text-white placeholder-white/20"
                                />
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            disabled={loading}
                            className="w-full py-4 premium-gradient rounded-2xl text-white font-bold text-sm shadow-xl shadow-[var(--accent-primary)]/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <span>Sign in to workspace</span>
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-10 pt-8 border-t border-white/5 flex flex-col items-center gap-4">
                        <p className="text-[13px] text-[var(--text-secondary)] font-medium">
                            Don't have an account? <Link to="/register" className="text-[var(--accent-primary)] font-bold hover:underline">Create one</Link>
                        </p>
                        
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Enterprise Grade Security</span>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
