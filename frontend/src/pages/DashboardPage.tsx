import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import {
  Video,
  Plus,
  Copy,
  Check,
  LogOut,
  MessageSquare,
  ArrowRight,
  Clock,
  ChevronRight,
  LayoutDashboard,
  Zap,
  Globe
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar } from '../components/ui/Avatar';
import styles from './DashboardPage.module.css';

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
  const [lobbyEnabled, setLobbyEnabled] = useState(true);
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
      const meeting = await api.meetings.create({ title, lobbyEnabled });
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
    <div className={styles.container}>
      {/* Premium Background */}
      <div className={styles.bgGlow} />
      
      {/* Navigation */}
      <nav className={styles.navbar}>
        <div className={styles.navLeft}>
          <div className={styles.logo}>
            <div className={styles.logoIcon}>
              <Video size={18} />
            </div>
            <span>Meetify</span>
          </div>
          <div className={styles.navDivider} />
          <div className={styles.navLinks}>
            <button className={styles.navLinkActive}>
               <LayoutDashboard size={14} />
               Dashboard
            </button>
            <button className={styles.navLink} onClick={() => navigate('/chat')}>
               <MessageSquare size={14} />
               Messages
            </button>
          </div>
        </div>
        
        <div className={styles.navRight}>
          <div className={styles.userProfile}>
            <Avatar name={user?.name} size="sm" status="online" />
            <div className={styles.userInfo}>
              <span className={styles.userName}>{user?.name}</span>
              <span className={styles.userStatus}>Active Now</span>
            </div>
          </div>

          <button className={styles.logoutBtn} onClick={logout} title="Sign Out">
            <LogOut size={16} />
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className={styles.mainContent}>
        <section className={styles.hero}>
          <motion.div 
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ duration: 0.5 }}
          >
            <div className={styles.badge}>
               <Zap size={10} className="text-yellow-500 mr-1.5" />
               Version 2.0 is live
            </div>
            <h1>Collaborate without boundaries.</h1>
            <p>
              The unified workspace for your team. Start instant meetings, 
              chat with colleagues, and keep your projects moving forward.
            </p>
          </motion.div>
        </section>

        {/* Action Cards */}
        <div className={styles.cardsGrid}>
          <motion.div 
            whileHover={{ y: -5 }}
            className={styles.actionCard}
            onClick={() => setShowCreateModal(true)}
          >
            <div className={styles.actionIconWrapper} style={{ '--bg': 'rgba(99, 102, 241, 0.1)', '--color': '#6366f1' } as any}>
              <Plus size={24} />
            </div>
            <div className={styles.actionText}>
              <h3>New Meeting</h3>
              <p>Create a secure room in seconds</p>
            </div>
            <div className={styles.actionArrow}>
               <ChevronRight size={18} />
            </div>
          </motion.div>

          <motion.div 
            whileHover={{ y: -5 }}
            className={styles.actionCard}
            onClick={() => setShowJoinModal(true)}
          >
            <div className={styles.actionIconWrapper} style={{ '--bg': 'rgba(168, 85, 247, 0.1)', '--color': '#a855f7' } as any}>
              <Globe size={24} />
            </div>
            <div className={styles.actionText}>
              <h3>Join Meeting</h3>
              <p>Enter a code to join your team</p>
            </div>
            <div className={styles.actionArrow}>
               <ChevronRight size={18} />
            </div>
          </motion.div>
        </div>

        {/* Recent Meetings */}
        <section className={styles.meetingsSection}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitleWrapper}>
               <Clock size={16} className="text-[var(--text-muted)]" />
               <h3 className={styles.sectionTitle}>Recent Sessions</h3>
            </div>
            <button className={styles.viewAllBtn}>View History</button>
          </div>
          
          <div className={styles.meetingList}>
            {meetings.length > 0 ? (
              meetings.map((m, i) => (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  key={m.id} 
                  className={styles.meetingItem}
                >
                  <div className={styles.meetingInfo}>
                    <div className={styles.meetingIcon}>
                       <Video size={14} />
                    </div>
                    <div>
                      <h4>{m.title}</h4>
                      <div className={styles.meetingMeta}>
                        <span className={styles.meetingCode}>{m.meetingCode}</span>
                        <div className={styles.dot} />
                        <span>{new Date(m.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className={styles.meetingActions}>
                    <button 
                      className={styles.iconBtn}
                      onClick={() => copyLink(m.meetingCode)}
                      title="Copy Invite Link"
                    >
                      {copied === m.meetingCode ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                    </button>
                    <button 
                      className={styles.rejoinBtn}
                      onClick={() => navigate(`/meeting/${m.meetingCode}`)}
                    >
                      <span>Join Now</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className={styles.emptyState}>
                 <div className={styles.emptyIcon}>
                    <Video size={32} opacity={0.2} />
                 </div>
                 <p>No recent meetings found. Start one to see it here.</p>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {showCreateModal && (
          <div className={styles.modalOverlay} onClick={() => setShowCreateModal(false)}>
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className={styles.modal} 
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.modalHeader}>
                 <h2>Create Workspace</h2>
                 <p>Set up your meeting space in seconds.</p>
              </div>
              
              {error && <div className={styles.modalError}>{error}</div>}
              
              <form onSubmit={handleCreate} className="space-y-6">
                <div className={styles.formGroup}>
                  <label>Meeting Title</label>
                  <input 
                    value={title} 
                    onChange={(e) => setTitle(e.target.value)} 
                    placeholder="e.g. Weekly Design Sync" 
                    required 
                    className={styles.input}
                    autoFocus
                  />
                </div>
                
                <div className={styles.checkboxLabel} onClick={() => setLobbyEnabled(!lobbyEnabled)}>
                  <div className={`${styles.checkbox} ${lobbyEnabled ? styles.checked : ''}`}>
                     {lobbyEnabled && <Check size={12} />}
                  </div>
                  <div className={styles.checkboxText}>
                    <h4>Enable Waiting Room</h4>
                    <p>Admit participants manually for extra security.</p>
                  </div>
                </div>

                <div className={styles.modalFooter}>
                  <button 
                    type="button" 
                    onClick={() => setShowCreateModal(false)}
                    className={styles.cancelBtn}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={loading}
                    className={styles.submitBtn}
                  >
                    {loading ? 'Creating...' : 'Start Session'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {showJoinModal && (
          <div className={styles.modalOverlay} onClick={() => setShowJoinModal(false)}>
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className={styles.modal} 
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.modalHeader}>
                 <h2>Join Session</h2>
                 <p>Enter the code shared with you to join.</p>
              </div>
              
              <form onSubmit={handleJoin} className="space-y-6">
                <div className={styles.formGroup}>
                  <label>Meeting Code</label>
                  <input 
                    value={joinCode} 
                    onChange={(e) => setJoinCode(e.target.value)} 
                    placeholder="e.g. AB12CD34" 
                    required 
                    className={styles.input}
                    autoFocus
                  />
                </div>

                <div className={styles.modalFooter}>
                  <button 
                    type="button" 
                    onClick={() => setShowJoinModal(false)}
                    className={styles.cancelBtn}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className={styles.submitBtn}
                  >
                    Join Now
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
