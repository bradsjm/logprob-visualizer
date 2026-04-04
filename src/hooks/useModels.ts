import { useQuery } from "@tanstack/react-query";

import { getConnectionCacheKey } from "@/lib/connection";
import { fetchProviderModels } from "@/lib/openai";
import type { ConnectionSettings } from "@/types/connection";
import type { ModelInfo } from "@/types/logprob";

export interface UseModelsResult {
  readonly models: readonly ModelInfo[];
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly errorMessage: string | null;
}

/**
 * Fetches available models from the configured provider and caches them in memory.
 */
export function useModels(
  settings: Readonly<ConnectionSettings>,
  resolvedBaseUrl: string,
): UseModelsResult {
  const query = useQuery({
    queryKey: ["models", resolvedBaseUrl, getConnectionCacheKey(settings)],
    queryFn: async () => fetchProviderModels(settings),
    enabled: settings.apiKey.trim().length > 0,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  return {
    models: (query.data ?? []) as readonly ModelInfo[],
    isLoading: query.isLoading,
    isError: Boolean(query.isError),
    errorMessage: query.isError ? (query.error as Error).message : null,
  };
}
