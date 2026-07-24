import { TableSkeleton } from '../../../components/ui/Skeletons';

export default function Loading() {
  return <TableSkeleton rows={4} columns={3} />;
}
