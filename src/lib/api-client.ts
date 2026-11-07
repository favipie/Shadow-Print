"use client";
import { useCallback, useEffect, useState } from "react";

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/backend/${path}`, {
    ...init,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const data = await response.json();
  if (!response.ok) {
    const detail = data.detail;
    throw new Error(
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail.map((d: { msg?: string }) => d.msg).join("; ")
          : `Request failed (${response.status})`,
    );
  }
  return data as T;
}

export function useApi<T>(path: string | null) {
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{
    path: string;
    revision: number;
    data?: T;
    error?: string;
  } | null>(null);
  const reload = useCallback(() => setRevision((n) => n + 1), []);
  useEffect(() => {
    window.addEventListener("shadowprint:changed", reload);
    return () => window.removeEventListener("shadowprint:changed", reload);
  }, [reload]);
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    api<T>(path, { signal: controller.signal }).then(
      (data) => {
        if (!controller.signal.aborted) setResult({ path, revision, data });
      },
      (error: Error) => {
        if (!controller.signal.aborted)
          setResult({ path, revision, error: error.message });
      },
    );
    return () => controller.abort();
  }, [path, revision]);
  const current =
    result?.path === path && result.revision === revision ? result : null;
  return {
    data: current?.data,
    error: current?.error,
    loading: Boolean(path && !current),
    reload,
  };
}

export async function writeApi<T>(
  path: string,
  body: unknown,
  method = "POST",
) {
  const result = await api<T>(path, { method, body: JSON.stringify(body) });
  window.dispatchEvent(new Event("shadowprint:changed"));
  return result;
}

export function query(values: Record<string, string | undefined>) {
  return new URLSearchParams(
    Object.entries(values).filter((entry): entry is [string, string] =>
      Boolean(entry[1]),
    ),
  ).toString();
}
export function link(section: string, key?: string, id?: string) {
  return `#${section}${key && id ? `?${key}=${encodeURIComponent(id)}` : ""}`;
}
export function stamp(value: string) {
  return new Date(value).toLocaleString("en-GB", { timeZone: "UTC" }) + " UTC";
}
