import { Check, CheckCheck, Clock, AlertCircle } from 'lucide-react';

interface Props {
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  className?: string;
}

export function MessageStatusIcon({ status, className = '' }: Props) {
  const baseClass = `inline-flex items-center justify-center w-4 h-4 ml-1 ${className}`;

  switch (status) {
    case 'sending':
      return <Clock className={`${baseClass} text-gray-400 w-3 h-3`} />;
    case 'sent':
      return <Check className={`${baseClass} text-gray-400`} />;
    case 'delivered':
      return <CheckCheck className={`${baseClass} text-gray-400`} />;
    case 'read':
      return <CheckCheck className={`${baseClass} text-blue-500`} />;
    case 'failed':
      return <AlertCircle className={`${baseClass} text-red-500 w-3 h-3`} />;
    default:
      return null;
  }
}
