import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Profile } from "../types";

export function useProfiles() {
  const [profiles, setProfiles] = useState<Profile[]>([]);

  const loadProfiles = useCallback(async () => {
    try {
      const data = await invoke<Profile[]>("load_profiles");
      setProfiles(data);
    } catch (err) {
      console.error("Failed to load profiles:", err);
    }
  }, []);

  const saveProfile = useCallback(
    async (profile: Profile): Promise<Profile | null> => {
      try {
        const saved = await invoke<Profile>("save_profile", { profile });
        setProfiles((prev) => {
          const idx = prev.findIndex((p) => p.id === saved.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = saved;
            return next;
          }
          return [...prev, saved];
        });
        return saved;
      } catch (err) {
        console.error("Failed to save profile:", err);
        return null;
      }
    },
    [],
  );

  const deleteProfile = useCallback(async (id: string) => {
    try {
      await invoke("delete_profile", { id });
      setProfiles((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error("Failed to delete profile:", err);
    }
  }, []);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  return { profiles, loadProfiles, saveProfile, deleteProfile };
}
