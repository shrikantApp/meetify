import { X, Check, Monitor, Sun, Moon } from 'lucide-react';
import { useTheme, SLACK_THEMES } from '../../../contexts/ThemeProvider';
import { ModalPortal } from '../../../components/ui';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function ThemeSelector({ isOpen, onClose }: Props) {
  const { mode, setMode, accentColor, setAccentColor } = useTheme();

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div className="bg-[var(--slack-bg)] rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] border border-[var(--slack-border)]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--slack-border)]">
          <h2 className="text-xl font-black text-[var(--slack-text)]">Themes</h2>
          <button onClick={onClose} className="p-2 text-[var(--slack-text-muted)] hover:bg-gray-100 dark:hover:bg-white/5 rounded-md transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-8 overflow-y-auto custom-scrollbar space-y-10">
          {/* Mode Selection */}
          <section>
            <h3 className="text-[15px] font-black text-[var(--slack-text)] mb-4 uppercase tracking-wider">Appearance</h3>
            <div className="grid grid-cols-3 gap-4">
              {[
                { id: 'light', icon: Sun, label: 'Light' },
                { id: 'dark', icon: Moon, label: 'Dark' },
                { id: 'system', icon: Monitor, label: 'System' },
              ].map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  onClick={() => setMode(id as any)}
                  className={`flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all ${
                    mode === id 
                      ? 'border-[#1164A3] bg-[#1164A3]/5 shadow-sm' 
                      : 'border-[var(--slack-border)] hover:border-[#919191] bg-[var(--slack-input-bg)]'
                  }`}
                >
                  <Icon className={`w-8 h-8 ${mode === id ? 'text-[#1164A3]' : 'text-[var(--slack-text-muted)]'}`} />
                  <span className={`text-[15px] font-bold ${mode === id ? 'text-[#1164A3]' : 'text-[var(--slack-text)]'}`}>
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* Color Selection */}
          <section>
            <h3 className="text-[15px] font-black text-[var(--slack-text)] mb-4 uppercase tracking-wider">Colors</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Object.entries(SLACK_THEMES).map(([name, colors]) => (
                <button
                  key={name}
                  onClick={() => setAccentColor(colors.sidebar)}
                  className={`group relative flex flex-col gap-3 p-4 rounded-xl border-2 transition-all overflow-hidden ${
                    accentColor === colors.sidebar 
                      ? 'border-[#1164A3] bg-[#1164A3]/5 shadow-sm' 
                      : 'border-[var(--slack-border)] hover:border-[#919191] bg-[var(--slack-input-bg)]'
                  }`}
                >
                  <div className="flex gap-2 h-16 w-full">
                    <div className="flex-1 rounded-lg shadow-inner" style={{ backgroundColor: colors.sidebar }}></div>
                    <div className="w-12 rounded-lg shadow-inner" style={{ backgroundColor: colors.active }}></div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[14px] font-bold capitalize text-[var(--slack-text)]">{name}</span>
                    {accentColor === colors.sidebar && (
                      <div className="bg-[#1164A3] text-white rounded-full p-1 shadow-sm">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className="px-6 py-4 border-t border-[var(--slack-border)] bg-gray-50/50 dark:bg-white/5 flex justify-end">
          <button 
            onClick={onClose}
            className="px-8 py-2.5 text-[15px] font-black text-white bg-[#007A5A] hover:bg-[#00664b] rounded-md transition-all shadow-sm"
          >
            Done
          </button>
        </div>
        </div>
      </div>
    </ModalPortal>
  );
}
