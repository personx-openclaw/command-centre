import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { useUIStore } from '@/stores/ui';
import { motion, AnimatePresence } from 'framer-motion';
import { api, type Task } from '@/lib/api';
import { generateKeyBetween } from '@/lib/fractional-index';
import {
  DndContext,
  DragOverlay,
  rectIntersection,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, GripVertical, X, Sparkles, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/tasks')({
  component: TasksPage,
});

type Column = 'backlog' | 'today' | 'in_progress' | 'done';

const COLUMNS: { id: Column; label: string }[] = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'today', label: 'Today' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'done', label: 'Done' },
];

const PRIORITY_COLORS = {
  urgent: '#EF4444',
  high: '#F59E0B',
  medium: '#6366F1',
  low: '#10B981',
};

function TasksPage() {
  const { sidebarCollapsed } = useUIStore();
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [quickAddColumn, setQuickAddColumn] = useState<Column | null>(null);
  const [quickAddValue, setQuickAddValue] = useState('');
  const [filter, setFilter] = useState<'all' | 'urgent' | 'high' | 'medium' | 'low' | 'ai'>('all');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => api.getTasks(),
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<Task>) => api.createTask(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setQuickAddColumn(null);
      setQuickAddValue('');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Task> }) =>
      api.updateTask(id, data),
    onSuccess: (_, { data }) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      if (data.status || data.title || data.description || data.priority || data.tags) {
        setSelectedTask(null);
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setSelectedTask(null);
    },
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, status, position }: { id: string; status: string; position: string }) =>
      api.moveTask(id, status, position),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const filteredTasks = tasks.filter((t) => {
    if (filter === 'all') return true;
    if (filter === 'ai') return t.source === 'telegram';
    return t.priority === filter;
  });

  const tasksByColumn = COLUMNS.reduce((acc, col) => {
    acc[col.id] = filteredTasks
      .filter((t) => t.status === col.id)
      .sort((a, b) => a.position.localeCompare(b.position));
    return acc;
  }, {} as Record<Column, Task[]>);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeTask = tasks.find((t) => t.id === active.id);
    if (!activeTask) return;

    let overColumn: Column;
    if (typeof over.id === 'string' && over.id.startsWith('column-')) {
      overColumn = over.id.replace('column-', '') as Column;
    } else {
      const overTask = tasks.find((t) => t.id === over.id);
      if (!overTask) return;
      overColumn = overTask.status as Column;
    }

    if (activeTask.status !== overColumn) {
      moveMutation.mutate({
        id: activeTask.id,
        status: overColumn,
        position: String(Date.now()),
      });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const activeTask = tasks.find((t) => t.id === active.id);
    if (!activeTask) return;

    let targetColumn: Column;
    let targetIndex: number;

    if (typeof over.id === 'string' && over.id.startsWith('column-')) {
      targetColumn = over.id.replace('column-', '') as Column;
      targetIndex = tasksByColumn[targetColumn].length;
    } else {
      const overTask = tasks.find((t) => t.id === over.id);
      if (!overTask) return;
      targetColumn = overTask.status as Column;
      targetIndex = tasksByColumn[targetColumn].findIndex((t) => t.id === over.id);
    }

    const targetTasks = tasksByColumn[targetColumn];
    let newPosition: string;
    if (targetTasks.length === 0) {
      newPosition = generateKeyBetween(null, null);
    } else if (targetIndex === 0) {
      newPosition = generateKeyBetween(null, targetTasks[0].position);
    } else if (targetIndex >= targetTasks.length) {
      newPosition = generateKeyBetween(targetTasks[targetTasks.length - 1].position, null);
    } else {
      newPosition = generateKeyBetween(
        targetTasks[targetIndex - 1].position,
        targetTasks[targetIndex].position
      );
    }

    moveMutation.mutate({
      id: activeTask.id,
      status: targetColumn,
      position: newPosition,
    });
  };

  const handleQuickAdd = (column: Column) => {
    if (!quickAddValue.trim()) return;

    const columnTasks = tasksByColumn[column];
    const position = columnTasks.length > 0
      ? generateKeyBetween(columnTasks[columnTasks.length - 1].position, null)
      : generateKeyBetween(null, null);

    createMutation.mutate({
      title: quickAddValue.trim(),
      status: column,
      priority: 'medium',
      position,
    });
  };

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;

  return (
    <div className="flex h-screen bg-bg-base">
      <Sidebar />

      <motion.div
        animate={{ marginLeft: sidebarCollapsed ? 64 : 240 }}
        className="flex-1 flex flex-col"
      >
        <Header title="Tasks" />

        <main className="flex-1 overflow-hidden flex flex-col px-8 py-6">
          {/* Filter bar */}
          <div className="flex items-center gap-2 mb-6 flex-shrink-0">
            <span className="text-xs text-[#71717A] font-medium mr-1">Filter:</span>
            {(['all', 'urgent', 'high', 'medium', 'low'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setFilter(p)}
                className={'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ' + (
                  filter === p
                    ? 'bg-[#6366F1] text-white'
                    : 'bg-[#27272A] text-[#71717A] hover:text-[#FAFAFA] hover:bg-[#3F3F46]'
                )}
              >
                {p === 'all' ? 'All' : p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
            <button
              onClick={() => setFilter('ai')}
              className={'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ' + (
                filter === 'ai'
                  ? 'bg-[#6366F1] text-white'
                  : 'bg-[#27272A] text-[#71717A] hover:text-[#FAFAFA] hover:bg-[#3F3F46]'
              )}
            >
              AI only
            </button>
            {filter !== 'all' && (
              <button
                onClick={() => setFilter('all')}
                className="ml-2 text-xs text-[#71717A] hover:text-[#FAFAFA] transition-colors"
              >
                Clear
              </button>
            )}
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={rectIntersection}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="flex-1 grid grid-cols-4 gap-4 overflow-hidden">
              {COLUMNS.map((column) => (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  tasks={tasksByColumn[column.id]}
                  isQuickAddActive={quickAddColumn === column.id}
                  quickAddValue={quickAddValue}
                  onQuickAddChange={setQuickAddValue}
                  onQuickAddSubmit={() => handleQuickAdd(column.id)}
                  onQuickAddCancel={() => {
                    setQuickAddColumn(null);
                    setQuickAddValue('');
                  }}
                  onQuickAddActivate={() => setQuickAddColumn(column.id)}
                  onTaskClick={setSelectedTask}
                  onTaskDelete={(id) => deleteMutation.mutate(id)}
                  onTaskToggleAgent={(id, enabled) => updateMutation.mutate({ id, data: { agentEnabled: enabled } })}
                />
              ))}
            </div>

            <DragOverlay>
              {activeTask ? (
                <TaskCard task={activeTask} isDragging />
              ) : null}
            </DragOverlay>
          </DndContext>
        </main>
      </motion.div>

      {/* Task Detail Slide-over */}
      <AnimatePresence>
        {selectedTask && (
          <TaskDetailPanel
            task={selectedTask}
            onClose={() => setSelectedTask(null)}
            onUpdate={(data) => updateMutation.mutate({ id: selectedTask.id, data })}
            onDelete={() => {
              if (confirm('Delete this task?')) {
                deleteMutation.mutate(selectedTask.id);
              }
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

interface KanbanColumnProps {
  column: { id: Column; label: string };
  tasks: Task[];
  isQuickAddActive: boolean;
  quickAddValue: string;
  onQuickAddChange: (value: string) => void;
  onQuickAddSubmit: () => void;
  onQuickAddCancel: () => void;
  onQuickAddActivate: () => void;
  onTaskClick: (task: Task) => void;
  onTaskDelete: (id: string) => void;
  onTaskToggleAgent: (id: string, enabled: boolean) => void;
}

function KanbanColumn({
  column,
  tasks,
  isQuickAddActive,
  quickAddValue,
  onQuickAddChange,
  onQuickAddSubmit,
  onQuickAddCancel,
  onQuickAddActivate,
  onTaskClick,
  onTaskDelete,
  onTaskToggleAgent,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `column-${column.id}` });

  return (
    <div className="flex flex-col h-full" ref={setNodeRef}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#27272A]">
        <h3 className="text-sm font-semibold text-[#FAFAFA] tracking-wide uppercase">{column.label}</h3>
        <span className="text-xs font-medium text-[#71717A] bg-[#27272A] px-2.5 py-1 rounded-full min-w-[28px] text-center">
          {tasks.length}
        </span>
      </div>

      {/* Tasks Container */}
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div
          className={cn(
            'flex-1 space-y-2 overflow-y-auto pb-2 min-h-64',
            tasks.length === 0 && !isQuickAddActive ? 'border-2 border-dashed border-border-subtle rounded-xl flex items-center justify-center' : '',
            isOver && 'bg-accent-primary-muted rounded-xl'
          )}
          id={`column-${column.id}`}
        >
          {tasks.length === 0 && !isQuickAddActive ? (
            <p className="text-sm text-text-muted">No tasks</p>
          ) : (
            tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onClick={() => onTaskClick(task)}
                onDelete={() => onTaskDelete(task.id)}
                onToggleAgent={() => onTaskToggleAgent(task.id, !task.agentEnabled)}
              />
            ))
          )}
        </div>
      </SortableContext>

      {/* Quick Add */}
      <div className="mt-2">
        {isQuickAddActive ? (
          <input
            type="text"
            autoFocus
            value={quickAddValue}
            onChange={(e) => onQuickAddChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onQuickAddSubmit();
              if (e.key === 'Escape') onQuickAddCancel();
            }}
            onBlur={onQuickAddCancel}
            placeholder="Task title..."
            className="w-full px-3 py-2 bg-bg-surface border border-border-default rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-primary"
          />
        ) : (
          <button
            onClick={onQuickAddActivate}
            className="w-full px-3 py-2 bg-bg-surface border border-border-subtle rounded-lg text-sm text-text-muted hover:text-text-secondary hover:border-border-default transition-colors flex items-center justify-center gap-2"
          >
            <Plus size={16} />
            Add task
          </button>
        )}
      </div>
    </div>
  );
}

interface TaskCardProps {
  task: Task;
  isDragging?: boolean;
  onClick?: () => void;
  onDelete?: () => void;
  onToggleAgent?: () => void;
}

function TaskCard({ task, isDragging, onClick, onDelete, onToggleAgent }: TaskCardProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0 : 1,
  };

  const tags = task.tags ? JSON.parse(task.tags) : [];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'bg-[#18181B] border border-[#3F3F46] rounded-xl p-4 group cursor-pointer transition-all hover:border-[#6366F1]/50 hover:bg-[#1e1e24] relative',
        isDragging && 'shadow-xl border-[#6366F1]/50'
      )}
    >
      <div className="flex items-start justify-between gap-2" {...attributes} {...listeners}>
        <div className="flex items-start gap-2 flex-1 min-w-0" onClick={onClick}>
          <div
            className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
            style={{ backgroundColor: PRIORITY_COLORS[task.priority] }}
          />
          <p className="text-sm font-medium text-[#FAFAFA] leading-snug">
            {task.title}
          </p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onToggleAgent?.(); }}
            className={'p-1.5 rounded transition-colors ' + (task.agentEnabled ? 'text-[#6366F1]' : 'text-[#52525B] opacity-0 group-hover:opacity-100 hover:text-[#6366F1]')}
            title={task.agentEnabled ? 'Agent mode on — click to disable' : 'Enable agent mode'}
          >
            <Zap size={14} fill={task.agentEnabled ? '#6366F1' : 'none'} />
          </button>
          {!confirmingDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmingDelete(true); }}
              className="p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity text-[#52525B] hover:text-[#EF4444]"
              title="Delete task"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {tags.length > 0 && (
        <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
          {tags.slice(0, 3).map((tag: string, i: number) => (
            <span
              key={i}
              className="text-xs bg-[#27272A] text-[#71717A] px-2 py-0.5 rounded-md"
            >
              {tag}
            </span>
          ))}
          {task.source === 'telegram' && (
            <span className="text-xs bg-[#6366F1]/15 text-[#818CF8] px-2 py-0.5 rounded-md flex items-center gap-1">
              <Sparkles size={9} />
              AI
            </span>
          )}
          {task.agentType && (
            <span className="text-xs bg-[#10B981]/15 text-[#10B981] px-2 py-0.5 rounded-md">
              auto
            </span>
          )}
        </div>
      )}
      {confirmingDelete && (
        <div className="absolute top-1 right-1 flex items-center gap-1 bg-[#18181B] border border-[#EF4444] rounded-lg px-2 py-1 z-10" onClick={(e) => e.stopPropagation()}>
          <span className="text-xs text-[#EF4444]">Delete?</span>
          <button onClick={(e) => { e.stopPropagation(); onDelete?.(); }} className="text-xs text-white bg-[#EF4444] px-1.5 py-0.5 rounded">Yes</button>
          <button onClick={(e) => { e.stopPropagation(); setConfirmingDelete(false); }} className="text-xs text-[#71717A] hover:text-[#FAFAFA]">No</button>
        </div>
      )}
    </div>
  );
}

