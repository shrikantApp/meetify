import React, { useState, useRef, useEffect } from 'react';
import { 
  Plus, Smile, Send, Mic, 
  Paperclip, Bold, Italic, Link, List, ListOrdered, Code, AtSign, Underline as UnderlineIcon, Strikethrough
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import EmojiPicker, { Theme as EmojiTheme } from 'emoji-picker-react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import LinkExtension from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import './MessageInput.module.css';

interface Props {
  onSend: (content: string, attachment?: File) => void;
  onTyping?: (isTyping: boolean) => void;
  onCancel?: () => void;
  initialContent?: string;
  placeholder?: string;
  submitLabel?: string;
  disabled?: boolean;
}

export function MessageInput({ 
  onSend, 
  onTyping = () => {}, 
  onCancel,
  initialContent = '',
  placeholder = 'Write a message...',
  submitLabel = 'Send',
  disabled 
}: Props) {
  const [isTyping, setIsTyping] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<any>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
      LinkExtension.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-[var(--accent-primary)] underline',
        },
      }),
      Underline,
    ],
    content: initialContent,
    onUpdate: ({ editor }) => {
      if (!isTyping) {
        setIsTyping(true);
        onTyping(true);
      }

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        onTyping(false);
      }, 2000);
    },
    editorProps: {
      attributes: {
        class: 'focus:outline-none w-full bg-transparent text-[13px] md:text-sm p-2 min-h-[36px] max-h-[150px] overflow-y-auto leading-relaxed text-[var(--text-primary)] tiptap-editor',
      },
    },
  });

  // We need a ref for the send handler to use inside the editor's keydown handler without closure issues
  const handleSendRef = useRef<() => void>();

  useEffect(() => {
    handleSendRef.current = () => {
      if (!editor || editor.isEmpty || disabled) return;
      const html = editor.getHTML();
      onSend(html);
      editor.commands.clearContent();
      
      if (isTyping) {
        setIsTyping(false);
        onTyping(false);
      }
    };
  }, [editor, disabled, isTyping, onSend, onTyping]);

  useEffect(() => {
    if (editor && initialContent !== undefined) {
      editor.commands.setContent(initialContent);
    }
  }, [editor, initialContent]);

  useEffect(() => {
    if (editor) {
      editor.setOptions({
        editorProps: {
          attributes: {
            class: 'focus:outline-none w-full bg-transparent text-[13px] md:text-sm p-2 min-h-[36px] max-h-[150px] overflow-y-auto leading-relaxed text-[var(--text-primary)] tiptap-editor',
          },
          handleKeyDown: (view, event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              handleSendRef.current?.();
              return true;
            }
            if (event.key === 'Escape' && onCancel) {
              event.preventDefault();
              onCancel();
              return true;
            }
            return false;
          }
        }
      });
    }
  }, [editor, onCancel]);

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const onEmojiClick = (emojiData: any) => {
    editor?.commands.insertContent(emojiData.emoji);
    setShowEmojiPicker(false);
    editor?.commands.focus();
  };

  const handleLink = () => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);
    
    if (url === null) return; // cancelled
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  if (!editor) {
    return null; // Or a loading skeleton
  }

  return (
    <div className="p-2 md:p-3 bg-[var(--bg-base)] border-t border-[var(--border-subtle)]">
      <div className="w-full relative group">
        {/* Main Composer Box */}
        <div className="glass-morphism rounded-xl border border-[var(--border-medium)] transition-all duration-300 group-focus-within:border-[var(--accent-primary)] overflow-hidden">
          
          {/* Formatting Toolbar */}
          <div className="flex items-center gap-0.5 px-2 py-1 border-b border-[var(--border-subtle)] bg-white/[0.02]">
            <ToolbarButton 
              icon={<Bold className="w-3.5 h-3.5" />} 
              label="Bold" 
              active={editor.isActive('bold')}
              onClick={() => editor.chain().focus().toggleBold().run()} 
            />
            <ToolbarButton 
              icon={<Italic className="w-3.5 h-3.5" />} 
              label="Italic" 
              active={editor.isActive('italic')}
              onClick={() => editor.chain().focus().toggleItalic().run()} 
            />
            <ToolbarButton 
              icon={<Strikethrough className="w-3.5 h-3.5" />} 
              label="Strikethrough" 
              active={editor.isActive('strike')}
              onClick={() => editor.chain().focus().toggleStrike().run()} 
            />
            <ToolbarButton 
              icon={<UnderlineIcon className="w-3.5 h-3.5" />} 
              label="Underline" 
              active={editor.isActive('underline')}
              onClick={() => editor.chain().focus().toggleUnderline().run()} 
            />
            <div className="w-px h-3 bg-[var(--border-subtle)] mx-1" />
            <ToolbarButton 
              icon={<Link className="w-3.5 h-3.5" />} 
              label="Link" 
              active={editor.isActive('link')}
              onClick={handleLink} 
            />
            <div className="w-px h-3 bg-[var(--border-subtle)] mx-1" />
            <ToolbarButton 
              icon={<List className="w-3.5 h-3.5" />} 
              label="Bullet List" 
              active={editor.isActive('bulletList')}
              onClick={() => editor.chain().focus().toggleBulletList().run()} 
            />
            <ToolbarButton 
              icon={<ListOrdered className="w-3.5 h-3.5" />} 
              label="Numbered List" 
              active={editor.isActive('orderedList')}
              onClick={() => editor.chain().focus().toggleOrderedList().run()} 
            />
            <div className="w-px h-3 bg-[var(--border-subtle)] mx-1" />
            <ToolbarButton 
              icon={<Code className="w-3.5 h-3.5" />} 
              label="Code Block" 
              active={editor.isActive('codeBlock')}
              onClick={() => editor.chain().focus().toggleCodeBlock().run()} 
            />
          </div>

          {/* Text Area (TipTap) */}
          <div className="p-1 cursor-text" onClick={() => editor.commands.focus()}>
            <EditorContent editor={editor} />
          </div>

          {/* Bottom Actions */}
          <div className="flex items-center justify-between px-2 py-1.5 bg-white/[0.01]">
            <div className="flex items-center gap-0.5">
              <ActionButton icon={<Plus className="w-4 h-4" />} label="Add" />
              <div className="w-px h-3 bg-[var(--border-subtle)] mx-1" />
              <ActionButton 
                icon={<Paperclip className="w-4 h-4" />} 
                label="Attach file" 
                onClick={() => fileInputRef.current?.click()}
              />
              <div className="relative" ref={emojiPickerRef}>
                <ActionButton 
                  icon={<Smile className="w-4 h-4" />} 
                  label="Emoji" 
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                />
                <AnimatePresence>
                  {showEmojiPicker && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 10 }}
                      className="absolute bottom-full left-0 mb-3 z-50 premium-shadow rounded-xl overflow-hidden border border-[var(--border-medium)]"
                    >
                      <EmojiPicker 
                        onEmojiClick={onEmojiClick}
                        theme={EmojiTheme.DARK}
                        skinTonesDisabled
                        searchDisabled
                        height={350}
                        width={280}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <ActionButton icon={<AtSign className="w-4 h-4" />} label="Mention" />
              <ActionButton icon={<Mic className="w-4 h-4" />} label="Voice" />
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleSendRef.current?.()}
              disabled={editor.isEmpty || disabled}
              className={`
                flex items-center gap-1.5 px-4 py-1.5 rounded-lg font-bold text-[13px] transition-all duration-300
                ${!editor.isEmpty && !disabled
                  ? 'premium-gradient text-white shadow-lg shadow-[var(--accent-primary)]/25' 
                  : 'bg-white/5 text-[var(--text-muted)] cursor-not-allowed'}
              `}
            >
              <span>{submitLabel}</span>
              {submitLabel === 'Send' && (
                <Send className={`w-3.5 h-3.5 transition-transform duration-300 ${!editor.isEmpty ? 'translate-x-0.5 -translate-y-0.5' : ''}`} />
              )}
            </motion.button>
            {onCancel && (
              <button 
                onClick={onCancel}
                className="px-4 py-1.5 text-[13px] font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        {/* Hidden File Input */}
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onSend('', file);
          }}
        />

      </div>
    </div>
  );
}

const ToolbarButton = ({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void }) => (
  <button 
    onClick={onClick}
    className={`p-1.5 rounded-lg transition-colors ${
      active 
        ? 'bg-[var(--accent-primary)] text-white' 
        : 'hover:bg-white/10 text-[var(--text-muted)] hover:text-[var(--text-primary)]'
    }`} 
    title={label}
  >
    {icon}
  </button>
);

const ActionButton = ({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick?: () => void }) => (
  <button 
    onClick={onClick}
    className="p-2 hover:bg-white/10 rounded-xl transition-colors text-[var(--text-secondary)] hover:text-white" 
    title={label}
  >
    {icon}
  </button>
);
