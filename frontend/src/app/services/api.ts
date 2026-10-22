// API Service for Fundlelo Loan Collection Agent
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

class ApiService {
  private getToken(): string | null {
    return localStorage.getItem('agent_token');
  }

  private getAgentCode(): string {
    const saved = localStorage.getItem('agent_data');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.id || parsed.agent_code || 'AG001';
      } catch (e) {}
    }
    return 'AG001';
  }

  private async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const agentCode = this.getAgentCode();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-agent-code': agentCode,
      ...(options.headers as Record<string, string> || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Request failed with status ${response.status}`);
      }

      return await response.json();
    } catch (err: any) {
      console.error(`API Error on ${endpoint}:`, err.message);
      throw err;
    }
  }

  // 1. Auth APIs
  auth = {
    login: async (
      agentId: string, 
      password: string, 
      loginType = 'password',
      locationData?: { latitude?: number; longitude?: number; accuracy?: number; address?: string }
    ) => {
      const payload: any = { agentId, password, loginType };
      if (locationData) {
        if (locationData.latitude !== undefined) payload.latitude = locationData.latitude;
        if (locationData.longitude !== undefined) payload.longitude = locationData.longitude;
        if (locationData.accuracy !== undefined) payload.accuracy = locationData.accuracy;
        if (locationData.address !== undefined) payload.address = locationData.address;
      }

      const res = await this.request('/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res.token) {
        localStorage.setItem('agent_token', res.token);
        localStorage.setItem('agent_data', JSON.stringify(res.agent));

        // Save login location into client history cache as well
        if (res.loginLocation && res.loginLocation.recorded) {
          try {
            const historyItem = {
              agentName: res.agent?.name || 'Collection Agent',
              timestamp: Date.now(),
              latitude: res.loginLocation.latitude,
              longitude: res.loginLocation.longitude,
              address: res.loginLocation.address,
              loginSession: true
            };
            const currentLogs = JSON.parse(localStorage.getItem('agentLocationLogs') || '[]');
            localStorage.setItem('agentLocationLogs', JSON.stringify([historyItem, ...currentLogs.slice(0, 99)]));
          } catch (_) {}
        }
      }
      return res;
    },
    sendOtp: (agentId: string) => 
      this.request('/auth/send-otp', {
        method: 'POST',
        body: JSON.stringify({ agentId }),
      }),
    verifyOtp: async (
      agentId: string, 
      otp: string,
      locationData?: { latitude?: number; longitude?: number; accuracy?: number; address?: string }
    ) => {
      const payload: any = { agentId, otp };
      if (locationData) {
        if (locationData.latitude !== undefined) payload.latitude = locationData.latitude;
        if (locationData.longitude !== undefined) payload.longitude = locationData.longitude;
        if (locationData.accuracy !== undefined) payload.accuracy = locationData.accuracy;
        if (locationData.address !== undefined) payload.address = locationData.address;
      }

      const res = await this.request('/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res.token) {
        localStorage.setItem('agent_token', res.token);
        localStorage.setItem('agent_data', JSON.stringify(res.agent));

        if (res.loginLocation && res.loginLocation.recorded) {
          try {
            const historyItem = {
              agentName: res.agent?.name || 'Collection Agent',
              timestamp: Date.now(),
              latitude: res.loginLocation.latitude,
              longitude: res.loginLocation.longitude,
              address: res.loginLocation.address,
              loginSession: true
            };
            const currentLogs = JSON.parse(localStorage.getItem('agentLocationLogs') || '[]');
            localStorage.setItem('agentLocationLogs', JSON.stringify([historyItem, ...currentLogs.slice(0, 99)]));
          } catch (_) {}
        }
      }
      return res;
    },
    getMe: () => this.request('/auth/me'),
    logout: async () => {
      try {
        await this.request('/auth/logout', { method: 'POST' });
      } finally {
        localStorage.removeItem('agent_token');
        localStorage.removeItem('agent_data');
      }
    },
  };

  // 2. Agent APIs
  agents = {
    getProfile: (agentCode?: string) => 
      this.request(`/agents/profile?agentCode=${agentCode || this.getAgentCode()}`),
    updateProfile: (data: any) => 
      this.request('/agents/profile', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    getDashboardStats: (agentCode?: string) => 
      this.request(`/agents/dashboard-stats?agentCode=${agentCode || this.getAgentCode()}`),
  };

  // 3. Customer APIs
  customers = {
    getCustomers: (params?: { search?: string; status?: string }) => {
      const query = new URLSearchParams();
      if (params?.search) query.append('search', params.search);
      if (params?.status && params.status !== 'all') query.append('status', params.status);
      query.append('agentCode', this.getAgentCode());
      return this.request(`/customers?${query.toString()}`);
    },
    getCustomerById: (id: number | string) => 
      this.request(`/customers/${id}`),
    createCustomer: (data: any) => 
      this.request('/customers', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    updateCustomer: (id: number | string, data: any) => 
      this.request(`/customers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
  };

  // 4. Payment APIs
  payments = {
    recordPayment: (data: {
      customerId: number;
      customerName: string;
      loanId: string;
      amount: number;
      paymentMode: string;
      transactionReference?: string;
      notes?: string;
      latitude?: number;
      longitude?: number;
      receiptUrl?: string;
    }) => 
      this.request('/payments', {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          agentCode: this.getAgentCode(),
        }),
      }),
    getPayments: (params?: { customerId?: number; date?: string; limit?: number }) => {
      const query = new URLSearchParams();
      query.append('agentCode', this.getAgentCode());
      if (params?.customerId) query.append('customerId', String(params.customerId));
      if (params?.date) query.append('date', params.date);
      if (params?.limit) query.append('limit', String(params.limit));
      return this.request(`/payments?${query.toString()}`);
    },
    getPaymentSummary: () => 
      this.request(`/payments/summary?agentCode=${this.getAgentCode()}`),
  };

  // 5. Cash Submissions
  cash = {
    getStatus: () => 
      this.request(`/cash-submissions/status?agentCode=${this.getAgentCode()}`),
    createSubmission: (data: {
      amount: number;
      denominations: Record<string, number>;
      submissionType?: string;
      notes?: string;
      receiptUrl?: string;
    }) => 
      this.request('/cash-submissions', {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          agentCode: this.getAgentCode(),
        }),
      }),
    updateStatus: (id: number | string, status: 'APPROVED' | 'REJECTED', approvedBy?: string) => 
      this.request(`/cash-submissions/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status, approvedBy }),
      }),
  };

  // 6. Attendance APIs
  attendance = {
    getToday: () => 
      this.request(`/attendance/today?agentCode=${this.getAgentCode()}`),
    punchIn: (data: { latitude?: number; longitude?: number; address?: string; batteryLevel?: number }) => 
      this.request('/attendance/punch-in', {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          agentCode: this.getAgentCode(),
        }),
      }),
    punchOut: (data: { latitude?: number; longitude?: number; address?: string }) => 
      this.request('/attendance/punch-out', {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          agentCode: this.getAgentCode(),
        }),
      }),
    getHistory: () => 
      this.request(`/attendance/history?agentCode=${this.getAgentCode()}`),
  };

  // 7. Location APIs
  location = {
    ping: (data: { 
      latitude: number; 
      longitude: number; 
      accuracy?: number; 
      batteryLevel?: number; 
      speed?: number; 
      address?: string;
      locationType?: string;
      isLogin?: boolean;
      agentCode?: string;
      agentName?: string;
    }) => 
      this.request('/location/ping', {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          agentCode: data.agentCode || this.getAgentCode(),
        }),
      }),
    getHistory: (params?: { date?: string; type?: 'all' | 'login' | 'visit' | string; agentCode?: string } | string) => {
      const query = new URLSearchParams();
      if (typeof params === 'string') {
        query.append('agentCode', this.getAgentCode());
        if (params) query.append('date', params);
      } else {
        const agentCode = params?.agentCode || this.getAgentCode();
        if (agentCode) query.append('agentCode', agentCode);
        if (params?.date) query.append('date', params.date);
        if (params?.type && params.type !== 'all') query.append('type', params.type);
      }
      return this.request(`/location/history?${query.toString()}`);
    },
    getLive: (agentCode?: string) => 
      this.request(`/location/live?agentCode=${agentCode || this.getAgentCode()}`),
    getAllAgents: () => 
      this.request('/location/all-agents'),
  };

  // 8. Visit & Proof APIs
  visits = {
    recordVisit: (data: {
      customerId: number;
      customerName: string;
      loanId: string;
      visitType?: string;
      latitude?: number;
      longitude?: number;
      locationAddress?: string;
      photoProofUrl?: string;
      signatureUrl?: string;
      notes?: string;
      outcome?: string;
      ptpDate?: string;
      ptpAmount?: number;
    }) => 
      this.request('/visits', {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          agentCode: this.getAgentCode(),
        }),
      }),
    getVisits: (params?: { customerId?: number; date?: string; limit?: number }) => {
      const query = new URLSearchParams();
      query.append('agentCode', this.getAgentCode());
      if (params?.customerId) query.append('customerId', String(params.customerId));
      if (params?.date) query.append('date', params.date);
      if (params?.limit) query.append('limit', String(params.limit));
      return this.request(`/visits?${query.toString()}`);
    },
    getAnalytics: () => 
      this.request(`/visits/analytics?agentCode=${this.getAgentCode()}`),
  };

  // 9. Tasks & Reminders
  tasks = {
    getTasks: (status?: string) => {
      const query = new URLSearchParams();
      query.append('agentCode', this.getAgentCode());
      if (status) query.append('status', status);
      return this.request(`/tasks?${query.toString()}`);
    },
    createTask: (data: any) => 
      this.request('/tasks', {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          agentCode: this.getAgentCode(),
        }),
      }),
    updateTask: (id: number | string, data: any) => 
      this.request(`/tasks/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    deleteTask: (id: number | string) => 
      this.request(`/tasks/${id}`, { method: 'DELETE' }),
  };

  // 10. Notifications
  notifications = {
    getNotifications: () => 
      this.request(`/notifications?agentCode=${this.getAgentCode()}`),
    markAsRead: (id: number | string) => 
      this.request(`/notifications/${id}/read`, { method: 'PUT' }),
    markAllAsRead: () => 
      this.request('/notifications/read-all', {
        method: 'PUT',
        body: JSON.stringify({ agentCode: this.getAgentCode() }),
      }),
  };

  // 11. Audit Trail & Central Panel Logs
  audit = {
    getLogs: (limit = 100, search?: string) => {
      const q = new URLSearchParams({ agentCode: this.getAgentCode(), limit: String(limit) });
      if (search) q.append('search', search);
      return this.request(`/audit?${q.toString()}`);
    },
    recordLog: (data: {
      action: string;
      leadId?: number | string;
      remarks?: string;
      details?: any;
      latitude?: number;
      longitude?: number;
      entityType?: string;
      entityId?: string;
    }) => 
      this.request('/audit', {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          agentCode: this.getAgentCode(),
        }),
      }).catch(err => {
        console.warn('[Audit Logger] Non-blocking log failure:', err.message);
      }),
  };

  // 12. File Upload (Customer Repayments & Proofs)
  upload = {
    uploadImage: async (
      file: File, 
      metadata?: { customerId?: number | string; loanId?: string; userId?: string | number }
    ) => {
      const formData = new FormData();
      formData.append('file', file);
      if (metadata?.customerId) formData.append('customerId', String(metadata.customerId));
      if (metadata?.loanId) formData.append('loanId', String(metadata.loanId));
      if (metadata?.userId) formData.append('userId', String(metadata.userId));

      const token = this.getToken();
      const headers: Record<string, string> = {
        'x-agent-code': this.getAgentCode(),
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        headers,
        body: formData,
      });
      return await res.json();
    },
  };

  // 13. Customer Documents & Zero-Trust KYC
  documents = {
    getCustomerDocuments: (userId: string | number) => 
      this.request(`/documents/customer/${userId}`),
    streamDocumentUrl: (filePath: string) => 
      resolveSecureDocUrl(`${API_BASE_URL}/documents/stream?path=${encodeURIComponent(filePath)}`),
  };
}

export function resolveSecureDocUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  const token = localStorage.getItem('agent_token') || localStorage.getItem('token') || sessionStorage.getItem('token') || '';
  let url = rawUrl;
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
    url = `${apiBase.replace(/\/api$/, '')}${url.startsWith('/') ? '' : '/'}${url}`;
  }
  if (token && !url.includes('token=')) {
    url += (url.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(token);
  }
  return url;
}

export const api = new ApiService();
export default api;

