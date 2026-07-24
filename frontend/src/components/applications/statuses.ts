import type { ApplicationStatus } from '../../services/applications';

export const STATUSES: { value: ApplicationStatus; label: string }[] = [
  { value: 'wishlist', label: 'Wishlist' },
  { value: 'applied', label: 'Applied' },
  { value: 'interviewing', label: 'Interviewing' },
  { value: 'offered', label: 'Offered' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'withdrawn', label: 'Withdrawn' },
];

export const getStatusLabel = (status: ApplicationStatus) =>
  STATUSES.find((s) => s.value === status)?.label ?? status;
