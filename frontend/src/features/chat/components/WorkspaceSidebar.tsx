import React, { useState, useEffect } from 'react';
import { Plus, Compass, Settings } from 'lucide-react';
import { motion } from 'framer-motion';
import { ThemeSelector } from './ThemeSelector';
import { CreateWorkspaceModal } from './CreateWorkspaceModal';
import { useAppDispatch, useAppSelector } from '../../../redux/store';
import { fetchWorkspaces } from '../../../redux/workspace/workspaceThunks';
import { setActiveWorkspace } from '../../../redux/workspace/workspaceSlice';

export const WorkspaceSidebar = () => {
  const [isThemeOpen, setIsThemeOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const dispatch = useAppDispatch();
  const { workspaces, activeWorkspaceId } = useAppSelector(state => state.workspace);

  useEffect(() => {
    dispatch(fetchWorkspaces());
  }, [dispatch]);

  return (
    <div className="w-[70px] flex-shrink-0 h-full bg-[var(--bg-workspace)] border-r border-white/10 flex flex-col items-center py-4 z-50 shadow-2xl relative">
      <div className="flex-1 flex flex-col items-center gap-4 overflow-y-auto custom-scrollbar w-full">
        {/* All Workspaces */}
        {workspaces.map((workspace) => (
          <WorkspaceIcon
            key={workspace.id}
            label={workspace.name}
            initials={workspace.name.charAt(0).toUpperCase()}
            active={activeWorkspaceId === workspace.id}
            onClick={() => dispatch(setActiveWorkspace(workspace.id))}
          />
        ))}

        {workspaces.length > 0 && (
          <div className="w-8 h-[2px] bg-white/10 rounded-full flex-shrink-0" />
        )}
      </div>

      <div className="mt-auto flex flex-col items-center gap-4 pt-4 border-t border-white/10 w-full">
        <WorkspaceIcon
          icon={<Plus className="w-6 h-6" />}
          label="Add Workspace"
          ghost
          onClick={() => setIsCreateOpen(true)}
        />
        <WorkspaceIcon icon={<Compass className="w-6 h-6" />} label="Explore" ghost />
        <div className="w-8 h-[2px] bg-[var(--border-subtle)] rounded-full mx-auto flex-shrink-0" />
        <WorkspaceIcon icon={<Settings className="w-6 h-6" />} label="Settings" ghost onClick={() => setIsThemeOpen(true)} />
      </div>

      <ThemeSelector isOpen={isThemeOpen} onClose={() => setIsThemeOpen(false)} />
      <CreateWorkspaceModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
    </div>
  );
};

interface WorkspaceIconProps {
  icon?: React.ReactNode;
  label: string;
  initials?: string;
  active?: boolean;
  color?: string;
  ghost?: boolean;
  onClick?: () => void;
}

const WorkspaceIcon = ({ icon, label, initials, active, color, ghost, onClick }: WorkspaceIconProps) => {
  return (
    <div className="relative group cursor-pointer flex items-center" onClick={onClick}>
      {/* Active Indicator */}
      {active && (
        <motion.div
          layoutId="active-workspace"
          className="absolute -left-[15px] -translate-y-1/2 w-[3px] h-8 bg-white rounded-r-full"
        />
      )}

      {/* Icon Container */}
      <motion.div
        whileHover={{ borderRadius: active ? '10px' : '14px' }}
        transition={{ duration: 0.2 }}
        className={`
          w-10 h-10 flex items-center justify-center transition-all duration-200
          ${active ? 'rounded-[10px] premium-gradient text-white shadow-lg' : 'rounded-[20px]'}
          ${ghost ? 'bg-white/5 text-[var(--text-secondary)] hover:bg-[var(--accent-primary)] hover:text-white' : ''}
          ${!active && !ghost ? (color || 'bg-white/5') + ' text-[var(--text-primary)] hover:bg-[var(--accent-primary)] hover:text-white' : ''}
        `}
      >
        {icon || <span className="font-bold text-base">{initials}</span>}
      </motion.div>

      {/* Tooltip */}
      <div className="absolute left-[70px] top-1/2 -translate-y-1/2 px-3 py-1.5 bg-black text-white text-sm font-semibold rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-[100] shadow-xl">
        {label}
        <div className="absolute left-[-4px] top-1/2 -translate-y-1/2 w-0 h-0 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent border-r-[4px] border-r-black" />
      </div>
    </div>
  );
};
