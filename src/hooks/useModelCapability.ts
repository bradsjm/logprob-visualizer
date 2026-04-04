import { useQuery } from "@tanstack/react-query";

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
  const query = useQuery({
    queryKey: [
      "model-capability",
      getConnectionCacheKey(settings),
      modelId,
    ],
    queryFn: async () => probeModelLogprobsSupport(settings, modelId!),
    enabled: settings.apiKey.trim().length > 0 && Boolean(modelId),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
  });

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
