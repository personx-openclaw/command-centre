import { useQuery } from '@tanstack/react-query';
import { networkApi } from '@/lib/api-network';
import { Button } from '@/components/ui/button';
import { Phone, Mail, Users as UsersIcon, Calendar, ArrowRightLeft, StickyNote, Globe } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const INTERACTION_ICONS = {
  meeting: UsersIcon,
  call: Phone,
  email: Mail,
  linkedin: Globe,
  event: Calendar,
  intro: ArrowRightLeft,
  note: StickyNote,
};

export function InsightsTab() {
  const { data: queueData } = useQuery({
    queryKey: ['follow-up-queue'],
    queryFn: () => networkApi.getFollowUpQueue(),
  });

  const { data: promptData } = useQuery({
    queryKey: ['daily-prompt'],
    queryFn: () => networkApi.getDailyPrompt(),
  });

  const { data: statsData } = useQuery({
    queryKey: ['network-stats'],
    queryFn: () => networkApi.getStats(),
  });

  const { data: heatmapData } = useQuery({
    queryKey: ['activity-heatmap'],
    queryFn: () => networkApi.getActivityHeatmap(),
  });

  const followUpContacts = queueData?.contacts || [];
  const warmthDist = statsData?.warmthDistribution || { hot: 0, warm: 0, cold: 0, dormant: 0 };
  const heatmap = heatmapData?.heatmap || [];

  // Group heatmap by week
  const weeks: Array<typeof heatmap> = [];
  for (let i = 0; i < heatmap.length; i += 7) {
    weeks.push(heatmap.slice(i, i + 7));
  }

  return (
    <div className="space-y-6">
      {/* Follow-up Queue - Full width */}
      <div className="rounded-xl border border-border-subtle bg-bg-surface overflow-hidden">
        <div className="p-6 border-b border-border-subtle">
          <h3 className="font-semibold text-lg">Follow-up Queue</h3>
          <p className="text-sm text-text-muted mt-1">
            Contacts with overdue or upcoming follow-ups
          </p>
        </div>

        <div className="divide-y divide-border-subtle">
          {followUpContacts.length === 0 ? (
            <div className="p-6 text-center text-text-muted">
              No follow-ups scheduled. You're all caught up!
            </div>
          ) : (
            followUpContacts.slice(0, 5).map(({ contact, lastInteraction, urgency }) => {
              const Icon = lastInteraction
                ? INTERACTION_ICONS[lastInteraction.type as keyof typeof INTERACTION_ICONS]
                : StickyNote;

              return (
                <motion.div
                  key={contact.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="p-4 hover:bg-bg-elevated transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold text-sm"
                        style={{ backgroundColor: contact.avatarColor || '#6366F1' }}
                      >
                        {contact.firstName[0]}{contact.lastName[0]}
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-sm">
                            {contact.firstName} {contact.lastName}
                          </h4>
                        </div>
                        {contact.company && (
                          <p className="text-xs text-text-muted">{contact.company}</p>
                        )}
                      </div>

                      {lastInteraction && (
                        <div className="flex items-center gap-2 text-sm text-text-secondary">
                          <Icon size={14} />
                          <span className="text-xs">
                            {lastInteraction.title}
                          </span>
                          <span className="text-xs text-text-muted">
                            {new Date(lastInteraction.date).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                            })}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'px-2 py-1 rounded text-xs font-medium',
                            urgency === 'overdue' && 'bg-semantic-error/15 text-semantic-error',
                            urgency === 'today' && 'bg-semantic-warning/15 text-semantic-warning',
                            urgency === 'upcoming' && 'bg-semantic-success/15 text-semantic-success'
                          )}
                        >
                          {contact.nextFollowUpAt &&
                            new Date(contact.nextFollowUpAt).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                            })}
                        </span>

                        <Button size="sm" variant="ghost">
                          Log Interaction
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </div>

      {/* Bottom row: Serendipity + Network Health + Activity Heatmap */}
      <div className="grid grid-cols-2 gap-6">
        {/* Serendipity Engine */}
        <div className="rounded-xl border border-border-subtle bg-bg-surface overflow-hidden">
          <div className="p-6 border-b border-border-subtle">
            <h3 className="font-semibold text-lg">Serendipity Engine</h3>
            <p className="text-sm text-text-muted mt-1">Daily suggestions to reconnect</p>
          </div>

          <div className="p-6 space-y-6">
            {/* Reconnection */}
            {promptData?.reconnection && (
              <div>
                <h4 className="text-sm font-medium text-text-secondary mb-2">
                  Daily Reconnection
                </h4>
                <div className="rounded-lg bg-bg-elevated p-4">
                  <div className="flex items-start gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold"
                      style={{
                        backgroundColor:
                          promptData.reconnection.contact.avatarColor || '#6366F1',
                      }}
                    >
                      {promptData.reconnection.contact.firstName[0]}
                      {promptData.reconnection.contact.lastName[0]}
                    </div>
                    <div className="flex-1">
                      <h5 className="font-semibold">
                        {promptData.reconnection.contact.firstName}{' '}
                        {promptData.reconnection.contact.lastName}
                      </h5>
                      <p className="text-sm text-text-muted">
                        {promptData.reconnection.contact.company}
                      </p>
                      <p className="text-xs text-text-secondary mt-2">
                        {promptData.reconnection.daysSinceLastContact} days since last contact
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button size="sm" className="flex-1">
                      Reached Out
                    </Button>
                    <Button size="sm" variant="ghost">
                      Skip
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Random Collision */}
            {promptData?.collision && (
              <div>
                <h4 className="text-sm font-medium text-text-secondary mb-2">
                  Random Collision
                </h4>
                <div className="rounded-lg bg-bg-elevated p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-xs"
                      style={{
                        backgroundColor: promptData.collision.contact1.avatarColor || '#6366F1',
                      }}
                    >
                      {promptData.collision.contact1.firstName[0]}
                      {promptData.collision.contact1.lastName[0]}
                    </div>
                    <span className="text-text-muted">+</span>
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-xs"
                      style={{
                        backgroundColor: promptData.collision.contact2.avatarColor || '#8B5CF6',
                      }}
                    >
                      {promptData.collision.contact2.firstName[0]}
                      {promptData.collision.contact2.lastName[0]}
                    </div>
                  </div>
                  <p className="text-sm">
                    <span className="font-semibold">
                      {promptData.collision.contact1.firstName}{' '}
                      {promptData.collision.contact1.lastName}
                    </span>
                    {' + '}
                    <span className="font-semibold">
                      {promptData.collision.contact2.firstName}{' '}
                      {promptData.collision.contact2.lastName}
                    </span>
                  </p>
                  {promptData.collision.sharedTags.length > 0 && (
                    <p className="text-xs text-text-muted mt-2">
                      Both tagged: {promptData.collision.sharedTags.join(', ')}
                    </p>
                  )}
                </div>
              </div>
            )}

            {!promptData?.reconnection && !promptData?.collision && (
              <div className="text-center py-6 text-text-muted">
                No suggestions today. Check back tomorrow!
              </div>
            )}
          </div>
        </div>

        {/* Network Health + Activity Heatmap */}
        <div className="space-y-6">
          {/* Network Health */}
          <div className="rounded-xl border border-border-subtle bg-bg-surface overflow-hidden">
            <div className="p-6 border-b border-border-subtle">
              <h3 className="font-semibold text-lg">Network Health</h3>
            </div>
            <div className="p-6">
              <div className="space-y-3">
                {[
                  { label: 'Hot', count: warmthDist.hot, color: '#EF4444' },
                  { label: 'Warm', count: warmthDist.warm, color: '#F59E0B' },
                  { label: 'Cold', count: warmthDist.cold, color: '#3B82F6' },
                  { label: 'Dormant', count: warmthDist.dormant, color: '#52525B' },
                ].map(({ label, count, color }) => (
                  <div key={label} className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                    <div className="flex-1 flex items-center justify-between">
                      <span className="text-sm text-text-secondary">{label}</span>
                      <span className="font-semibold font-mono">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Activity Heatmap */}
          <div className="rounded-xl border border-border-subtle bg-bg-surface overflow-hidden">
            <div className="p-6 border-b border-border-subtle">
              <h3 className="font-semibold text-lg">Activity Heatmap</h3>
              <p className="text-xs text-text-muted mt-1">Last 12 weeks</p>
            </div>
            <div className="p-6">
              <div className="flex gap-1">
                {weeks.map((week, weekIdx) => (
                  <div key={weekIdx} className="flex flex-col gap-1">
                    {week.map((day) => (
                      <div
                        key={day.date}
                        className="w-3 h-3 rounded-sm"
                        style={{
                          backgroundColor:
                            day.level === 0
                              ? '#27272A'
                              : day.level === 1
                              ? 'rgba(99, 102, 241, 0.3)'
                              : day.level === 2
                              ? 'rgba(99, 102, 241, 0.6)'
                              : 'rgba(99, 102, 241, 1)',
                        }}
                        title={`${day.date}: ${day.count} interaction${day.count !== 1 ? 's' : ''}`}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
