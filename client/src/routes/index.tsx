import { createFileRoute, redirect } from '@tanstack/react-router';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { KanbanBoard } from '@/components/modules/kanban/kanban-board';
import { useUIStore } from '@/stores/ui';
import { motion } from 'framer-motion';

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

function Dashboard() {
  const { sidebarCollapsed } = useUIStore();

  return (
    <div className="flex h-screen bg-bg-base">
      <Sidebar />
      
      <motion.div
        animate={{ marginLeft: sidebarCollapsed ? 64 : 240 }}
        className="flex-1 flex flex-col"
      >
        <Header title="Kanban Board" />
        
        <main className="flex-1 overflow-auto page-padding">
          <KanbanBoard />
        </main>
      </motion.div>
    </div>
  );
}
