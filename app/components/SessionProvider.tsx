"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export type SessionUser = { name: string } | null;

type SessionActions = {
  login: (user: { name: string }) => void;
  signOut: () => void;
};

const STORAGE_KEY = "av_user";

const SessionContext = createContext<SessionActions | null>(null);

// `av_user` se trata como un store externo. Cada consumidor lo lee con su propio
// `useSyncExternalStore` (en `useSession`), no desde el contexto: en el servidor
// y durante la hidratación de ESE componente React usa `getServerSnapshot`
// (sin sesión) y después pasa al valor real de localStorage. Si el valor viniera
// del contexto, un componente que se hidrata tarde (bajo <Suspense>) vería ya el
// usuario y no coincidiría con el HTML del servidor.
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function notify() {
  listeners.forEach((l) => l());
}

// El snapshot es el JSON crudo (string | null): un valor primitivo estable.
function getSnapshot(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function getServerSnapshot(): string | null {
  return null;
}

function parseUser(raw: string | null): SessionUser {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      "name" in parsed &&
      typeof parsed.name === "string"
    ) {
      return { name: parsed.name };
    }
  } catch {
    // JSON inválido: seguimos sin sesión.
  }
  return null;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const login = useCallback((next: { name: string }) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
    notify();
  }, []);

  const signOut = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    notify();
  }, []);

  const value = useMemo(() => ({ login, signOut }), [login, signOut]);

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): { user: SessionUser } & SessionActions {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession debe usarse dentro de <SessionProvider>");
  }
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const user = useMemo(() => parseUser(raw), [raw]);
  return { user, login: ctx.login, signOut: ctx.signOut };
}
