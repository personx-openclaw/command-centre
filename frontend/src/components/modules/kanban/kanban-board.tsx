import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const COLUMNS = [
  { id: 'backlog', title: 'Backlog', color: 'kanban-backlog' },
  { id: 'today', title: 'Today', color: 'kanban-today' },
  { id: 'in_progress', title: 'In Progress', color: 'kanban-in-progress' },
  { id: 'done', title: 'Done', color: 'kanban-done' },
];

const PRIORITY_COLORS = {
  urgent: 'semantic-error',
  high: 'semantic-warning',
  medium: 'semantic-info',
  low: 'text-muted',
};

export function KanbanBoard() {
  const queryClient = useQueryClient();
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [selectedColumn, setSelectedColumn] = useState('backlog');

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => api.getTasks(),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.createTask(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task created');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.updateTask(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task deleted');
    },
  });

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    createMutation.mutate({
      title: newTaskTitle,
      status: selectedColumn,
      priority: 'medium',
      source: 'manual',
    });

    setNewTaskTitle('');
  };

  const getTasksByColumn = (columnId: string) => {
    return tasks.filter((task: any) => task.status === columnId);
  };

  return (
    <div className="space-y-6">
      {/* Quick Add */}
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleCreateTask} className="flex gap-3">
            <Input
              placeholder="Add a task..."
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              className="flex-1"
            />
            <select
              value={selectedColumn}
              onChange={(e) => setSelectedColumn(e.target.value)}
              className="px-3 py-2 rounded-xl border border-border-default bg-bg-surface text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary"
            >
              {COLUMNS.map((col) => (
                <option key={col.id} value={col.id}>
                  {col.title}
                </option>
              ))}
            </select>
            <Button type="submit" disabled={createMutation.isPending}>
              <Plus size={16} />
              Add
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Kanban Board */}
      <div className="grid grid-cols-4 gap-4">
        {COLUMNS.map((column) => (
          <div key={column.id} className="flex flex-col">
            <div className="mb-3 flex items-center justify-between rounded-xl bg-bg-elevated card-padding">
              <h3 className="font-semibold text-sm">{column.title}</h3>
              <span className="rounded-full bg-bg-surface px-2 py-0.5 text-xs font-mono">
                {getTasksByColumn(column.id).length}
              </span>
            </div>

            <div className="space-y-2">
              <AnimatePresence>
                {getTasksByColumn(column.id).map((task: any, idx: number) => (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ delay: idx * 0.05 }}
                    whileHover={{ scale: 1.01 }}
                  >
                    <Card className="group cursor-pointer">
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-text-primary">{task.title}</p>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => deleteMutation.mutate(task.id)}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                        {task.description && (
                          <p className="mt-1 text-xs text-text-muted">{task.description}</p>
                        )}
                        <div className="mt-2 flex gap-1.5">
                          <span
                            className={`text-${PRIORITY_COLORS[task.priority as keyof typeof PRIORITY_COLORS]} rounded bg-bg-elevated px-1.5 py-0.5 text-xs font-medium`}
                          >
                            {task.priority}
                          </span>
                          {task.source !== 'manual' && (
                            <span className="rounded bg-bg-elevated px-1.5 py-0.5 text-xs text-text-muted">
                              {task.source}
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
