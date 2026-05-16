interface Props {
  typingUsers: string[];
  className?: string;
}

export function TypingIndicator({ typingUsers, className = '' }: Props) {
  if (!typingUsers.length) return null;

  return (
    <div className={`flex items-center gap-2 px-4 py-2 text-sm text-gray-500 italic ${className}`}>
      <div className="flex gap-1">
        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      {typingUsers.length === 1 ? 'Someone is typing...' : 'Several people are typing...'}
    </div>
  );
}
