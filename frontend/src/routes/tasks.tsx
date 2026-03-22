import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
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
import { Plus, GripVertical, X, Sparkles } from 'lucide-react';
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setSelectedTask(null);
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

  const tasksByColumn = COLUMNS.reduce((acc, col) => {
    acc[col.id] = tasks
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

        <main className="flex-1 overflow-hidden page-padding">
          <DndContext
            sensors={sensors}
            collisionDetection={rectIntersection}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="h-full grid grid-cols-4 gap-4">
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
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `column-${column.id}` });

  return (
    <div className="flex flex-col h-full" ref={setNodeRef}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-text-primary">{column.label}</h3>
        <span className="text-xs text-text-muted bg-bg-elevated px-2 py-1 rounded-full">
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
}

function TaskCard({ task, isDragging, onClick }: TaskCardProps) {
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
    opacity: isSortableDragging ? 0.5 : 1,
  };

  const tags = task.tags ? JSON.parse(task.tags) : [];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'bg-bg-surface border border-border-default rounded-xl p-4 group hover:border-border-hover transition-colors',
        isDragging && 'shadow-lg'
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
          style={{ backgroundColor: PRIORITY_COLORS[task.priority] }}
        />
        <div className="flex-1 min-w-0" onClick={onClick}>
          <p className="text-sm font-semibold text-text-primary cursor-pointer">
            {task.title}
          </p>
        </div>
        <button
          {...attributes}
          {...listeners}
          className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing text-text-muted hover:text-text-secondary"
        >
          <GripVertical size={16} />
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2 flex-wrap">
        {tags.map((tag: string, i: number) => (
          <span
            key={i}
            className="text-xs bg-bg-elevated text-text-muted px-2 py-1 rounded"
          >
            {tag}
          </span>
        ))}
        {task.source === 'telegram' && (
          <span className="text-xs bg-accent-primary-muted text-accent-primary px-2 py-1 rounded flex items-center gap-1">
            <Sparkles size={10} />
            AI
          </span>
        )}
      </div>
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
  });

  const handleSave = () => {
    onUpdate({
      ...formData,
      tags: JSON.stringify(
        formData.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      ),
    });
  };

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/50 z-50"
      />

      {/* Panel */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed right-0 top-0 h-screen w-[480px] bg-bg-surface border-l border-border-default shadow-2xl z-50 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border-subtle">
          <h2 className="text-lg font-semibold text-text-primary">Task Details</h2>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Title
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 bg-bg-elevated border border-border-default rounded-lg text-text-primary focus:outline-none focus:border-accent-primary"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 bg-bg-elevated border border-border-default rounded-lg text-text-primary focus:outline-none focus:border-accent-primary resize-none"
            />
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Priority
            </label>
            <select
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value as Task['priority'] })}
              className="w-full px-3 py-2 bg-bg-elevated border border-border-default rounded-lg text-text-primary focus:outline-none focus:border-accent-primary"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as Task['status'] })}
              className="w-full px-3 py-2 bg-bg-elevated border border-border-default rounded-lg text-text-primary focus:outline-none focus:border-accent-primary"
            >
              <option value="backlog">Backlog</option>
              <option value="today">Today</option>
              <option value="in_progress">In Progress</option>
              <option value="done">Done</option>
            </select>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              placeholder="work, urgent, bug"
              className="w-full px-3 py-2 bg-bg-elevated border border-border-default rounded-lg text-text-primary focus:outline-none focus:border-accent-primary"
            />
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Due Date
            </label>
            <input
              type="date"
              value={formData.dueDate}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              className="w-full px-3 py-2 bg-bg-elevated border border-border-default rounded-lg text-text-primary focus:outline-none focus:border-accent-primary"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border-subtle flex items-center justify-between">
          <button
            onClick={onDelete}
            className="px-4 py-2 bg-semantic-error text-white rounded-lg hover:bg-semantic-error/90 transition-colors"
          >
            Delete
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-accent-primary text-white rounded-lg hover:bg-accent-primary-hover transition-colors"
          >
            Save Changes
          </button>
        </div>
      </motion.div>
    </>
  );
}
