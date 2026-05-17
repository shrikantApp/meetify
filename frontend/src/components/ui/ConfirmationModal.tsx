import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, X } from 'lucide-react';
import { ModalPortal } from './ModalPortal';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger' | 'success';
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  icon?: ReactNode;
}

const toneClasses: Record<NonNullable<ConfirmationModalProps['tone']>, string> = {
  default: 'from-[var(--accent-primary)] to-[var(--slack-accent,#007A5A)]',
  success: 'from-emerald-500 to-teal-500',
  danger: 'from-rose-500 to-red-500',
};

export function ConfirmationModal({
  isOpen,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'default',
  isLoading = false,
  onConfirm,
  onCancel,
  icon,
}: ConfirmationModalProps) {
  return (
    <ModalPortal>
      <AnimatePresence>
        {isOpen ? (
          <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onCancel}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.96 }}
              className="relative z-10 w-full max-w-md overflow-hidden rounded-[24px] border border-[var(--border-medium)] bg-[var(--bg-card)] shadow-2xl glass-morphism"
            >
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-4">
                <h2 className="text-lg font-black text-[var(--text-primary)]">Confirmation</h2>
                <button onClick={onCancel} className="preferences-icon-button">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-5 py-6">
                <div className={`mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${toneClasses[tone]} text-white shadow-xl`}>
                  {icon ?? <AlertCircle className="w-6 h-6" />}
                </div>

                <h3 className="text-xl font-black text-[var(--text-primary)]">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{description}</p>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-[var(--border-subtle)] bg-white/5 px-5 py-4">
                <button onClick={onCancel} className="preferences-secondary-button" disabled={isLoading}>
                  {cancelLabel}
                </button>
                <button onClick={onConfirm} className="preferences-primary-button min-w-[120px] justify-center" disabled={isLoading}>
                  {isLoading ? 'Please wait...' : confirmLabel}
                </button>
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </ModalPortal>
  );
}
