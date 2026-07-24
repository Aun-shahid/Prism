'use client';

import { useEffect } from 'react';
import { notificationsService } from '../../services/notifications';
import { prismApi, NOTIFICATIONS_LIMIT } from '../../store/prismApi';
import { showToast } from '../../store/uiSlice';
import { useAppDispatch } from '../../store/hooks';
import { useAuth } from '../../hooks/useAuth';

/**
 * Opens the SSE notification stream while a user is signed in. Incoming
 * notifications are pushed into the RTK Query notifications cache and surfaced
 * as toasts; job alerts invalidate the affected query caches so any mounted
 * page refetches automatically (replaces the old window 'prism:jobs-updated'
 * event bus).
 */
export function useNotificationStream() {
  const { user } = useAuth();
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!user) return;

    const close = notificationsService.streamNotifications(
      (notif) => {
        dispatch(
          prismApi.util.updateQueryData(
            'getNotifications',
            NOTIFICATIONS_LIMIT,
            (draft) => {
              draft.unshift(notif);
              if (draft.length > NOTIFICATIONS_LIMIT) draft.length = NOTIFICATIONS_LIMIT;
            }
          )
        );
        dispatch(
          showToast({ title: notif.title, message: notif.message, severity: 'info' })
        );
        if (notif.type === 'job_alert') {
          dispatch(
            prismApi.util.invalidateTags([
              'ScrapedJobs',
              'ScraperTargets',
              'Applications',
              'InboundReplies',
            ])
          );
        }
      },
      (err) => console.error('Notification stream error:', err)
    );

    return close;
  }, [user, dispatch]);
}
