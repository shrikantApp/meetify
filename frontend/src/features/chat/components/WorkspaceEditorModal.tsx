import { useEffect, useRef, useState } from 'react';
import { Camera, Loader2, Pencil, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppDispatch, useAppSelector } from '../../../redux/store';
import { updateWorkspaceDetails } from '../../../redux/workspace/workspaceThunks';
import { workspaceApi } from '../../../services/workspaceApi';
import { InputField, ModalPortal } from '../../../components/ui';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function WorkspaceEditorModal({ isOpen, onClose }: Props) {
  const dispatch = useAppDispatch();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { activeWorkspaceId, workspaces, loading, error } = useAppSelector((state) => state.workspace);
  const workspace = workspaces.find((item) => item.id === activeWorkspaceId);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (!workspace || !isOpen) return;
    setName(workspace.name);
    setSlug(workspace.slug);
    setAvatarUrl(workspace.avatarUrl ?? null);
  }, [isOpen, workspace]);

  if (!isOpen || !workspace) return null;

  const initials = workspace.name?.charAt(0).toUpperCase() || 'W';

  const handleUpload = async (file?: File | null) => {
    if (!file) return;
    setIsUploading(true);
    try {
      const { url, publicUrl } = await workspaceApi.getPresignedUrl(file.name, file.type);
      await workspaceApi.uploadFileToMinio(url, file);
      setAvatarUrl(publicUrl);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (!activeWorkspaceId || !name.trim() || !slug.trim()) return;
    const result = await dispatch(updateWorkspaceDetails({
      workspaceId: activeWorkspaceId,
      name: name.trim(),
      slug: slug.trim(),
      avatarUrl,
    }));
    if (updateWorkspaceDetails.fulfilled.match(result)) {
      onClose();
    }
  };

  return (
    <ModalPortal>
      <AnimatePresence>
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 16 }}
          className="relative z-10 w-full max-w-lg overflow-hidden rounded-[28px] border border-[var(--border-medium)] bg-[var(--bg-card)] glass-morphism shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-[var(--accent-primary)]/15 p-2 text-[var(--accent-primary)]">
                <Pencil className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-[var(--text-primary)]">Edit workspace</h2>
                <p className="text-xs text-[var(--text-secondary)]">Update branding and identity live for your team.</p>
              </div>
            </div>
            <button onClick={onClose} className="preferences-icon-button">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-6 px-6 py-6">
            <div className="flex items-center gap-4">
              <div className="relative">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={workspace.name} className="h-20 w-20 rounded-2xl object-cover border border-[var(--border-subtle)]" />
                ) : (
                  <div className="h-20 w-20 rounded-2xl premium-gradient flex items-center justify-center text-white text-2xl font-black shadow-xl">
                    {initials}
                  </div>
                )}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-2 -right-2 h-9 w-9 rounded-xl bg-[var(--bg-base)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-primary)] shadow-lg"
                  type="button"
                >
                  {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => handleUpload(event.target.files?.[0])}
                />
              </div>

              <div className="text-sm text-[var(--text-secondary)]">
                <p className="font-bold text-[var(--text-primary)]">Workspace image</p>
                <p className="mt-1">Upload a logo or team avatar so the workspace is easier to identify.</p>
              </div>
            </div>

            <InputField
              label="Workspace Name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Workspace name"
            />

            <InputField
              label="Workspace Slug"
              value={slug}
              onChange={(event) => setSlug(event.target.value.toLowerCase().replace(/\s+/g, '-'))}
              placeholder="workspace-slug"
              hint="Used in workspace links and internal identification."
            />

            {error ? (
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-xs text-rose-300">
                {error}
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-[var(--border-subtle)] bg-white/5 px-6 py-4">
            <button onClick={onClose} className="preferences-secondary-button">
              Cancel
            </button>
            <button onClick={handleSave} className="preferences-primary-button min-w-[140px] justify-center" disabled={loading || isUploading}>
              {loading ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </motion.div>
        </div>
      </AnimatePresence>
    </ModalPortal>
  );
}
