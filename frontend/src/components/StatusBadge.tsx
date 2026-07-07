import type { OrderStatus } from '@/types';

const CONFIG: Record<OrderStatus, { label: string; className: string }> = {
  pending:    { label: 'Pending',    className: 'bg-yellow-50 text-yellow-800 ring-yellow-200' },
  confirmed:  { label: 'Confirmed',  className: 'bg-blue-50 text-blue-800 ring-blue-200' },
  processing: { label: 'Processing', className: 'bg-purple-50 text-purple-800 ring-purple-200' },
  shipped:    { label: 'Shipped',    className: 'bg-indigo-50 text-indigo-800 ring-indigo-200' },
  delivered:  { label: 'Delivered',  className: 'bg-green-50 text-green-800 ring-green-200' },
  cancelled:  { label: 'Cancelled',  className: 'bg-red-50 text-red-800 ring-red-200' },
};

export default function StatusBadge({ status }: { status: OrderStatus }) {
  const { label, className } = CONFIG[status] ?? CONFIG.pending;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${className}`}
    >
      {label}
    </span>
  );
}
