import { useState, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { networkApi } from '@/lib/api-network';
import { api } from '@/lib/api';

export interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  icon?: 'user' | 'task' | 'deal';
  action: () => void;
}

export function useCommandPalette() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<CommandItem[]>([]);

  // Fetch contacts
  const { data: contactsData } = useQuery({
    queryKey: ['contacts-search', search],
    queryFn: () => networkApi.getContacts({ search }),
    enabled: search.length > 0,
  });

  // Fetch tasks
  const { data: tasksData } = useQuery({
    queryKey: ['tasks-search'],
    queryFn: () => api.getTasks(),
  });

  useEffect(() => {
    const allItems: CommandItem[] = [];

    // Add contacts
    if (contactsData?.contacts) {
      contactsData.contacts.forEach((contact) => {
        allItems.push({
          id: `contact-${contact.id}`,
          title: `${contact.firstName} ${contact.lastName}`,
          subtitle: contact.company || contact.email || undefined,
          icon: 'user',
          action: () => {
            navigate({ to: '/network' });
            // TODO: Open contact detail panel
          },
        });
      });
    }

    // Add tasks (if search matches)
    if (tasksData && search.length > 0) {
      tasksData
        .filter((task: any) =>
          task.title.toLowerCase().includes(search.toLowerCase())
        )
        .forEach((task: any) => {
          allItems.push({
            id: `task-${task.id}`,
            title: task.title,
            subtitle: `Task · ${task.status}`,
            icon: 'task',
            action: () => {
              navigate({ to: '/tasks' });
              // TODO: Open task detail
            },
          });
        });
    }

    setItems(allItems);
  }, [contactsData, tasksData, search, navigate]);

  return {
    search,
    setSearch,
    items,
  };
}
