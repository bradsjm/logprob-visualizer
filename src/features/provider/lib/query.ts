import type { ProviderConnection } from "@/types/connection";

export const providerQueryKeys = {
  models(connection: Readonly<ProviderConnection>) {
    return ["provider", "models", connection.cacheKey] as const;
  },
  modelCapability(
    connection: Readonly<ProviderConnection>,
    modelId: string,
  ) {
    return [
      "provider",
      "model-capability",
      connection.cacheKey,
      modelId,
    ] as const;
  },
};
