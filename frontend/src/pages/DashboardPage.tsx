import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { Video, Plus, LogIn, LogOut, Copy, Check } from 'lucide-react';

interface Meeting {
    id: string;
    meetingCode: string;
    title: string;
    createdAt: string;
}

export default function DashboardPage() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showJoinModal, setShowJoinModal] = useState(false);
    const [title, setTitle] = useState('');
    const [joinCode, setJoinCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState<string | null>(null);

    useEffect(() => {
        api.meetings.list().then(setMeetings).catch(console.error);
    }, []);

    const handleCreate = async (e: FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const meeting = await api.meetings.create({ title });
            setMeetings((prev) => [{ ...meeting, createdAt: new Date().toISOString() }, ...prev]);
            setShowCreateModal(false);
            setTitle('');
            navigate(`/meeting/${meeting.meetingCode}`);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleJoin = (e: FormEvent) => {
        e.preventDefault();
        if (joinCode.trim()) {
            navigate(`/meeting/${joinCode.trim().toUpperCase()}`);
        }
    };

    const copyLink = (code: string) => {
        navigator.clipboard.writeText(`${window.location.origin}/meeting/${code}`);
        setCopied(code);
        setTimeout(() => setCopied(null), 2000);
    };

    return (
        <div className="dashboard">
            {/* ── NAV ── */}
            <nav className="navbar">
                <div className="logo">
                    <Video size={22} />
                    Meetify
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        Hey, <strong style={{ color: 'var(--text-primary)' }}>{user?.name}</strong>
                    </span>
                    <button className="btn btn-ghost" onClick={logout} style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                        <LogOut size={16} />
                        Logout
                    </button>
                </div>
            </nav>

            {/* ── CONTENT ── */}
            <div className="dashboard-content">
                <div className="dashboard-hero">
                    <h2>Start or Join a Meeting</h2>
                    <p style={{ color: 'var(--text-secondary)' }}>Connect with anyone, anywhere with crystal-clear video calls</p>
                </div>

                <div className="action-cards">
                    <div className="action-card">
                        <h3>🎥 New Meeting</h3>
                        <p>Create an instant meeting and share the link with others.</p>
                        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                            <Plus size={18} />
                            Create Meeting
                        </button>
                    </div>
                    <div className="action-card">
                        <h3>🔗 Join Meeting</h3>
                        <p>Enter a meeting code to join an ongoing call.</p>
                        <button className="btn btn-ghost" onClick={() => setShowJoinModal(true)}>
                            <LogIn size={18} />
                            Join with Code
                        </button>
                    </div>
                </div>

                {/* ── RECENT MEETINGS ── */}
                {meetings.length > 0 && (
                    <div className="meetings-section">
                        <h3>Your Meetings</h3>
                        {meetings.map((m) => (
                            <div key={m.id} className="meeting-item">
                                <div>
                                    <div className="title">{m.title}</div>
                                    <div className="code">{m.meetingCode}</div>
                                </div>
                                <div className="flex gap-2">
                                    <button className="btn btn-ghost" style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }} onClick={() => copyLink(m.meetingCode)}>
                                        {copied === m.meetingCode ? <Check size={14} /> : <Copy size={14} />}
                                    </button>
                                    <button className="btn btn-primary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }} onClick={() => navigate(`/meeting/${m.meetingCode}`)}>
                                        Rejoin
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ── CREATE MODAL ── */}
            {showCreateModal && (
                <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <h3>Create a New Meeting</h3>
                        <p>Give your meeting a title to get started.</p>
                        {error && <div className="alert-error">{error}</div>}
                        <form onSubmit={handleCreate}>
                            <div className="form-group">
                                <label>Meeting Title</label>
                                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Weekly Standup" required />
                            </div>
                            <div className="flex gap-2" style={{ marginTop: '0.5rem' }}>
                                <button type="button" className="btn btn-ghost" onClick={() => setShowCreateModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary w-full" disabled={loading}>
                                    {loading ? 'Creating...' : 'Create & Join'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── JOIN MODAL ── */}
            {showJoinModal && (
                <div className="modal-overlay" onClick={() => setShowJoinModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <h3>Join a Meeting</h3>
                        <p>Enter the meeting code shared with you.</p>
                        <form onSubmit={handleJoin}>
                            <div className="form-group">
                                <label>Meeting Code</label>
                                <input value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder="e.g. AB12CD34" required />
                            </div>
                            <div className="flex gap-2" style={{ marginTop: '0.5rem' }}>
                                <button type="button" className="btn btn-ghost" onClick={() => setShowJoinModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary w-full">Join</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
