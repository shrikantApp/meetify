import { Search, HelpCircle } from 'lucide-react';
import { useAppSelector } from '../../../redux/store';
import { NotificationBell } from './NotificationBell';

export const TopNav = () => {
  const currentUser = useAppSelector(state => state.auth.userProfile);

  return (
    <nav className="h-[52px] glass-morphism border-b border-[var(--border-subtle)] flex items-center justify-between px-4 z-40">
      <div className="flex items-center gap-3 flex-1">
        {/* Navigation Buttons (Browser-like) */}
        <div className="flex gap-1.5">
          <button className="p-1 hover:bg-white/10 rounded-md transition-colors text-[var(--text-secondary)]">
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
        <div className="flex items-center gap-2 pl-2 hover:bg-white/5 py-0.5 px-1.5 rounded-lg cursor-pointer transition-colors group">
          <div className="relative">
            <div className="w-7 h-7 rounded-lg premium-gradient flex items-center justify-center text-white font-bold text-[11px]">
              {currentUser?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-500 border-2 border-[var(--bg-base)] rounded-full" />
          </div>
          <div className="hidden lg:block text-left">
            <p className="text-[13px] font-semibold leading-tight text-[var(--text-primary)]">{currentUser?.name || 'User'}</p>
            <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Active</p>
          </div>
        </div>
      </div>
    </nav>
  );
};
