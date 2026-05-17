import { useState, useEffect, useCallback } from 'react';

const QUEUE_KEY = 'meetify_chat_queue';

export interface QueuedMessage {
  tempId: string;
  conversationId: string;
  content?: string;
  type?: string;
  replyToId?: string;
  mentions?: string[];
  queuedAt: number;
  retryCount: number;
}

export function useMessageQueue() {
  const [queue, setQueue] = useState<QueuedMessage[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(QUEUE_KEY);
    if (stored) {
      try {
        setQueue(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse message queue', e);
      }
    }
  }, []);

  const enqueue = useCallback((msg: Omit<QueuedMessage, 'queuedAt' | 'retryCount'>) => {
    const newItem: QueuedMessage = { ...msg, queuedAt: Date.now(), retryCount: 0 };
    setQueue((prev) => {
      const next = [...prev, newItem];
      localStorage.setItem(QUEUE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const dequeue = useCallback((tempId: string) => {
    setQueue((prev) => {
      const next = prev.filter((m) => m.tempId !== tempId);
      localStorage.setItem(QUEUE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const incrementRetry = useCallback((tempId: string) => {
    setQueue((prev) => {
      const next = prev.map((m) => (m.tempId === tempId ? { ...m, retryCount: m.retryCount + 1 } : m));
      localStorage.setItem(QUEUE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
    localStorage.removeItem(QUEUE_KEY);
  }, []);

  return { queue, enqueue, dequeue, incrementRetry, clearQueue };
}
