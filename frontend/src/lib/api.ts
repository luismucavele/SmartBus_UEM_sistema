const API_URL = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");

let token: string | null = localStorage.getItem("smartbus_token");

export function getApiToken() { return token; }

export function setApiToken(value: string | null) {
  token = value;
  if (value) localStorage.setItem("smartbus_token", value);
  else localStorage.removeItem("smartbus_token");
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  const body = await response.json().catch(() => ({}));
  if (response.status === 401) {
    setApiToken(null);
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("smartbus:unauthorized"));
  }
  if (!response.ok) throw new ApiError(body.error || "Erro de comunicação com o backend.", response.status);
  return body as T;
}

export type ApiUser = { id: number; name: string; email: string; role: "funcionario" | "motorista" | "administrador"; phone?: string | null; matricula?: string | null; active?: boolean | number; lastLogin?: string | null; roleName?: string };
export type ApiStop = { name: string; latitude?: number | null; longitude?: number | null; order?: number };
export type ApiRoute = { id: number; code: string; name: string; origin: string; destination: string; departure?: string | null; arrival?: string | null; estado?: string; stops?: ApiStop[] | string[]; total_paragens?: number };
export type ApiBus = { id: number; code: string; plate: string; model: string; capacity?: number; routeId?: number | string | null; routeCode?: string | null; routeName?: string | null; driver?: string | null; driverId?: number | null; status: string; lat?: number | null; lng?: number | null; speed?: number | null; updated?: string | null; nextStop?: string | null };
export type ApiIncident = { id: number; title: string; description: string; type: string; priority: string; status: string; createdAt?: string; bus?: string | null; route?: string | null; bus_code?: string | null; route_code?: string | null };
export type ApiNotification = { id: number; title: string; text?: string; mensagem?: string; kind?: string; tipo?: string; createdAt?: string; criado_em?: string; readAt?: string | null; lida_em?: string | null };
export type DashboardData = { buses: ApiBus[]; incidents: ApiIncident[]; notifications: ApiNotification[]; routes: ApiRoute[] };

export const authApi = {
  login: (email: string, password: string) => apiRequest<{ user: ApiUser; token: string }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  me: () => apiRequest<{ user: ApiUser }>("/me"),
};

export const smartBusApi = {
  dashboard: () => apiRequest<DashboardData>("/dashboard"),
  buses: () => apiRequest<ApiBus[]>("/buses"),
  createBus: (data: Record<string, unknown>) => apiRequest<{ id: number; message: string }>("/buses", { method: "POST", body: JSON.stringify(data) }),
  deleteBus: (id: string | number) => apiRequest<{ message: string }>(`/buses/${id}`, { method: "DELETE" }),
  updateBusStatus: (id: string | number, status: string, lat?: number, lng?: number, speed?: number) =>
    apiRequest<{ message: string }>(`/buses/${id}/status`, { method: "POST", body: JSON.stringify({ status, latitude: lat, longitude: lng, speed }) }),

  routes: () => apiRequest<ApiRoute[]>("/routes"),
  createRoute: (data: Record<string, unknown>) => apiRequest<{ id: number; message: string }>("/routes", { method: "POST", body: JSON.stringify(data) }),
  deleteRoute: (id: string | number) => apiRequest<{ message: string }>(`/routes/${id}`, { method: "DELETE" }),

  users: () => apiRequest<ApiUser[]>("/users"),
  drivers: () => apiRequest<ApiUser[]>("/drivers"),
  createUser: (data: Record<string, unknown>) => apiRequest<{ id: number; message: string }>("/users", { method: "POST", body: JSON.stringify(data) }),
  updateUser: (id: string | number, data: Record<string, unknown>) => apiRequest<{ message: string }>(`/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteUser: (id: string | number) => apiRequest<{ message: string }>(`/users/${id}`, { method: "DELETE" }),

  incidents: () => apiRequest<ApiIncident[]>("/incidents"),
  createIncident: (data: Record<string, unknown>) => apiRequest<{ id: number; message: string }>("/incidents", { method: "POST", body: JSON.stringify(data) }),
  resolveIncident: (id: string | number) => apiRequest<{ message: string }>(`/incidents/${id}/resolve`, { method: "PATCH" }),

  notifications: () => apiRequest<ApiNotification[]>("/notifications"),
  markNotificationRead: (id: string | number) => apiRequest<{ message: string }>(`/notifications/${id}/read`, { method: "PATCH" }),

  updateBus: (id: string | number, data: Record<string, unknown>) => apiRequest<{ message: string }>(`/buses/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  updateRoute: (id: string | number, data: Record<string, unknown>) => apiRequest<{ message: string }>(`/routes/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
};
