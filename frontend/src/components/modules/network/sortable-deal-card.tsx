import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Deal } from '@/lib/api-network';
import { DealCard } from './deal-card';

interface SortableDealCardProps {
  deal: Deal;
  color: string;
  isClosed: boolean;
}

export function SortableDealCard({ deal, color, isClosed }: SortableDealCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: deal.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <DealCard deal={deal} color={color} isClosed={isClosed} />
    </div>
  );
}
