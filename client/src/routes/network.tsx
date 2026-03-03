import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { ContactsTab } from '@/components/modules/network/contacts-tab';
import { useUIStore } from '@/stores/ui';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/network')({
  component: NetworkPage,
});

type Tab = 'contacts' | 'pipeline' | 'insights';

function NetworkPage() {
  const { sidebarCollapsed } = useUIStore();
  const [activeTab, setActiveTab] = useState<Tab>('contacts');

  return (
    <div className="flex h-screen bg-bg-base">
      <Sidebar />

      <motion.div
        animate={{ marginLeft: sidebarCollapsed ? 64 : 240 }}
        className="flex-1 flex flex-col"
      >
        <Header title="Network CRM" />

        <main className="flex-1 overflow-auto page-padding">
          {/* Tabs */}
          <div className="border-b border-border-subtle mb-6">
            <div className="flex gap-6">
              {(['contacts', 'pipeline', 'insights'] as Tab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    'pb-3 px-1 text-sm font-medium border-b-2 transition-colors capitalize',
                    activeTab === tab
                      ? 'border-accent-primary text-text-primary'
                      : 'border-transparent text-text-muted hover:text-text-secondary'
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Tab content */}
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'contacts' && <ContactsTab />}
            {activeTab === 'pipeline' && (
              <div className="text-center py-12 text-text-muted">
                Pipeline tab coming soon...
              </div>
            )}
            {activeTab === 'insights' && (
              <div className="text-center py-12 text-text-muted">
                Insights tab coming soon...
              </div>
            )}
          </motion.div>
        </main>
      </motion.div>
    </div>
  );
}
