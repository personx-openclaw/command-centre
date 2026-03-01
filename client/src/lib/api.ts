const API_URL = import.meta.env.VITE_API_URL || '/api';

interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'backlog' | 'today' | 'in_progress' | 'done';
  priority: 'urgent' | 'high' | 'medium' | 'low';
  position: string;
  tags?: string;
  dueDate?: string;
  completedAt?: string;
  source: 'manual' | 'telegram' | 'morning_report';
  createdAt: string;
  updatedAt: string;
}

class ApiClient {
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
      if (response.status === 401) {
        const refreshed = await this.refreshToken();
        if (refreshed) {
          return this.request(endpoint, options);
        }
      }

      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || 'Request failed');
    }

    return response.json();
  }

  // Auth
  async login(username: string, password: string) {
    const data = await this.request<{ user: any; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    localStorage.setItem('auth_token', data.token);
    return data;
  }

  async refreshToken(): Promise<boolean> {
    try {
      const data = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      }).then((r) => r.json());

      if (data.token) {
        localStorage.setItem('auth_token', data.token);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  async logout() {
    await this.request('/auth/logout', { method: 'POST' });
    localStorage.removeItem('auth_token');
  }

  async getMe() {
    return this.request<{ user: any }>('/auth/me');
  }

  // Tasks
  async getTasks() {
    return this.request<Task[]>('/tasks');
  }

  async createTask(data: Partial<Task>) {
    return this.request<Task>('/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTask(id: string, data: Partial<Task>) {
    return this.request<Task>(`/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteTask(id: string) {
    return this.request<{ success: boolean }>(`/tasks/${id}`, {
      method: 'DELETE',
    });
  }

  async moveTask(id: string, status: string, position: string) {
    return this.request<Task>(`/tasks/${id}/move`, {
      method: 'PATCH',
      body: JSON.stringify({ status, position }),
    });
  }

  async reorderTasks(updates: Array<{ id: string; position: string; status: string }>) {
    return this.request<{ success: boolean }>('/tasks/reorder', {
      method: 'PATCH',
      body: JSON.stringify({ tasks: updates }),
    });
  }
}

export const api = new ApiClient();
export type { Task };
