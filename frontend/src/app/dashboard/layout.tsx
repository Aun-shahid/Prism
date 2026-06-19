'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  CircularProgress,
  Stack,
  Button,
  Menu,
  MenuItem,
  Avatar,
  useTheme,
  useMediaQuery,
  Badge,
  Popover,
  Snackbar,
  Alert
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import LogoutIcon from '@mui/icons-material/Logout';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import WorkIcon from '@mui/icons-material/Work';
import PersonIcon from '@mui/icons-material/Person';
import DescriptionIcon from '@mui/icons-material/Description';
import SearchIcon from '@mui/icons-material/Search';
import EmailIcon from '@mui/icons-material/Email';
import SettingsIcon from '@mui/icons-material/Settings';
import LanguageIcon from '@mui/icons-material/Language';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { notificationsService, Notification } from '../../services/notifications';

const drawerWidth = 240;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  // Notifications state
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [notifAnchorEl, setNotifAnchorEl] = React.useState<null | HTMLElement>(null);
  
  // Real-time toast alert
  const [toastOpen, setToastOpen] = React.useState(false);
  const [latestNotification, setLatestNotification] = React.useState<Notification | null>(null);

  const fetchNotifications = React.useCallback(async () => {
    try {
      const data = await notificationsService.listNotifications(15);
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.is_read).length);
    } catch (err) {
      console.error('Failed to fetch notifications', err);
    }
  }, []);

  React.useEffect(() => {
    if (user) {
      fetchNotifications();

      // Start SSE stream
      const unsubscribe = notificationsService.streamNotifications(
        (newNotif) => {
          setLatestNotification(newNotif);
          setToastOpen(true);
          setNotifications(prev => [newNotif, ...prev.slice(0, 14)]);
          setUnreadCount(prev => prev + 1);
        },
        (err) => {
          console.error('SSE Notification stream error', err);
        }
      );

      return () => {
        unsubscribe();
      };
    }
  }, [user, fetchNotifications]);

  const handleNotifOpen = (event: React.MouseEvent<HTMLElement>) => {
    setNotifAnchorEl(event.currentTarget);
  };

  const handleNotifClose = () => {
    setNotifAnchorEl(null);
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await notificationsService.markRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark notification read', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationsService.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
      handleNotifClose();
    } catch (err) {
      console.error('Failed to mark all notifications read', err);
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  React.useEffect(() => {
    // Redirect if not logged in
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    handleMenuClose();
    await logout();
  };

  if (loading || !user) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  const menuItems = user.role === 'super_admin' ? [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
    { text: 'Career Watchlist', icon: <LanguageIcon />, path: '/dashboard/watchlist' },
    { text: 'Manage Users', icon: <PeopleIcon />, path: '/dashboard?tab=users' },
    { text: 'Settings', icon: <SettingsIcon />, path: '/dashboard/settings' },
  ] : [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
    { text: 'Applications', icon: <WorkIcon />, path: '/dashboard/applications' },
    { text: 'My Profile', icon: <PersonIcon />, path: '/dashboard/profile' },
    { text: 'Resume Builder', icon: <DescriptionIcon />, path: '/dashboard/resume' },
    { text: 'Career Watchlist', icon: <LanguageIcon />, path: '/dashboard/watchlist' },
    { text: 'Browse Jobs', icon: <SearchIcon />, path: '/dashboard/jobs' },
    { text: 'Gmail Outreach', icon: <EmailIcon />, path: '/dashboard/gmail' },
    { text: 'Settings', icon: <SettingsIcon />, path: '/dashboard/settings' },
  ];

  const drawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Toolbar>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <Box 
            sx={{ 
              width: 28, 
              height: 28, 
              borderRadius: 0.5, 
              background: 'linear-gradient(135deg, #7c3aed 0%, #10b981 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              color: '#fff',
              fontSize: '0.9rem'
            }}
          >
            P
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: -0.5 }}>
            Prism Board
          </Typography>
        </Stack>
      </Toolbar>
      <Divider />
      <List>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton onClick={() => {
              router.push(item.path);
              if (isMobile) setMobileOpen(false);
            }}>
              <ListItemIcon sx={{ color: 'primary.main' }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      <Box sx={{ mt: 'auto', p: 2 }}>
        <Divider sx={{ mb: 2 }} />
        <Button
          fullWidth
          variant="outlined"
          color="error"
          startIcon={<LogoutIcon />}
          onClick={handleLogout}
        >
          Sign Out
        </Button>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* Header bar */}
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          bgcolor: 'rgba(9, 13, 22, 0.8)',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
        }}
        elevation={0}
      >
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          
          <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 700 }}>
            {user.role === 'super_admin' ? 'Admin Portal' : 'Personal Workspace'}
          </Typography>

          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            {/* Notification Bell */}
            <IconButton color="inherit" onClick={handleNotifOpen}>
              <Badge badgeContent={unreadCount} color="error">
                <NotificationsIcon />
              </Badge>
            </IconButton>

            <Popover
              anchorEl={notifAnchorEl}
              open={Boolean(notifAnchorEl)}
              onClose={handleNotifClose}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'right',
              }}
              transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
              slotProps={{
                paper: {
                  sx: {
                    width: 320,
                    maxHeight: 400,
                    bgcolor: '#090d16',
                    border: '1px solid rgba(255,255,255,0.08)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                  }
                }
              }}
            >
              <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Notifications</Typography>
                {unreadCount > 0 && (
                  <Button size="small" variant="text" onClick={handleMarkAllAsRead} sx={{ fontSize: '0.75rem', p: 0 }}>
                    Mark all read
                  </Button>
                )}
              </Box>
              <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />
              <List sx={{ p: 0, maxHeight: 300, overflowY: 'auto' }}>
                {notifications.length === 0 ? (
                  <Box sx={{ p: 4, textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary">No notifications yet</Typography>
                  </Box>
                ) : (
                  notifications.map((notif) => (
                    <ListItem 
                      key={notif.id} 
                      disablePadding 
                      sx={{ 
                        bgcolor: notif.is_read ? 'transparent' : 'rgba(124, 58, 237, 0.05)',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' }
                      }}
                      onClick={() => handleMarkAsRead(notif.id)}
                    >
                      <ListItemButton sx={{ flexDirection: 'column', alignItems: 'flex-start', p: 2 }}>
                        <Stack direction="row" spacing={1} sx={{ width: '100%', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: notif.is_read ? 600 : 800, color: notif.is_read ? 'text.primary' : '#a78bfa' }}>
                            {notif.title}
                          </Typography>
                          {!notif.is_read && (
                            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#7c3aed' }} />
                          )}
                        </Stack>
                        <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem', mb: 1, lineBreak: 'anywhere' }}>
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

            <Typography variant="body2" sx={{ display: { xs: 'none', sm: 'block' }, color: 'text.secondary' }}>
              Welcome, <strong>{user.name}</strong>
            </Typography>
            <IconButton onClick={handleMenuOpen} sx={{ p: 0 }}>
              <Avatar sx={{ bgcolor: 'primary.main', width: 36, height: 36 }}>
                {user.name[0].toUpperCase()}
              </Avatar>
            </IconButton>
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleMenuClose}
              sx={{ mt: 1 }}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
              <MenuItem onClick={() => { handleMenuClose(); router.push('/dashboard/settings'); }} sx={{ gap: 1 }}>
                <AccountCircleIcon fontSize="small" /> Profile Settings
              </MenuItem>
              <Divider />
              <MenuItem onClick={handleLogout} sx={{ gap: 1, color: 'error.main' }}>
                <LogoutIcon fontSize="small" /> Logout
              </MenuItem>
            </Menu>
          </Stack>
        </Toolbar>
      </AppBar>

      {/* Side drawers navigation */}
      <Box
        component="nav"
        sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
        aria-label="mailbox folders"
      >
        {/* Mobile drawer */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth, bgcolor: '#090d16' },
          }}
        >
          {drawerContent}
        </Drawer>
        
        {/* Desktop permanent drawer */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth, bgcolor: '#090d16', borderRight: '1px solid rgba(255,255,255,0.08)' },
          }}
          open
        >
          {drawerContent}
        </Drawer>
      </Box>

      {/* Content wrapper */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          bgcolor: '#090d16',
          mt: 8
        }}
      >
        {children}
      </Box>

      {/* Real-time Toast Alert */}
      <Snackbar
        open={toastOpen}
        autoHideDuration={6000}
        onClose={() => setToastOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        {latestNotification ? (
          <Alert 
            onClose={() => setToastOpen(false)} 
            severity="info" 
            sx={{ 
              width: '100%', 
              bgcolor: '#090d16', 
              color: '#fff', 
              border: '1px solid #7c3aed',
              boxShadow: '0 4px 20px rgba(124,58,237,0.3)',
              '& .MuiAlert-icon': { color: '#a78bfa' }
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{latestNotification.title}</Typography>
            <Typography variant="body2" sx={{ fontSize: '0.8rem', mt: 0.5 }}>{latestNotification.message}</Typography>
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  );
}
