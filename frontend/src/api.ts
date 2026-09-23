import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Platform } from "react-native";

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
  mamie_phone: string;
  contacts: Contact[];
  fall_sensitivity: "basse" | "moyenne" | "haute";
  checkin_interval_hours: number;
  dashboard_pin: string;
  sound_detection: boolean;
  night_mode: boolean;
  night_start: number;
  night_end: number;
  inactivity_watch: boolean;
  inactivity_hours: number;
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

// ---- Activities -----------------------------------------------------------
export type ActivityStatus =
  | "scheduled"
  | "awaiting_confirmation"
  | "confirmed"
  | "escalated"
  | "cancelled";

export type Activity = {
  id: string;
  title: string;
  kind: "activity" | "shower";
  start_at: string;
  end_at: string;
  grace_minutes: number;
  status: ActivityStatus;
  awaiting_since: string | null;
  confirmed_at: string | null;
  created_at: string;
};

export function useActivities(status?: string) {
  return useQuery({
    queryKey: ["activities", status ?? "all"],
    queryFn: () => api<Activity[]>(`/activities${status ? `?status=${status}` : ""}`),
    refetchInterval: 10000,
  });
}

export function useCreateActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      title: string;
      kind?: "activity" | "shower";
      start_at: string;
      end_at: string;
      grace_minutes?: number;
    }) => api<Activity>("/activities", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["activities"] }),
  });
}

export function useConfirmActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: "confirmed" | "cancelled" }) =>
      api<Activity>(`/activities/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["activities"] });
      qc.invalidateQueries({ queryKey: ["alerts"] });
    },
  });
}

// ---- Photo requests -------------------------------------------------------
export type PhotoRequest = {
  id: string;
  status: "pending" | "accepted" | "refused" | "fulfilled" | "cancelled";
  photo_path: string | null;
  created_at: string;
  fulfilled_at: string | null;
};

export function photoUrl(reqId: string) {
  return `${API_BASE}/photos/${reqId}`;
}

export function usePhotoRequests(status?: string) {
  return useQuery({
    queryKey: ["photo-requests", status ?? "all"],
    queryFn: () => api<PhotoRequest[]>(`/photo-requests${status ? `?status=${status}` : ""}`),
    refetchInterval: 5000,
  });
}

export function useCreatePhotoRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<PhotoRequest>("/photo-requests", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["photo-requests"] }),
  });
}

export function useUpdatePhotoRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: "accepted" | "refused" | "cancelled" }) =>
      api<PhotoRequest>(`/photo-requests/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["photo-requests"] }),
  });
}

export async function uploadPhoto(reqId: string, uri: string) {
  const form = new FormData();
  if (Platform.OS === "web") {
    const blob = await (await fetch(uri)).blob();
    form.append("file", blob, "photo.jpg");
  } else {
    // native multipart file shape
    form.append("file", { uri, name: "photo.jpg", type: "image/jpeg" } as any);
  }
  const res = await fetch(`${API_BASE}/photo-requests/${reqId}/photo`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error("upload failed");
  return res.json();
}
