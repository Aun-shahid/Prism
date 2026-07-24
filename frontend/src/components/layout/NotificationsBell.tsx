'use client';

import * as React from 'react';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import Popover from '@mui/material/Popover';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import NotificationsIcon from '@mui/icons-material/Notifications';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import {
  NOTIFICATIONS_LIMIT,
  useGetNotificationsQuery,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
} from '../../store/prismApi';
import EmptyState from '../ui/EmptyState';

function formatTimeAgo(dateStr: string) {
  const date = new Date(dateStr);
  const diffMins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString();
}

export default function NotificationsBell() {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const { data: notifications = [] } = useGetNotificationsQuery(NOTIFICATIONS_LIMIT);
  const [markRead] = useMarkNotificationReadMutation();
  const [markAllRead] = useMarkAllNotificationsReadMutation();
  const [listRef] = useAutoAnimate<HTMLUListElement>();

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <>
      <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ color: 'text.secondary' }}>
        <Badge badgeContent={unreadCount} color="error">
          <NotificationsIcon fontSize="small" />
        </Badge>
      </IconButton>

      <Popover
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              width: 340,
              maxHeight: 420,
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 3,
              boxShadow: '0 12px 40px rgba(15, 23, 42, 0.14)',
            },
          },
        }}
      >
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Notifications
          </Typography>
          {unreadCount > 0 && (
            <Button size="small" variant="text" onClick={() => markAllRead()} sx={{ fontSize: '0.75rem', p: 0 }}>
              Mark all read
            </Button>
          )}
        </Box>
        <Divider />
        <List ref={listRef} sx={{ p: 0, maxHeight: 320, overflowY: 'auto' }}>
          {notifications.length === 0 ? (
            <EmptyState
              dense
              icon={<NotificationsNoneIcon />}
              title="All caught up"
              description="New job alerts and updates will appear here."
            />
          ) : (
            notifications.map((notif) => (
              <ListItem
                key={notif.id}
                disablePadding
                sx={{
                  bgcolor: notif.is_read ? 'transparent' : 'rgba(13, 148, 136, 0.06)',
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <ListItemButton
                  onClick={() => !notif.is_read && markRead(notif.id)}
                  sx={{ flexDirection: 'column', alignItems: 'flex-start', p: 2 }}
                >
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ width: '100%', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}
                  >
                    <Typography
                      variant="subtitle2"
                      sx={{
                        fontWeight: notif.is_read ? 600 : 700,
                        color: notif.is_read ? 'text.primary' : 'primary.main',
                      }}
                    >
                      {notif.title}
                    </Typography>
                    {!notif.is_read && (
                      <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: 'primary.main', flexShrink: 0 }} />
                    )}
                  </Stack>
                  <Typography
                    variant="body2"
                    sx={{ color: 'text.secondary', fontSize: '0.8rem', mb: 0.75, lineBreak: 'anywhere' }}
                  >
                    {notif.message}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                    {formatTimeAgo(notif.created_at)}
                  </Typography>
                </ListItemButton>
              </ListItem>
            ))
          )}
        </List>
      </Popover>
    </>
  );
}
