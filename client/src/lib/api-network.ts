const API_URL = import.meta.env.VITE_API_URL || '/api';

interface Contact {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  company?: string;
  role?: string;
  category: 'client' | 'prospect' | 'investor' | 'mentor' | 'accelerator' | 'finance' | 'personal' | 'other';
  tags?: string;
  linkedinUrl?: string;
  notes?: string;
  warmth: 'hot' | 'warm' | 'cold' | 'dormant';
  lastInteractionAt?: string;
  nextFollowUpAt?: string;
  avatarColor?: string;
  createdAt: string;
  updatedAt: string;
}

interface Interaction {
  id: string;
  contactId: string;
  type: 'meeting' | 'call' | 'email' | 'linkedin' | 'event' | 'intro' | 'note';
  title: string;
  description?: string;
  date: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  followUpRequired: boolean;
  createdAt: string;
}

interface Deal {
  id: string;
  userId: string;
  contactId: string;
  title: string;
  value?: number;
  currency: string;
  stage: 'lead' | 'contacted' | 'demo' | 'poc' | 'negotiation' | 'won' | 'lost';
  probability?: number;
  notes?: string;
  expectedCloseDate?: string;
  closedAt?: string;
  position: string;
  createdAt: string;
  updatedAt: string;
  contact?: Contact;
}

class NetworkApiClient {
  private getToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || 'Request failed');
    }

    return response.json();
  }

  // Contacts
  async getContacts(params?: {
    search?: string;
    category?: string;
    warmth?: string;
    tag?: string;
  }) {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.category) query.set('category', params.category);
    if (params?.warmth) query.set('warmth', params.warmth);
    if (params?.tag) query.set('tag', params.tag);

    const queryString = query.toString();
    return this.request<{
      contacts: Contact[];
      total: number;
      filters: {
        categories: string[];
        tags: string[];
        warmthLevels: string[];
      };
    }>(`/contacts${queryString ? `?${queryString}` : ''}`);
  }

  async getContact(id: string) {
    return this.request<{
      contact: Contact;
      recentInteractions: Interaction[];
      deals: Deal[];
      interactionCount: number;
      daysSinceLastInteraction: number | null;
    }>(`/contacts/${id}`);
  }

  async createContact(data: Partial<Contact>) {
    return this.request<Contact>('/contacts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateContact(id: string, data: Partial<Contact>) {
    return this.request<Contact>(`/contacts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteContact(id: string) {
    return this.request<{ success: boolean }>(`/contacts/${id}`, {
      method: 'DELETE',
    });
  }

  // Interactions
  async getInteractions(contactId: string, params?: { limit?: number; offset?: number }) {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.offset) query.set('offset', params.offset.toString());

    const queryString = query.toString();
    return this.request<{
      interactions: Interaction[];
      total: number;
      limit: number;
      offset: number;
    }>(`/contacts/${contactId}/interactions${queryString ? `?${queryString}` : ''}`);
  }

  async createInteraction(contactId: string, data: Partial<Interaction>) {
    return this.request<Interaction>(`/contacts/${contactId}/interactions`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateInteraction(id: string, data: Partial<Interaction>) {
    return this.request<Interaction>(`/interactions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteInteraction(id: string) {
    return this.request<{ success: boolean }>(`/interactions/${id}`, {
      method: 'DELETE',
    });
  }

  // Deals
  async getDeals(params?: { stage?: string }) {
    const query = new URLSearchParams();
    if (params?.stage) query.set('stage', params.stage);

    const queryString = query.toString();
    return this.request<{ deals: Deal[] }>(`/deals${queryString ? `?${queryString}` : ''}`);
  }

  async createDeal(data: Partial<Deal>) {
    return this.request<Deal>('/deals', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateDeal(id: string, data: Partial<Deal>) {
    return this.request<Deal>(`/deals/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async moveDeal(id: string, stage: string, position: string) {
    return this.request<Deal>(`/deals/${id}/move`, {
      method: 'PATCH',
      body: JSON.stringify({ stage, position }),
    });
  }

  async deleteDeal(id: string) {
    return this.request<{ success: boolean }>(`/deals/${id}`, {
      method: 'DELETE',
    });
  }

  // Network stats
  async getStats() {
    return this.request<{
      totalContacts: number;
      interactionsThisWeek: number;
      overdueFollowUps: number;
      pipelineValue: number;
      weightedPipelineValue: number;
      activeDeals: number;
      warmthDistribution: {
        hot: number;
        warm: number;
        cold: number;
        dormant: number;
      };
    }>('/network/stats');
  }

  async getDailyPrompt() {
    return this.request<{
      date: string;
      reconnection: {
        contact: Contact;
        daysSinceLastContact: number | null;
      } | null;
      collision: {
        contact1: Contact;
        contact2: Contact;
        sharedTags: string[];
      } | null;
    }>('/network/daily-prompt');
  }

  async dismissDailyPrompt() {
    return this.request<{ success: boolean }>('/network/daily-prompt/dismiss', {
      method: 'POST',
    });
  }

  async getFollowUpQueue() {
    return this.request<{
      contacts: Array<{
        contact: Contact;
        lastInteraction: Interaction | null;
        urgency: 'overdue' | 'today' | 'upcoming';
      }>;
    }>('/network/follow-up-queue');
  }

  async getActivityHeatmap() {
    return this.request<{
      heatmap: Array<{
        date: string;
        count: number;
        level: number;
      }>;
    }>('/network/activity-heatmap');
  }
}

export const networkApi = new NetworkApiClient();
export type { Contact, Interaction, Deal };
