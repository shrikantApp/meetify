import React, { useState, useEffect } from "react";
import { Plus, Compass, Settings } from "lucide-react";
import { motion } from "framer-motion";
import { CreateWorkspaceModal } from "./CreateWorkspaceModal";
import { PreferencesModal } from "./PreferencesModal";
import { useAppDispatch, useAppSelector } from "../../../redux/store";
import { fetchWorkspaces } from "../../../redux/workspace/workspaceThunks";
import { setActiveWorkspace } from "../../../redux/workspace/workspaceSlice";
import { Tooltip } from "../../../components/ui";

export const WorkspaceSidebar = () => {
  const [preferencesSection, setPreferencesSection] = useState<
    "appearance" | "workspace"
  >("appearance");
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const dispatch = useAppDispatch();
  const { workspaces, activeWorkspaceId } = useAppSelector(
    (state) => state.workspace,
  );

  useEffect(() => {
    dispatch(fetchWorkspaces());
  }, [dispatch]);
  return (
    <div className="w-[var(--workspace-sidebar-width)] flex-shrink-0 h-full bg-[var(--bg-workspace)] border-r border-white/10 flex flex-col items-center py-4 z-50 shadow-2xl relative overflow-visible">
      <div className="flex-1 flex flex-col items-center gap-4 overflow-y-auto custom-scrollbar w-full px-2">
        {/* All Workspaces */}
        {workspaces.map((workspace) => (
          <WorkspaceIcon
            key={workspace?.id}
            label={workspace?.name}
            avatarUrl={workspace?.avatarUrl}
            initials={workspace?.name.charAt(0).toUpperCase()}
            active={activeWorkspaceId === workspace?.id}
            onClick={() => dispatch(setActiveWorkspace(workspace?.id))}
          />
        ))}

        {workspaces.length > 0 && (
          <div className="w-8 h-[2px] bg-white/10 rounded-full flex-shrink-0" />
        )}
      </div>

      <div className="mt-auto flex flex-col items-center gap-4 pt-4 border-t border-white/10 w-full px-2">
        <WorkspaceIcon
          icon={<Plus className="w-6 h-6" />}
          label="Add Workspace"
          ghost
          onClick={() => setIsCreateOpen(true)}
        />
        <WorkspaceIcon
          icon={<Compass className="w-6 h-6" />}
          label="Themes"
          ghost
          onClick={() => {
            setPreferencesSection("appearance");
            setIsPreferencesOpen(true);
          }}
        />
        <div className="w-8 h-[2px] bg-[var(--border-subtle)] rounded-full mx-auto flex-shrink-0" />
        <WorkspaceIcon
          icon={<Settings className="w-6 h-6" />}
          label="Workspace Settings"
          ghost
          onClick={() => {
            setPreferencesSection("workspace");
            setIsPreferencesOpen(true);
          }}
        />
      </div>

      <PreferencesModal
        isOpen={isPreferencesOpen}
        initialSection={preferencesSection}
        onClose={() => setIsPreferencesOpen(false)}
      />
      <CreateWorkspaceModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />
    </div>
  );
};

interface WorkspaceIconProps {
  icon?: React.ReactNode;
  label: string;
  avatarUrl?: string | null;
  initials?: string;
  active?: boolean;
  color?: string;
  ghost?: boolean;
  onClick?: () => void;
}

const WorkspaceIcon = ({
  icon,
  label,
  initials,
  active,
  color,
  avatarUrl,
  ghost,
  onClick,
}: WorkspaceIconProps) => {
  return (
    <Tooltip content={label} side="right" offset={16}>
      <div
        className="relative group cursor-pointer flex items-center justify-center w-full h-10 overflow-visible"
        onClick={onClick}
      >
        {active && (
          <div className="absolute left-[-8px] top-1/2 -translate-y-1/2 w-[3px] h-8 bg-[var(--accent-primary)] rounded-r-full" />
        )}

        <motion.div
          whileHover={{ borderRadius: active ? "10px" : "14px" }}
          transition={{ duration: 0.2 }}
          className={`
            w-10 h-10 flex items-center justify-center transition-all duration-200 overflow-hidden
            ${active ? "rounded-[10px] premium-gradient text-white shadow-lg" : "rounded-[20px]"}
            ${ghost ? "bg-[var(--surface-soft)] text-[var(--slack-sidebar-text)] hover:bg-[var(--accent-primary)] hover:text-white" : ""}
            ${!active && !ghost ? (color || "bg-[var(--surface-soft)]") + " text-[var(--text-primary)] hover:bg-[var(--accent-primary)] hover:text-white" : ""}
          `}
        >
          {icon ? (
            icon
          ) : avatarUrl ? (
            <img
              src={avatarUrl}
              alt={label}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="font-bold text-base">{initials}</span>
          )}
        </motion.div>
      </div>
    </Tooltip>
  );
};
