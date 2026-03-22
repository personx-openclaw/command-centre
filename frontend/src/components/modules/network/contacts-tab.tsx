import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { networkApi, Contact } from '@/lib/api-network';
import { ContactCard } from './contact-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type SortMode = 'recent' | 'attention' | 'alphabetical';

export function ContactsTab() {
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['contacts', search],
    queryFn: () => networkApi.getContacts({ search }),
  });

  const contacts = data?.contacts || [];

  // Sort contacts
  const sortedContacts = [...contacts].sort((a, b) => {
    if (sortMode === 'recent') {
      const aTime = a.lastInteractionAt ? new Date(a.lastInteractionAt).getTime() : 0;
      const bTime = b.lastInteractionAt ? new Date(b.lastInteractionAt).getTime() : 0;
      return bTime - aTime;
    }
    if (sortMode === 'attention') {
      const aTime = a.lastInteractionAt ? new Date(a.lastInteractionAt).getTime() : 0;
      const bTime = b.lastInteractionAt ? new Date(b.lastInteractionAt).getTime() : 0;
      return aTime - bTime; // Oldest first
    }
    // alphabetical
    return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <Input
              placeholder="Search contacts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-64"
            />
          </div>

          {/* Sort toggle */}
          <div className="flex gap-1 bg-bg-elevated rounded-lg p-1">
            <button
              onClick={() => setSortMode('recent')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                sortMode === 'recent'
                  ? 'bg-bg-surface text-text-primary'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              Recent
            </button>
            <button
              onClick={() => setSortMode('attention')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                sortMode === 'attention'
                  ? 'bg-bg-surface text-text-primary'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              Needs Attention
            </button>
            <button
              onClick={() => setSortMode('alphabetical')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                sortMode === 'alphabetical'
                  ? 'bg-bg-surface text-text-primary'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              A-Z
            </button>
          </div>
        </div>

        <Button>
          <Plus size={16} />
          New Contact
        </Button>
      </div>

      {/* Contact grid */}
      {isLoading ? (
        <div className="text-center py-12 text-text-muted">Loading contacts...</div>
      ) : sortedContacts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-text-secondary mb-4">
            {search
              ? 'No contacts match your search.'
              : 'Your network starts here. Add your first contact to begin tracking relationships.'}
          </p>
          {!search && (
            <Button>
              <Plus size={16} />
              Add Contact
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {sortedContacts.map((contact, idx) => (
              <motion.div
                key={contact.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: idx * 0.03 }}
              >
                <ContactCard
                  contact={contact}
                  onClick={() => setSelectedContact(contact)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
