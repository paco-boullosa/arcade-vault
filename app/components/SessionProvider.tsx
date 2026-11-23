"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { createClient } from "@/app/lib/supabase/client";
import { deriveUsername } from "@/app/lib/auth/username";

export type SessionUser = { id: string; name: string } | null;

type SessionActions = {
  signOut: () => Promise<void>;
};

// Clave de la sesión simulada anterior (SPEC 01). Ya no se usa: se elimina.
const LEGACY_STORAGE_KEY = "av_user";

const SessionContext = createContext<SessionActions | null>(null);

// La sesión de Supabase se trata como un store externo. Cada consumidor lo lee
// con su propio `useSyncExternalStore` (en `useSession`), no desde el contexto:
// en el servidor y durante la hidratación de ESE componente React usa
// `getServerSnapshot` (sin sesión) y después pasa al valor real. Si el valor
// viniera del contexto, un componente que se hidrata tarde (bajo <Suspense>)
// vería ya el usuario y no coincidiría con el HTML del servidor.
const listeners = new Set<() => void>();
let currentUser: SessionUser = null;

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// El snapshot debe ser estable: solo se crea un objeto nuevo si cambia el
// usuario (id o nombre), no en cada refresco de token.
function getSnapshot(): SessionUser {
  return currentUser;
}

function getServerSnapshot(): SessionUser {
  return null;
}

function toSessionUser(session: Session | null): SessionUser {
  const u = session?.user;
  if (!u) return null;
  const meta = u.user_metadata ?? {};
  const name =
    typeof meta.username === "string" && meta.username !== ""
      ? meta.username
      : deriveUsername(meta, u.email);
  return { id: u.id, name };
}

function setCurrentUser(next: SessionUser) {
  if (next?.id === currentUser?.id && next?.name === currentUser?.name) return;
  currentUser = next;
  listeners.forEach((l) => l());
}

export function SessionProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {}

    const supabase = createClient();
    // INITIAL_SESSION se emite al suscribirse, así que cubre la lectura de la
    // sesión inicial. Entre pestañas, supabase-js emite SIGNED_IN/SIGNED_OUT.
    // El callback solo actualiza el store: no se llama a Supabase desde él.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(toSessionUser(session));
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const signOut = useCallback(async () => {
    await createClient().auth.signOut();
  }, []);

  const value = useMemo(() => ({ signOut }), [signOut]);

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): { user: SessionUser } & SessionActions {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession debe usarse dentro de <SessionProvider>");
  }
  const user = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { user, signOut: ctx.signOut };
}
