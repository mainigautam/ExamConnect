"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "./api";
import type { LoggedInUser } from "./types";

export function useAuthGuard(requiredRole?: "ADMIN" | "STUDENT") {
  const router = useRouter();
  const [user, setUser] = useState<LoggedInUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    let active = true;

    async function verify() {
      try {
        const data = await apiFetch<{ user: LoggedInUser }>("/auth/me");
        if (!active) return;

        if (requiredRole && data.user.role !== requiredRole) {
          setUser(data.user);
          setForbidden(true);
          return;
        }

        setUser(data.user);
        setForbidden(false);
      } catch {
        if (!active) return;
        router.replace("/");
      } finally {
        if (active) setChecking(false);
      }
    }

    void verify();
    return () => {
      active = false;
    };
  }, [router, requiredRole]);

  return { user, checking, forbidden };
}
