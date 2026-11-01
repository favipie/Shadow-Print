"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  initialState,
  parseSavedState,
  type DemoState,
} from "@/lib/demo-engine";
const KEY = "shadowprint.demo.v2";
const Context = createContext<{
  state: DemoState;
  update: (action: string, fn: (state: DemoState) => DemoState) => void;
  ready: boolean;
  storageError: string;
} | null>(null);
export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(initialState);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [canSave, setCanSave] = useState(true);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setState(parseSavedState(raw));
    } catch {
      setStorageError(
        "Saved demo data could not be loaded. Changes will remain in memory; existing storage has not been overwritten.",
      );
      setCanSave(false);
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready || !canSave) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      setStorageError(
        "Browser storage is unavailable. Changes will be kept for this session only.",
      );
    }
  }, [state, ready, canSave]);
  function update(action: string, fn: (s: DemoState) => DemoState) {
    const at = new Date().toISOString();
    const id = crypto.randomUUID();
    setState((previous) => {
      const next = fn(previous);
      return {
        ...next,
        audit: [{ id, at, action }, ...previous.audit].slice(0, 200),
      };
    });
  }
  return (
    <Context.Provider value={{ state, update, ready, storageError }}>
      {children}
    </Context.Provider>
  );
}
export function useDemo() {
  const value = useContext(Context);
  if (!value) throw Error("DemoProvider missing");
  return value;
}
