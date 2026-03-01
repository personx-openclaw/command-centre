const API_URL = import.meta.env.VITE_API_URL || '/api';

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
      credentials: 'include', // Include cookies for refresh token
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Try to refresh token
        const refreshed = await this.refreshToken();
        if (refreshed) {
          // Retry original request
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

  // Kanban
  async getTasks() {
    return this.request<any[]>('/kanban/tasks');
  }

  async createTask(data: any) {
    return this.request<any>('/kanban/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTask(id: string, data: any) {
    return this.request<any>(`/kanban/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteTask(id: string) {
    return this.request<{ success: boolean }>(`/kanban/tasks/${id}`, {
      method: 'DELETE',
    });
  }

  async reorderTasks(tasks: Array<{ id: string; position: number; status: string }>) {
    return this.request<{ success: boolean }>('/kanban/tasks/reorder', {
      method: 'POST',
      body: JSON.stringify({ tasks }),
    });
  }
}

export const api = new ApiClient();
