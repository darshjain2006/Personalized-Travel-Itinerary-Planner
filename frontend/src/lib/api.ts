import type {
  HealthResponse,
  Trip,
  TripWithDetails,
  TripInsert,
  TripUpdate,
  TripMember,
  ItineraryItem,
  ItineraryItemInsert,
  ItineraryItemUpdate,
  ItineraryDayWithItems,
  MemberPreference,
  GroupPreferencesSummary,
} from '../types';
import { toNumber } from './utils';

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');

let authTokenGetter: (() => string | null | Promise<string | null>) | null = null;

export function setAuthTokenGetter(getter: () => string | null | Promise<string | null>) {
  authTokenGetter = getter;
}

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

export async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { params, headers, ...rest } = options;
  
  let url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined) {
        searchParams.append(key, String(val));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }
  }

  // Retrieve current bearer token if configured
  let token: string | null = null;
  if (authTokenGetter) {
    try {
      token = await authTokenGetter();
    } catch {
      token = null;
    }
  }

  const finalHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((headers as Record<string, string>) || {}),
  };

  const response = await fetch(url, {
    headers: finalHeaders,
    ...rest,
  });

  if (!response.ok) {
    let errorData: unknown;
    try {
      errorData = await response.json();
    } catch {
      errorData = await response.text();
    }
    const message =
      typeof errorData === 'object' && errorData !== null && 'detail' in errorData
        ? String((errorData as { detail: unknown }).detail)
        : `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status, errorData);
  }

  // Handle 204 or empty responses gracefully
  const contentType = response.headers.get('content-type');
  if (response.status === 204 || !contentType || !contentType.includes('application/json')) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}

// Helper normalization functions converting all cost fields to numbers upon receipt
function normalizeItem(item: any): ItineraryItem {
  if (!item) return item;
  return {
    ...item,
    estimated_cost: toNumber(item.estimated_cost),
    order_index: toNumber(item.order_index),
    upvotes: toNumber(item.upvotes),
    downvotes: toNumber(item.downvotes),
    score: toNumber(item.score),
  };
}

function normalizeDay(day: any): ItineraryDayWithItems {
  if (!day) return day;
  return {
    ...day,
    estimated_cost: toNumber(day.estimated_cost),
    version: toNumber(day.version) || 1,
    items: Array.isArray(day.items) ? day.items.map(normalizeItem) : [],
  };
}

function normalizeTrip<T extends Trip>(trip: T): T {
  if (!trip) return trip;
  const normalized: any = {
    ...trip,
    budget_total: trip.budget_total !== null && trip.budget_total !== undefined ? toNumber(trip.budget_total) : null,
    num_travelers: Math.max(1, toNumber(trip.num_travelers) || 1),
  };
  if ('days' in trip && Array.isArray((trip as any).days)) {
    normalized.days = (trip as any).days.map(normalizeDay);
  }
  return normalized as T;
}

export const apiClient = {
  get: <T>(endpoint: string, options?: RequestOptions) => 
    request<T>(endpoint, { method: 'GET', ...options }),

  post: <T>(endpoint: string, body?: unknown, options?: RequestOptions) => 
    request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
      ...options,
    }),

  patch: <T>(endpoint: string, body?: unknown, options?: RequestOptions) => 
    request<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
      ...options,
    }),

  delete: <T>(endpoint: string, options?: RequestOptions) => 
    request<T>(endpoint, { method: 'DELETE', ...options }),

  // Health
  getHealth: () => request<HealthResponse>('/health'),

  // Trips API
  trips: {
    list: async () => {
      const data = await request<Trip[]>('/api/v1/trips');
      return Array.isArray(data) ? data.map((t) => normalizeTrip(t)) : [];
    },
    get: async (id: string) => {
      const data = await request<TripWithDetails>(`/api/v1/trips/${id}`);
      return normalizeTrip(data);
    },
    create: async (data: TripInsert) => {
      const res = await apiClient.post<Trip>('/api/v1/trips', data);
      return normalizeTrip(res);
    },
    update: async (id: string, data: TripUpdate) => {
      const res = await apiClient.patch<Trip>(`/api/v1/trips/${id}`, data);
      return normalizeTrip(res);
    },
    delete: (id: string) => apiClient.delete<{ success: boolean; message: string }>(`/api/v1/trips/${id}`),
    generate: async (id: string, constraints?: { must_include?: string[]; avoid?: string[] }) => {
      const res = await apiClient.post<TripWithDetails>(`/api/v1/trips/${id}/generate`, constraints || {});
      return normalizeTrip(res);
    },
    regenerateDay: async (
      id: string,
      dayNumber: number,
      data?: { instruction?: string; must_include?: string[]; avoid?: string[] }
    ) => {
      const res = await apiClient.post<ItineraryDayWithItems>(
        `/api/v1/trips/${id}/days/${dayNumber}/regenerate`,
        data || {}
      );
      return normalizeDay(res);
    },
    getMembers: (id: string) => request<TripMember[]>(`/api/v1/trips/${id}/members`),
    inviteMember: (id: string, data: { email: string; role?: string }) =>
      apiClient.post<TripMember>(`/api/v1/trips/${id}/members`, data),
    removeMember: (id: string, userId: string) =>
      apiClient.delete<{ success: boolean; message: string }>(`/api/v1/trips/${id}/members/${userId}`),
    getPreferences: (id: string) =>
      request<GroupPreferencesSummary>(`/api/v1/trips/${id}/preferences`),
    savePreferences: (id: string, data: { interests: string[]; budget_cap?: number | null; notes?: string }) =>
      apiClient.post<MemberPreference>(`/api/v1/trips/${id}/preferences`, data),
  },

  // Items API
  items: {
    create: async (dayId: string, data: ItineraryItemInsert) => {
      const res = await apiClient.post<ItineraryItem>(`/api/v1/days/${dayId}/items`, data);
      return normalizeItem(res);
    },
    update: async (id: string, data: ItineraryItemUpdate) => {
      const res = await apiClient.patch<ItineraryItem>(`/api/v1/items/${id}`, data);
      return normalizeItem(res);
    },
    delete: (id: string) =>
      apiClient.delete<{ success: boolean; message: string }>(`/api/v1/items/${id}`),
    reorder: async (dayId: string, itemIds: string[]) => {
      const res = await apiClient.post<ItineraryItem[]>(`/api/v1/days/${dayId}/items/reorder`, { item_ids: itemIds });
      return Array.isArray(res) ? res.map(normalizeItem) : [];
    },
    replace: async (id: string, data?: { instruction?: string; preference?: string }) => {
      const res = await apiClient.post<ItineraryItem>(`/api/v1/items/${id}/replace`, data || {});
      return normalizeItem(res);
    },
    vote: (id: string, vote: number) =>
      apiClient.post<{ item_id: string; upvotes: number; downvotes: number; score: number; user_vote: number | null }>(
        `/api/v1/items/${id}/vote`,
        { vote }
      ),
  },
};
