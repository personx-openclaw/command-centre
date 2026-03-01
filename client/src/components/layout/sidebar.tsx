import { motion } from 'framer-motion';
import { LayoutDashboard, ChevronLeft, ChevronRight } from 'lucide-react';
import { useUIStore } from '@/stores/ui';
import { Link, useLocation } from '@tanstack/react-router';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { path: '/', label: 'Kanban', icon: LayoutDashboard },
];

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const location = useLocation();

  return (
    <motion.aside
      animate={{ width: sidebarCollapsed ? 64 : 240 }}
      className="fixed left-0 top-0 h-screen border-r border-border-subtle bg-bg-surface flex flex-col"
    >
      <div className="h-16 flex items-center justify-between px-4 border-b border-border-subtle">
        {!sidebarCollapsed && (
          <h1 className="text-lg font-semibold tracking-tight">Command Centre</h1>
        )}
        <button
          onClick={toggleSidebar}
          className="p-1.5 hover:bg-bg-elevated rounded-lg transition-colors"
        >
          {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <nav className="flex-1 p-2 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-xl transition-all',
                isActive
                  ? 'bg-accent-primary-muted text-accent-primary'
                  : 'text-text-secondary hover:bg-bg-elevated hover:text-text-primary'
              )}
            >
              <Icon size={20} />
              {!sidebarCollapsed && <span className="text-sm font-medium">{item.label}</span>}
            </Link>
          );
        })}
      </nav>
    </motion.aside>
  );
}
