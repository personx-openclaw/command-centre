import { useAuthStore } from '@/stores/auth';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { LogOut, Command } from 'lucide-react';
import { useUIStore } from '@/stores/ui';

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const { sidebarCollapsed, setCommandPaletteOpen } = useUIStore();

  const handleLogout = async () => {
    await api.logout();
    setUser(null);
    window.location.href = '/login';
  };

  return (
    <header className="h-16 border-b border-border-subtle bg-bg-surface flex items-center justify-between px-8">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-text-muted hover:text-text-primary bg-bg-elevated rounded-lg border border-border-default transition-colors"
        >
          <Command size={14} />
          <span>Search</span>
          <kbd className="hidden sm:inline-flex h-5 px-1.5 bg-bg-base rounded text-xs font-mono">
            ⌘K
          </kbd>
        </button>

        <div className="flex items-center gap-3">
          <span className="text-sm text-text-secondary">{user?.username}</span>
          <Button variant="ghost" size="icon" onClick={handleLogout}>
            <LogOut size={18} />
          </Button>
        </div>
      </div>
    </header>
  );
}
