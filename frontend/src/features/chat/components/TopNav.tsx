import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, LogOut, Search, HelpCircle, Settings2, UserCircle2 } from 'lucide-react';
import { useAppSelector } from '../../../redux/store';
import { NotificationBell } from './NotificationBell';
import { UserProfileModal } from './UserProfileModal';
import { useAuth } from '../../../contexts/AuthContext';

export const TopNav = () => {
  const currentUser = useAppSelector(state => state.auth.userProfile);
  const { logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  return (
    <>
    <nav className="h-[52px] glass-morphism border-b border-[var(--border-subtle)] flex items-center justify-between px-4 z-40">
      <div className="flex items-center gap-3 flex-1">
        {/* Navigation Buttons (Browser-like) */}
        <div className="flex gap-1.5">
          <button className="chat-icon-button p-1 rounded-md">
            <HelpCircle className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Global Search */}
        <div className="max-w-[500px] w-full relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
          <input 
            type="text" 
            placeholder="Search Meetify Workspace..."
            className="w-full bg-white/5 border border-[var(--border-subtle)] rounded-lg py-1 pl-9 pr-3 text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] transition-all hover:bg-white/10"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-0.5 border-r border-[var(--border-subtle)] pr-2 mr-1">
          <NotificationBell />
        </div>

        {/* User Profile */}
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setIsMenuOpen((value) => !value)}
            className="flex items-center gap-2 pl-2 hover:bg-white/5 py-0.5 px-1.5 rounded-lg cursor-pointer transition-colors group"
          >
            <div className="relative">
              {currentUser?.avatarUrl ? (
                <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-7 h-7 rounded-lg object-cover border border-white/10" />
              ) : (
                <div className="w-7 h-7 rounded-lg premium-gradient flex items-center justify-center text-white font-bold text-[11px]">
                  {(currentUser?.fullName || currentUser?.name)?.charAt(0).toUpperCase() || 'U'}
                </div>
              )}
              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-500 border-2 border-[var(--bg-base)] rounded-full" />
            </div>
            <div className="hidden lg:block text-left">
              <p className="text-[13px] font-semibold leading-tight text-[var(--text-primary)]">{currentUser?.fullName || currentUser?.name || 'User'}</p>
              <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Active</p>
            </div>
            <ChevronDown className="hidden lg:block w-3 h-3 text-[var(--text-muted)]" />
          </button>

          {isMenuOpen ? (
            <div className="absolute right-0 top-[calc(100%+10px)] z-[90] w-[320px] overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-2xl glass-morphism">
              <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] px-4 py-4">
                {currentUser?.avatarUrl ? (
                  <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-12 h-12 rounded-xl object-cover border border-white/10" />
                ) : (
                  <div className="w-12 h-12 rounded-xl premium-gradient flex items-center justify-center text-white text-lg font-black">
                    {(currentUser?.fullName || currentUser?.name)?.charAt(0).toUpperCase() || 'U'}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-[var(--text-primary)]">{currentUser?.fullName || currentUser?.name || 'User'}</p>
                  <p className="truncate text-xs text-[var(--text-secondary)]">{currentUser?.designation || currentUser?.title || 'Profile details'}</p>
                </div>
              </div>

              <div className="p-2">
                <TopNavMenuAction
                  icon={<UserCircle2 className="w-4 h-4" />}
                  label="Profile"
                  onClick={() => {
                    setIsProfileOpen(true);
                    setIsMenuOpen(false);
                  }}
                />
                <TopNavMenuAction
                  icon={<Settings2 className="w-4 h-4" />}
                  label="Account settings"
                  onClick={() => {
                    setIsProfileOpen(true);
                    setIsMenuOpen(false);
                  }}
                />
                <TopNavMenuAction
                  icon={<LogOut className="w-4 h-4" />}
                  label="Sign out"
                  onClick={() => {
                    setIsMenuOpen(false);
                    logout();
                  }}
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </nav>
    <UserProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
    </>
  );
};

function TopNavMenuAction({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-soft-hover)] transition-colors"
    >
      <span className="text-[var(--text-secondary)]">{icon}</span>
      <span>{label}</span>
    </button>
  );
}
