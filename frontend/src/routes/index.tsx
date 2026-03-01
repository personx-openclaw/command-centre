import { createFileRoute, redirect } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { Input } from '@/components/ui/input';

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    try {
      const { user } = await api.getMe();
      useAuthStore.getState().setUser(user);
    } catch {
      throw redirect({ to: '/login' });
    }
  },
  component: Dashboard,
});

const COLUMNS = [
  { id: 'backlog', title: 'Backlog' },
  { id: 'todo', title: 'To Do' },
  { id: 'in-progress', title: 'In Progress' },
  { id: 'review', title: 'Review' },
  { id: 'done', title: 'Done' },
];

function Dashboard() {
  const user = useAuthStore((state) => state.user);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [selectedColumn, setSelectedColumn] = useState('backlog');

  const { data: tasks = [], refetch } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => api.getTasks(),
  });

  const handleLogout = () => {
    api.logout();
    useAuthStore.getState().setUser(null);
    window.location.href = '/login';
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    await api.createTask({
      title: newTaskTitle,
      status: selectedColumn,
      priority: 'medium',
    });

    setNewTaskTitle('');
    refetch();
  };

  const handleDeleteTask = async (id: string) => {
    await api.deleteTask(id);
    refetch();
  };

  const getTasksByColumn = (columnId: string) => {
    return tasks.filter((task: any) => task.status === columnId);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div>
            <h1 className="text-xl font-bold">OpenClaw Command Centre</h1>
            <p className="text-sm text-muted-foreground">Welcome back, {user?.username}</p>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto p-6">
        {/* Quick Add */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Quick Add Task</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateTask} className="flex gap-2">
              <Input
                placeholder="Task title..."
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                className="flex-1"
              />
              <select
                value={selectedColumn}
                onChange={(e) => setSelectedColumn(e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {COLUMNS.map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.title}
                  </option>
                ))}
              </select>
              <Button type="submit">Add Task</Button>
            </form>
          </CardContent>
        </Card>

        {/* Kanban Board */}
        <div className="grid grid-cols-5 gap-4">
          {COLUMNS.map((column) => (
            <div key={column.id} className="flex flex-col">
              <div className="mb-3 flex items-center justify-between rounded-lg bg-card p-3">
                <h3 className="font-semibold">{column.title}</h3>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                  {getTasksByColumn(column.id).length}
                </span>
              </div>
              <div className="space-y-2">
                {getTasksByColumn(column.id).map((task: any) => (
                  <Card key={task.id} className="group">
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between">
                        <p className="text-sm font-medium">{task.title}</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                          onClick={() => handleDeleteTask(task.id)}
                        >
                          ×
                        </Button>
                      </div>
                      {task.description && (
                        <p className="mt-1 text-xs text-muted-foreground">{task.description}</p>
                      )}
                      <div className="mt-2 flex gap-1">
                        <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
                          {task.priority}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
