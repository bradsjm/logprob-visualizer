import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { getConnectionCacheKey } from "@/lib/connection";
import { probeModelLogprobsSupport } from "@/lib/openai";
import type { ConnectionSettings, ModelCapability } from "@/types/connection";

export interface UseModelCapabilityResult extends ModelCapability {
  isLoading: boolean;
}

export function useModelCapability(
  settings: Readonly<ConnectionSettings>,
  modelId: string | null,
): UseModelCapabilityResult {
  const debouncedModelId = useDebouncedValue(modelId, 500);
  const isDebouncing = modelId !== debouncedModelId;
  const hasCredentials = settings.apiKey.trim().length > 0;
  const queryClient = useQueryClient();
  const connectionCacheKey = getConnectionCacheKey(settings);

  useEffect(() => {
    if (!hasCredentials || !debouncedModelId || !isDebouncing) {
      return;
    }

    void queryClient.cancelQueries({
      queryKey: [
        "model-capability",
        connectionCacheKey,
        debouncedModelId,
      ],
    });
  }, [
    connectionCacheKey,
    debouncedModelId,
    hasCredentials,
    isDebouncing,
    queryClient,
  ]);

  const query = useQuery({
    queryKey: [
      "model-capability",
      connectionCacheKey,
      debouncedModelId,
    ],
    queryFn: async ({ signal }) =>
      probeModelLogprobsSupport(settings, debouncedModelId!, signal),
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
