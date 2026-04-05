import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { probeModelLogprobsSupport } from "@/features/provider/lib/client";
import { providerQueryKeys } from "@/features/provider/lib/query";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { createProviderConnection } from "@/lib/connection";
import type {
  ConnectionSettings,
  ModelCapability,
  ProviderConnection,
} from "@/types/connection";

export interface UseModelCapabilityResult extends ModelCapability {
  isLoading: boolean;
}

export function useModelCapability(
  connection: Readonly<ProviderConnection> | Readonly<ConnectionSettings>,
  modelId: string | null,
): UseModelCapabilityResult {
  const resolvedConnection =
    "resolvedBaseUrl" in connection
      ? connection
      : createProviderConnection(connection);
  const debouncedModelId = useDebouncedValue(modelId, 500);
  const isDebouncing = modelId !== debouncedModelId;
  const hasCredentials = resolvedConnection.hasSavedSettings;
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!hasCredentials || !debouncedModelId || !isDebouncing) {
      return;
    }

    void queryClient.cancelQueries({
      queryKey: providerQueryKeys.modelCapability(
        resolvedConnection,
        debouncedModelId,
      ),
    });
  }, [
    debouncedModelId,
    hasCredentials,
    isDebouncing,
    queryClient,
    resolvedConnection,
  ]);

  const query = useQuery({
    queryKey: debouncedModelId
      ? providerQueryKeys.modelCapability(resolvedConnection, debouncedModelId)
      : ["provider", "model-capability", resolvedConnection.cacheKey, "idle"],
    queryFn: async ({ signal }) =>
      probeModelLogprobsSupport(resolvedConnection, debouncedModelId!, signal),
    enabled: hasCredentials && Boolean(debouncedModelId),
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  if (hasCredentials && Boolean(modelId) && isDebouncing) {
    return {
      status: "checking",
      message: null,
      isLoading: true,
    };
  }

  if (query.isLoading || query.isFetching) {
    return {
      status: "checking",
      message: null,
      isLoading: true,
    };
  }

  if (query.isError) {
    return {
      status: "unknown-transient",
      message: (query.error as Error).message,
      isLoading: false,
    };
  }

  return {
    status: query.data?.status ?? "idle",
    message: query.data?.message ?? null,
    isLoading: false,
  };
}
