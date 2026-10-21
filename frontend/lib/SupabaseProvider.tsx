"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "./supabase";
import { User } from "@supabase/supabase-js";

interface SupabaseContextType {
  user: User | null;
}

const SupabaseContext = createContext<SupabaseContextType | null>(null);

interface SupabaseProviderProps {
  children: ReactNode; // ✅ 型を明示
}

export default function SupabaseProvider({ children }: SupabaseProviderProps) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
    };
    getUser();
  }, []);

  return (
    <SupabaseContext.Provider value={{ user }}>
      {children}
    </SupabaseContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(SupabaseContext);
  if (!context) {
    throw new Error("useAuth は SupabaseProvider 内で使用する必要があります。");
  }
  return context;
}
