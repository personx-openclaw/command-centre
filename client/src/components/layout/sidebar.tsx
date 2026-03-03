import { motion } from 'framer-motion';
import { 
  LayoutDashboard, ChevronLeft, ChevronRight, KanbanSquare, Wallet, 
  Brain, Activity, BookOpen, Users, Cpu, GitBranch, FileText, Notebook, Rss 
} from 'lucide-react';
import { useUIStore } from '@/stores/ui';
import { Link, useLocation } from '@tanstack/react-router';
import { cn } from '@/lib/utils';
import * as Tooltip from '@radix-ui/react-tooltip';

const NAV_ITEMS = [
  { path: '/overview', label: 'Overview', icon: LayoutDashboard, active: false },
  { path: '/tasks', label: 'Tasks', icon: KanbanSquare, active: true },
  { path: '/runway', label: 'Runway', icon: Wallet, active: false },
  { path: '/brain', label: 'Second Brain', icon: Brain, active: false },
  { path: '/training', label: 'Training', icon: Activity, active: false },
  { path: '/study', label: 'CFA Study', icon: BookOpen, active: false },
  { path: '/network', label: 'Network', icon: Users, active: true },
  { path: '/ai-costs', label: 'AI Costs', icon: Cpu, active: false },
  { path: '/github', label: 'GitHub', icon: GitBranch, active: false },
  { path: '/reports', label: 'Reports', icon: FileText, active: false },
  { path: '/decisions', label: 'Decisions', icon: Notebook, active: false },
  { path: '/intel', label: 'Intel Feed', icon: Rss, active: false },
];

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const location = useLocation();

  return (
    <Tooltip.Provider>
      <motion.aside
        animate={{ width: sidebarCollapsed ? 64 : 240 }}
        className="fixed left-0 top-0 h-screen border-r border-border-subtle bg-bg-surface flex flex-col z-50"
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

        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            const content = (
              <div
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-xl transition-all',
                  isActive && item.active
                    ? 'bg-accent-primary-muted text-accent-primary'
                    : item.active
                    ? 'text-text-secondary hover:bg-bg-elevated hover:text-text-primary cursor-pointer'
                    : 'text-text-muted cursor-not-allowed opacity-50'
                )}
              >
                <Icon size={20} />
                {!sidebarCollapsed && <span className="text-sm font-medium">{item.label}</span>}
              </div>
            );

            if (!item.active) {
              return (
                <Tooltip.Root key={item.path}>
                  <Tooltip.Trigger asChild>
                    <div>{content}</div>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content
                      side="right"
                      className="bg-bg-elevated border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary shadow-lg"
                    >
                      Coming Soon
                      <Tooltip.Arrow className="fill-border-default" />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              );
            }

            return (
              <Link key={item.path} to={item.path}>
                {content}
              </Link>
            );
          })}
        </nav>
      </motion.aside>
    </Tooltip.Provider>
  );
}
