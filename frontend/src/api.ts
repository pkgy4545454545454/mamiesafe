import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { API_BASE } from "@/src/config";

export type Contact = {
  id?: string;
  name: string;
  phone: string;
  relation?: string;
  primary?: boolean;
};

export type Config = {
  id: string;
  mamie_name: string;
  emergency_number: string;
  contacts: Contact[];
  fall_sensitivity: "basse" | "moyenne" | "haute";
  checkin_interval_hours: number;
  dashboard_pin: string;
  updated_at: string;
};

export type EventType = "bedtime" | "wakeup" | "checkin" | "sos" | "fall" | "voice";

export type AppEvent = {
  id: string;
  type: EventType;
  note: string;
  created_at: string;
};

export type Severity = "leger" | "moyen" | "dangereux";
export type AlertKind = "fall" | "sos" | "noise" | "missed_checkin" | "voice";

export type Alert = {
  id: string;
  kind: AlertKind;
  severity: Severity;
  message: string;
  status: "pending" | "validated" | "dismissed";
  created_at: string;
  resolved_at: string | null;
};

export type LocationPoint = {
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  created_at: string | null;
};

export type Summary = {
  mamie_name: string;
  last_checkin: string | null;
  last_bedtime: string | null;
  pending_alerts: number;
  last_location: LocationPoint | null;
  status: { online: boolean; battery?: number; fall_active?: boolean; listening?: boolean };
};

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API ${path} -> ${res.status}`);
  }
  return res.json();
}

// ---- Config ---------------------------------------------------------------
export function useConfig() {
  return useQuery({ queryKey: ["config"], queryFn: () => api<Config>("/config") });
}

export function useUpdateConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Config>) =>
      api<Config>("/config", { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["config"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
    },
  });
}

// ---- Events ---------------------------------------------------------------
export function useEvents(limit = 50) {
  return useQuery({
    queryKey: ["events", limit],
    queryFn: () => api<AppEvent[]>(`/events?limit=${limit}`),
    refetchInterval: 15000,
  });
}

export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { type: EventType; note?: string }) =>
      api<AppEvent>("/events", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
    },
  });
}

// ---- Alerts ---------------------------------------------------------------
export function useAlerts(limit = 100) {
  return useQuery({
    queryKey: ["alerts", limit],
    queryFn: () => api<Alert[]>(`/alerts?limit=${limit}`),
    refetchInterval: 10000,
  });
}

export function useCreateAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { kind: AlertKind; severity: Severity; message?: string }) =>
      api<Alert>("/alerts", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alerts"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
    },
  });
}

export function useResolveAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: "validated" | "dismissed" }) =>
      api<Alert>(`/alerts/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alerts"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
    },
  });
}

// ---- Location -------------------------------------------------------------
export function useLatestLocation() {
  return useQuery({
    queryKey: ["location"],
    queryFn: () => api<LocationPoint>("/location/latest"),
    refetchInterval: 15000,
  });
}

export async function postLocation(body: { lat: number; lng: number; accuracy?: number }) {
  return api<LocationPoint>("/location", { method: "POST", body: JSON.stringify(body) });
}

export async function postHeartbeat(body: {
  battery?: number;
  fall_active?: boolean;
  listening?: boolean;
}) {
  return api("/heartbeat", { method: "POST", body: JSON.stringify(body) });
}

// ---- Summary --------------------------------------------------------------
export function useSummary() {
  return useQuery({
    queryKey: ["summary"],
    queryFn: () => api<Summary>("/dashboard/summary"),
    refetchInterval: 8000,
  });
}
