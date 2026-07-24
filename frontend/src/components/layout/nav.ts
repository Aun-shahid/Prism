import type { SvgIconComponent } from '@mui/icons-material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import WorkIcon from '@mui/icons-material/Work';
import PersonIcon from '@mui/icons-material/Person';
import DescriptionIcon from '@mui/icons-material/Description';
import SearchIcon from '@mui/icons-material/Search';
import EmailIcon from '@mui/icons-material/Email';
import SettingsIcon from '@mui/icons-material/Settings';
import LanguageIcon from '@mui/icons-material/Language';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

export const SIDEBAR_EXPANDED = 256;
export const SIDEBAR_RAIL = 76;
export const SIDEBAR_TRANSITION = 'width 225ms cubic-bezier(0.4, 0, 0.2, 1)';
export const SIDEBAR_STORAGE_KEY = 'prism:sidebar-collapsed';

export interface NavItem {
  text: string;
  Icon: SvgIconComponent;
  path: string;
}

export const ADMIN_NAV_ITEMS: NavItem[] = [
  { text: 'Dashboard', Icon: DashboardIcon, path: '/dashboard' },
  { text: 'Career Watchlist', Icon: LanguageIcon, path: '/dashboard/watchlist' },
  { text: 'Manage Users', Icon: PeopleIcon, path: '/dashboard?tab=users' },
  { text: 'Settings', Icon: SettingsIcon, path: '/dashboard/settings' },
];

export const USER_NAV_ITEMS: NavItem[] = [
  { text: 'Dashboard', Icon: DashboardIcon, path: '/dashboard' },
  { text: 'AI Assistant', Icon: AutoAwesomeIcon, path: '/dashboard/assistant' },
  { text: 'Applications', Icon: WorkIcon, path: '/dashboard/applications' },
  { text: 'My Profile', Icon: PersonIcon, path: '/dashboard/profile' },
  { text: 'Resume Builder', Icon: DescriptionIcon, path: '/dashboard/resume' },
  { text: 'Career Watchlist', Icon: LanguageIcon, path: '/dashboard/watchlist' },
  { text: 'Browse Jobs', Icon: SearchIcon, path: '/dashboard/jobs' },
  { text: 'Gmail Outreach', Icon: EmailIcon, path: '/dashboard/gmail' },
  { text: 'Settings', Icon: SettingsIcon, path: '/dashboard/settings' },
];

const ROUTE_TITLES: Array<[prefix: string, title: string]> = [
  ['/dashboard/assistant', 'AI Assistant'],
  ['/dashboard/applications', 'Applications'],
  ['/dashboard/profile', 'My Profile'],
  ['/dashboard/resume', 'Resume Builder'],
  ['/dashboard/watchlist', 'Career Watchlist'],
  ['/dashboard/jobs', 'Browse Jobs'],
  ['/dashboard/gmail', 'Gmail Outreach'],
  ['/dashboard/settings', 'Settings'],
  ['/dashboard', 'Dashboard'],
];

export function getRouteTitle(pathname: string): string {
  const match = ROUTE_TITLES.find(([prefix]) => pathname.startsWith(prefix));
  return match ? match[1] : 'Dashboard';
}
