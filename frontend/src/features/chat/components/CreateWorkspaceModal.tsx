import React, { useState } from 'react';
import { X, Layout, Plus, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppDispatch, useAppSelector } from '../../../redux/store';
import { createWorkspace } from '../../../redux/workspace/workspaceThunks';
import { InputField } from '../../../components/ui/InputField';
import { ModalPortal } from '../../../components/ui';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateWorkspaceModal({ isOpen, onClose }: Props) {
  const [name, setName] = useState('');
  const dispatch = useAppDispatch();
  const { loading, error } = useAppSelector(state => state.workspace);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || loading) return;

    const resultAction = await dispatch(createWorkspace(name.trim()));
    if (createWorkspace.fulfilled.match(resultAction)) {
      setName('');
      onClose();
    }
  };

  return (
    <ModalPortal>
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-[var(--bg-card)] border border-[var(--border-medium)] rounded-2xl shadow-2xl overflow-hidden glass-morphism"
          >
            <div className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)] bg-white/5">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]">
                  <Layout className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-bold text-[var(--text-primary)]">Create Workspace</h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-xl transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)] dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <InputField
                label="Workspace Name"
                type="text"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Acme Corp, Engineering, Team Alpha"
                hint="This will be the name of your new collaboration hub."
              />

              {error && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium">
                  {error}
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-3 rounded-xl font-bold text-[13px] text-[var(--text-primary)] hover:bg-black/5 dark:hover:bg-white/5 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!name.trim() || loading}
                  className={`
                    flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-[13px] transition-all
                    ${name.trim() && !loading
                      ? 'premium-gradient text-white shadow-lg shadow-[var(--accent-primary)]/20 hover:scale-[1.02] active:scale-[0.98]'
                      : 'bg-black/5 dark:bg-white/5 text-[var(--text-muted)] cursor-not-allowed'}
                  `}
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Create Workspace
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
          </div>
        )}
      </AnimatePresence>
    </ModalPortal>
  );
}
