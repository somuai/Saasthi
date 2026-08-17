import { useMemo } from "react";
import { toast } from "sonner";

export function useToast() {
  return useMemo(
    () => ({
      success: (message: string) => toast.success(message),
      error: (message: string) => toast.error(message),
      info: (message: string) => toast.info(message),
      promise: <T,>(
        promise: Promise<T>,
        messages: { loading: string; success: string; error: string }
      ) => toast.promise(promise, messages),
    }),
    []
  );
}

