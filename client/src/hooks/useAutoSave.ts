import { useState, useEffect, useRef, useCallback } from "react";

interface UseAutoSaveResult {
  saving: boolean;
  lastSaved: Date | null;
  error: string | null;
  saveNow: () => Promise<void>;
  isDirty: boolean;
}

export const useAutoSave = <T>(
  data: T,
  saveFunction: (data: T) => Promise<any>,
  options: {
    delay?: number;
    enabled?: boolean;
    onSaveSuccess?: (response: any) => void;
    onSaveError?: (error: any) => void;
  } = {},
): UseAutoSaveResult => {
  const { delay = 2000, enabled = true, onSaveSuccess, onSaveError } = options;

  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const initialDataRef = useRef<string>(JSON.stringify(data));
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const latestDataRef = useRef<T>(data);

  // Keep latest data ref updated
  useEffect(() => {
    latestDataRef.current = data;

    // Check dirtiness
    const currentDataStr = JSON.stringify(data);
    if (currentDataStr !== initialDataRef.current) {
      setIsDirty(true);
    }
  }, [data]);

  const saveData = useCallback(async () => {
    if (!latestDataRef.current) return;

    setSaving(true);
    setError(null);

    try {
      const response = await saveFunction(latestDataRef.current);
      setLastSaved(new Date());
      setIsDirty(false);
      initialDataRef.current = JSON.stringify(latestDataRef.current);
      if (onSaveSuccess) onSaveSuccess(response);
    } catch (err: any) {
      console.error("Auto-save failed:", err);
      setError(err.message || "Failed to save");
      if (onSaveError) onSaveError(err);
    } finally {
      setSaving(false);
    }
  }, [saveFunction, onSaveSuccess, onSaveError]);

  useEffect(() => {
    if (!enabled || !isDirty) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      saveData();
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, enabled, delay, isDirty, saveData]);

  return {
    saving,
    lastSaved,
    error,
    saveNow: saveData,
    isDirty,
  };
};
