const API_URL = import.meta.env.VITE_API_URL || '/api';

export class ApiClient {
  private getToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: HeadersInit = { 'Content-Type': 'application/json', ...options.headers };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || 'Request failed');
    }
    return response.json();
  }

  async login(username: string, password: string) {
    const data = await this.request<{ user: any; token: string }>('/auth/login', {
      method: 'POST', body: JSON.stringify({ username, password }),
    });
    localStorage.setItem('auth_token', data.token);
    return data;
  }

  async register(username: string, password: string) {
    const data = await this.request<{ user: any; token: string }>('/auth/register', {
      method: 'POST', body: JSON.stringify({ username, password }),
    });
    localStorage.setItem('auth_token', data.token);
    return data;
  }

  async getMe() { return this.request<{ user: any }>('/auth/me'); }
  logout() { localStorage.removeItem('auth_token'); }

  async getTasks() { return this.request<any[]>('/tasks'); }

  async createTask(data: any) {
    return this.request<any>('/tasks', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateTask(id: string, data: any) {
    return this.request<any>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  }

  async deleteTask(id: string) {
    return this.request<{ success: boolean }>(`/tasks/${id}`, { method: 'DELETE' });
  }

  async moveTask(id: string, status: string, position: string) {
    return this.request<any>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify({ status, position }) });
  }

  async getProspects() { return this.request<any[]>('/prospects'); }
  async getProspect(id: string) { return this.request<any>(`/prospects/${id}`); }
  async createProspect(data: any) { return this.request<any>('/prospects', { method: 'POST', body: JSON.stringify(data) }); }
  async updateProspect(id: string, data: any) { return this.request<any>(`/prospects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); }
  async deleteProspect(id: string) { return this.request<any>(`/prospects/${id}`, { method: 'DELETE' }); }
}

export const api = new ApiClient();