interface TaskDetailPanelProps {
  task: Task;
  onClose: () => void;
  onUpdate: (data: Partial<Task>) => void;
  onDelete: () => void;
}

function TaskDetailPanel({ task, onClose, onUpdate, onDelete }: TaskDetailPanelProps) {
  const [formData, setFormData] = useState({
    title: task.title,
    description: task.description || '',
    priority: task.priority,
    status: task.status,
    tags: task.tags ? JSON.parse(task.tags).join(', ') : '',
    dueDate: task.dueDate || '',
    agentType: task.agentType || '',
    agentDescription: task.agentDescription || task.description || '',
  });
  const [agentEnabled, setAgentEnabled] = useState(!!task.agentEnabled || !!task.agentType);

  useEffect(() => {
    setFormData({
      title: task.title,
      description: task.description || '',
      priority: task.priority,
      status: task.status,
      tags: task.tags ? JSON.parse(task.tags).join(', ') : '',
      dueDate: task.dueDate || '',
      agentType: task.agentType || '',
      agentDescription: task.agentDescription || task.description || '',
    });
    setAgentEnabled(!!task.agentEnabled || !!task.agentType);
  }, [task.id]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSave = () => {
    onUpdate({
      title: formData.title,
      description: formData.description,
      priority: formData.priority as Task['priority'],
      status: formData.status as Task['status'],
      tags: JSON.stringify(formData.tags.split(',').map((t) => t.trim()).filter(Boolean)),
      dueDate: formData.dueDate || null,
      agentType: agentEnabled && formData.agentType ? formData.agentType as Task['agentType'] : null,
      agentDescription: agentEnabled && formData.agentDescription ? formData.agentDescription : null,
    });
    onClose();
  };

  const inputClass = "w-full px-3 py-2.5 bg-[#27272A] border border-[#3F3F46] rounded-lg text-[#FAFAFA] text-sm placeholder:text-[#52525B] focus:outline-none focus:border-[#6366F1] transition-colors";
  const labelClass = "block text-xs font-medium text-[#71717A] uppercase tracking-wider mb-1.5";

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm"
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ type: 'spring', damping: 30, stiffness: 400 }}
          className="w-full max-w-xl bg-[#18181B] border border-[#3F3F46] rounded-2xl shadow-2xl pointer-events-auto flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#27272A]">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: PRIORITY_COLORS[formData.priority as Task['priority']] || '#6366F1' }} />
              <span className="text-xs font-medium text-[#71717A] uppercase tracking-wider">{formData.priority}</span>
            </div>
            <button onClick={onClose} className="text-[#52525B] hover:text-[#FAFAFA] transition-colors p-1 rounded-lg hover:bg-[#27272A]">
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {/* Title */}
            <div>
              <label className={labelClass}>Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className={inputClass}
              />
            </div>

            {/* Description */}
            <div>
              <label className={labelClass}>Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={5}
                placeholder="What needs to be done?"
                className={inputClass + ' resize-y min-h-[120px]'}
              />
            </div>

            {/* Priority + Status row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Priority</label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value as Task['priority'] })}
                  className={inputClass}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Column</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as Task['status'] })}
                  className={inputClass}
                >
                  <option value="backlog">Backlog</option>
                  <option value="today">Today</option>
                  <option value="in_progress">In Progress</option>
                  <option value="done">Done</option>
                </select>
              </div>
            </div>

            {/* Tags + Due date row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Tags</label>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  placeholder="tag1, tag2"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Due date</label>
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>

            {/* Agent Result */}
            {task.agentResult && (
              <div className="border-t border-[#27272A] pt-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-[#71717A] uppercase tracking-wider">Agent result</p>
                  <span className="text-xs px-2 py-0.5 rounded bg-[#10B981]/15 text-[#10B981]">Complete</span>
                </div>
                <div className="bg-[#27272A] rounded-xl p-4 max-h-96 overflow-y-auto">
                  <p className="text-sm text-[#A1A1AA] whitespace-pre-wrap leading-relaxed">{task.agentResult}</p>
                </div>
              </div>
            )}

            {/* OpenClaw section */}
            <div className="border-t border-[#27272A] pt-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-medium text-[#FAFAFA]">Automate with OpenClaw</p>
                  <p className="text-xs text-[#52525B] mt-0.5">Let an agent complete this task and report back</p>
                </div>
                <button
                  onClick={() => setAgentEnabled(!agentEnabled)}
                  className={'relative inline-flex items-center w-11 h-6 rounded-full transition-colors flex-shrink-0 ' + (agentEnabled ? 'bg-[#6366F1]' : 'bg-[#3F3F46]')}
                >
                  <span className={'inline-block w-4 h-4 bg-white rounded-full shadow transition-transform ' + (agentEnabled ? 'translate-x-6' : 'translate-x-1')} />
                </button>
              </div>

              {agentEnabled && (
                <div className="space-y-3">
                  <div>
                    <label className={labelClass}>Agent type</label>
                    <select
                      value={formData.agentType}
                      onChange={(e) => setFormData({ ...formData, agentType: e.target.value })}
                      className={inputClass}
                    >
                      <option value="">Select type...</option>
                      <option value="research">Research — search and summarise a topic</option>
                      <option value="market_scan">Market scan — funding rounds and competitors</option>
                      <option value="prospect">Prospect — research a firm and draft outreach</option>
                      <option value="analysis">Analysis — analyse a document or URL</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Agent brief</label>
                    <textarea
                      value={formData.agentDescription}
                      onChange={(e) => setFormData({ ...formData, agentDescription: e.target.value })}
                      rows={5}
                      placeholder="Describe what the agent should do, what to look for, and what format to return results in..."
                      className={inputClass + ' resize-y min-h-[120px]'}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-[#27272A] flex items-center justify-between">
            <button
              onClick={() => { if (confirm('Delete this task?')) { onDelete(); onClose(); } }}
              className="text-sm text-[#EF4444] hover:text-[#EF4444]/80 transition-colors"
            >
              Delete task
            </button>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-[#A1A1AA] hover:text-[#FAFAFA] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-[#6366F1] hover:bg-[#818CF8] text-white text-sm font-medium rounded-lg transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
}
