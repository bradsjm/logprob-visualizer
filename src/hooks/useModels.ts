import { useQuery } from "@tanstack/react-query";

import { toast } from "@/components/ui/sonner";
import { getModels } from "@/lib/api/models";
import type { ModelInfo } from "@/types/logprob";

export interface UseModelsResult {
  readonly models: readonly ModelInfo[];
  readonly isLoading: boolean;
  readonly isError: boolean;
}

/**
 * Fetches available models from the backend and caches them in memory.
 * Emits a toast on error. Results are considered fresh for 5 minutes.
 */
export function useModels(): UseModelsResult {
  const query = useQuery({
    queryKey: ["models"],
    queryFn: getModels,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  if (query.isError) {
    toast("Failed to load models", {
      description: (query.error as Error).message,
    });
  }

  return {
    models: (query.data ?? []) as readonly ModelInfo[],
    isLoading: query.isLoading,
    isError: Boolean(query.isError),
  };
}
