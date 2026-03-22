import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { networkApi, Deal } from '@/lib/api-network';
import { DndContext, DragOverlay, closestCorners, DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { DealCard } from './deal-card';
import { SortableDealCard } from './sortable-deal-card';
import { generateKeyBetween } from '@/lib/fractional-index';
import { cn } from '@/lib/utils';

const COLUMNS = [
  { id: 'lead', title: 'Lead', color: 'zinc' },
  { id: 'contacted', title: 'Contacted', color: 'blue' },
  { id: 'demo', title: 'Demo', color: 'indigo' },
  { id: 'poc', title: 'PoC', color: 'violet' },
  { id: 'negotiation', title: 'Negotiation', color: 'amber' },
  { id: 'won', title: 'Won', color: 'emerald' },
  { id: 'lost', title: 'Lost', color: 'rose' },
];

export function PipelineTab() {
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['deals'],
    queryFn: () => networkApi.getDeals(),
  });

  const { data: statsData } = useQuery({
    queryKey: ['network-stats'],
    queryFn: () => networkApi.getStats(),
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, stage, position }: { id: string; stage: string; position: string }) =>
      networkApi.moveDeal(id, stage, position),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['network-stats'] });
    },
  });

  const deals = data?.deals || [];

  const getDealsByStage = (stage: string) => {
    return deals.filter((deal) => deal.stage === stage).sort((a, b) => a.position.localeCompare(b.position));
  };

  const activeDeal = activeId ? deals.find((d) => d.id === activeId) : null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeDeal = deals.find((d) => d.id === activeId);
    if (!activeDeal) return;

    // Determine target stage
    let targetStage = activeDeal.stage;
    let targetPosition = activeDeal.position;

    // Check if dropped on a stage column
    const stageMatch = COLUMNS.find((col) => overId === `stage-${col.id}`);
    if (stageMatch) {
      targetStage = stageMatch.id;
      const stageDeals = getDealsByStage(targetStage);
      targetPosition = stageDeals.length > 0 
        ? generateKeyBetween(stageDeals[stageDeals.length - 1].position, null)
        : 'a0';
    } else {
      // Dropped on another deal
      const overDeal = deals.find((d) => d.id === overId);
      if (overDeal) {
        targetStage = overDeal.stage;
        const stageDeals = getDealsByStage(targetStage);
        const overIndex = stageDeals.findIndex((d) => d.id === overId);

        if (overIndex === 0) {
          targetPosition = generateKeyBetween(null, stageDeals[0].position);
        } else if (overIndex === stageDeals.length - 1) {
          targetPosition = generateKeyBetween(stageDeals[overIndex].position, null);
        } else {
          targetPosition = generateKeyBetween(
            stageDeals[overIndex - 1].position,
            stageDeals[overIndex].position
          );
        }
      }
    }

    if (targetStage !== activeDeal.stage || targetPosition !== activeDeal.position) {
      moveMutation.mutate({ id: activeId, stage: targetStage, position: targetPosition });
    }
  };

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `£${(value / 1000000).toFixed(1)}m`;
    }
    if (value >= 1000) {
      return `£${(value / 1000).toFixed(0)}k`;
    }
    return `£${value}`;
  };

  return (
    <div className="space-y-6">
      {/* Pipeline summary */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-xl border border-border-subtle bg-bg-surface p-4">
          <div className="text-sm text-text-muted">Total Pipeline</div>
          <div className="text-2xl font-semibold mt-1">
            {formatCurrency(statsData?.pipelineValue || 0)}
          </div>
        </div>
        <div className="rounded-xl border border-border-subtle bg-bg-surface p-4">
          <div className="text-sm text-text-muted">Weighted Pipeline</div>
          <div className="text-2xl font-semibold mt-1">
            {formatCurrency(statsData?.weightedPipelineValue || 0)}
          </div>
        </div>
        <div className="rounded-xl border border-border-subtle bg-bg-surface p-4">
          <div className="text-sm text-text-muted">Active Deals</div>
          <div className="text-2xl font-semibold mt-1">{statsData?.activeDeals || 0}</div>
        </div>
        <div className="rounded-xl border border-border-subtle bg-bg-surface p-4">
          <div className="text-sm text-text-muted">Avg Deal Cycle</div>
          <div className="text-2xl font-semibold mt-1">-</div>
        </div>
      </div>

      {/* Kanban board */}
      <DndContext
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-7 gap-4">
          {COLUMNS.map((column) => {
            const stageDeals = getDealsByStage(column.id);
            const isClosed = column.id === 'won' || column.id === 'lost';

            return (
              <div key={column.id} className="flex flex-col">
                <div className="mb-3 flex items-center justify-between rounded-xl bg-bg-elevated p-3">
                  <h3 className="font-semibold text-sm">{column.title}</h3>
                  <span className="rounded-full bg-bg-surface px-2 py-0.5 text-xs font-mono">
                    {stageDeals.length}
                  </span>
                </div>

                <div
                  id={`stage-${column.id}`}
                  className={cn(
                    'flex-1 rounded-xl border-2 border-dashed transition-colors p-2 space-y-2',
                    activeId ? 'border-accent-primary/30' : 'border-transparent'
                  )}
                >
                  <SortableContext
                    items={stageDeals.map((d) => d.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <AnimatePresence mode="popLayout">
                      {stageDeals.map((deal, idx) => (
                        <motion.div
                          key={deal.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          transition={{ delay: idx * 0.03 }}
                        >
                          <SortableDealCard
                            deal={deal}
                            color={column.color}
                            isClosed={isClosed}
                          />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </SortableContext>
                </div>
              </div>
            );
          })}
        </div>

        <DragOverlay>
          {activeDeal && (
            <div className="rotate-3 shadow-2xl scale-105">
              <DealCard
                deal={activeDeal}
                color="indigo"
                isClosed={false}
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Add deal button */}
      <div className="flex justify-center">
        <Button>
          <Plus size={16} />
          New Deal
        </Button>
      </div>
    </div>
  );
}
