import { useEffect, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../redux/store';
import { fetchMessages } from '../redux/chat/chatThunks';
import { selectMessages, selectMessageCursor, selectHasMoreMessages, selectIsLoadingMessages } from '../redux/chat/chatSelectors';

export function useInfiniteMessages(conversationId: string | null) {
  const dispatch = useAppDispatch();
  const messages = useAppSelector(conversationId ? selectMessages(conversationId) : () => []);
  const cursor = useAppSelector(conversationId ? selectMessageCursor(conversationId) : () => null);
  const hasMore = useAppSelector(conversationId ? selectHasMoreMessages(conversationId) : () => false);
  const isLoading = useAppSelector(conversationId ? selectIsLoadingMessages(conversationId) : () => false);

  // Initial load
  useEffect(() => {
    if (conversationId && !messages.length && !isLoading && hasMore !== false) {
      dispatch(fetchMessages({ conversationId, limit: 30 }));
    }
  }, [conversationId, messages.length, isLoading, hasMore, dispatch]);

  const loadMore = useCallback(() => {
    if (conversationId && hasMore && !isLoading && cursor) {
      dispatch(fetchMessages({ conversationId, cursor, limit: 30 }));
    }
  }, [conversationId, hasMore, isLoading, cursor, dispatch]);

  return { messages, loadMore, hasMore, isLoading };
}
