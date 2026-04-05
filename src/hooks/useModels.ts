import { useQuery } from "@tanstack/react-query";

import { fetchProviderModels } from "@/features/provider/lib/client";
import { providerQueryKeys } from "@/features/provider/lib/query";
import { createProviderConnection } from "@/lib/connection";
import type { ConnectionSettings, ProviderConnection } from "@/types/connection";
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
  connection: Readonly<ProviderConnection> | Readonly<ConnectionSettings>,
): UseModelsResult {
  const resolvedConnection =
    "resolvedBaseUrl" in connection
      ? connection
      : createProviderConnection(connection);

  const query = useQuery({
    queryKey: providerQueryKeys.models(resolvedConnection),
    queryFn: async () => fetchProviderModels(resolvedConnection),
    enabled: resolvedConnection.hasSavedSettings,
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
