import { useChatSocketContext } from '../features/chat/context/ChatSocketContext';

export function useChatSocket() {
  const { emit, isConnected } = useChatSocketContext();
  return { emit, isConnected };
}
