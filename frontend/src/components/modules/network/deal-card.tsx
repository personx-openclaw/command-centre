import { Deal } from '@/lib/api-network';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface DealCardProps {
  deal: Deal;
  color: string;
  isClosed: boolean;
}

const STAGE_COLORS: Record<string, string> = {
  lead: 'border-t-zinc-500',
  contacted: 'border-t-blue-500',
  demo: 'border-t-indigo-500',
  poc: 'border-t-violet-500',
  negotiation: 'border-t-amber-500',
  won: 'border-t-emerald-500',
  lost: 'border-t-rose-500',
  zinc: 'border-t-zinc-500',
  blue: 'border-t-blue-500',
  indigo: 'border-t-indigo-500',
  violet: 'border-t-violet-500',
  amber: 'border-t-amber-500',
  emerald: 'border-t-emerald-500',
  rose: 'border-t-rose-500',
};

export function DealCard({ deal, color, isClosed }: DealCardProps) {
  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `£${(value / 1000000).toFixed(1)}m`;
    }
    if (value >= 1000) {
      return `£${(value / 1000).toFixed(0)}k`;
    }
    return `£${value}`;
  };

  const daysSinceCreated = Math.floor(
    (Date.now() - new Date(deal.createdAt).getTime()) / (1000 * 60 * 60 * 24)
  );

  const isOverdue = deal.expectedCloseDate && new Date(deal.expectedCloseDate) < new Date();

  return (
    <div
      className={cn(
        'rounded-xl border border-border-subtle bg-bg-surface p-3 border-t-4',
        STAGE_COLORS[color],
        isClosed && 'opacity-60'
      )}
    >
      <h4 className="font-semibold text-sm text-text-primary mb-1">{deal.title}</h4>

      {deal.contact && (
        <p className="text-xs text-text-secondary mb-2">
          {deal.contact.firstName} {deal.contact.lastName}
        </p>
      )}

      <div className="space-y-1.5">
        {deal.value && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-muted">Value</span>
            <span className="font-semibold font-mono">{formatCurrency(deal.value)}</span>
          </div>
        )}

        {deal.probability !== null && deal.probability !== undefined && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-muted">Probability</span>
              <span className="font-medium">{deal.probability}%</span>
            </div>
            <div className="h-1 bg-bg-elevated rounded-full overflow-hidden">
              <div
                className="h-full bg-accent-primary rounded-full"
                style={{ width: `${deal.probability}%` }}
              />
            </div>
          </div>
        )}

        {deal.expectedCloseDate && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-muted">Close date</span>
            <span
              className={cn(
                'font-medium',
                isOverdue ? 'text-semantic-error' : 'text-text-secondary'
              )}
            >
              {new Date(deal.expectedCloseDate).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
              })}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between text-xs pt-1 border-t border-border-subtle">
          <span className="text-text-muted">In stage</span>
          <span className="text-text-secondary">
            {daysSinceCreated === 0
              ? 'Today'
              : daysSinceCreated === 1
              ? '1 day'
              : `${daysSinceCreated} days`}
          </span>
        </div>
      </div>
    </div>
  );
}
