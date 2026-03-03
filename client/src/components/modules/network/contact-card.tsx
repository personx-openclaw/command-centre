import { motion } from 'framer-motion';
import { Contact } from '@/lib/api-network';
import { cn } from '@/lib/utils';

interface ContactCardProps {
  contact: Contact;
  onClick: () => void;
}

const WARMTH_COLORS = {
  hot: '#EF4444',
  warm: '#F59E0B',
  cold: '#3B82F6',
  dormant: '#52525B',
};

const CATEGORY_COLORS = {
  client: 'bg-emerald-500/15 text-emerald-500',
  prospect: 'bg-blue-500/15 text-blue-500',
  investor: 'bg-violet-500/15 text-violet-500',
  mentor: 'bg-amber-500/15 text-amber-500',
  accelerator: 'bg-rose-500/15 text-rose-500',
  finance: 'bg-cyan-500/15 text-cyan-500',
  personal: 'bg-zinc-500/15 text-zinc-500',
  other: 'bg-zinc-500/15 text-zinc-500',
};

export function ContactCard({ contact, onClick }: ContactCardProps) {
  const initials = `${contact.firstName[0]}${contact.lastName[0]}`;
  
  const daysSinceLastInteraction = contact.lastInteractionAt
    ? Math.floor((Date.now() - new Date(contact.lastInteractionAt).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const tags = contact.tags ? JSON.parse(contact.tags) : [];

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      onClick={onClick}
      className="rounded-xl border border-border-subtle bg-bg-surface p-4 cursor-pointer hover:border-border-default transition-colors"
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold text-sm"
          style={{ backgroundColor: contact.avatarColor || '#6366F1' }}
        >
          {initials}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-text-primary">
              {contact.firstName} {contact.lastName}
            </h3>
            {/* Warmth indicator */}
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: WARMTH_COLORS[contact.warmth] }}
            />
          </div>

          {(contact.company || contact.role) && (
            <p className="text-sm text-text-secondary mt-0.5">
              {contact.role && contact.company
                ? `${contact.role} at ${contact.company}`
                : contact.role || contact.company}
            </p>
          )}

          {/* Category badge */}
          <div className="flex items-center gap-2 mt-2">
            <span
              className={cn(
                'px-2 py-0.5 rounded-full text-xs font-medium',
                CATEGORY_COLORS[contact.category]
              )}
            >
              {contact.category}
            </span>

            {/* Days since last interaction */}
            {daysSinceLastInteraction !== null && (
              <span className="text-xs text-text-muted">
                {daysSinceLastInteraction === 0
                  ? 'Today'
                  : daysSinceLastInteraction === 1
                  ? '1 day ago'
                  : `${daysSinceLastInteraction} days ago`}
              </span>
            )}
            {daysSinceLastInteraction === null && (
              <span className="text-xs text-text-muted">No interactions</span>
            )}
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {tags.slice(0, 3).map((tag: string) => (
                <span
                  key={tag}
                  className="px-1.5 py-0.5 rounded bg-bg-elevated text-xs text-text-muted"
                >
                  {tag}
                </span>
              ))}
              {tags.length > 3 && (
                <span className="px-1.5 py-0.5 text-xs text-text-muted">
                  +{tags.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
