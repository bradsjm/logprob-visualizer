import { useSearchParams } from "react-router-dom";

import {
  buildRunParameterSearchParams,
  parseRunParameters,
  patchRunParameters,
} from "@/features/playground/lib/runParameters";
import type { RunParameters } from "@/types/logprob";

export interface UseRunParametersResult {
  readonly selectedModelId: string | null;
  readonly setSelectedModelId: (
    modelId: string | ((current: string | null) => string | null) | null,
  ) => void;
  readonly runParameters: RunParameters;
  readonly setRunParameters: (
    next:
      | Readonly<RunParameters>
      | ((current: Readonly<RunParameters>) => RunParameters),
  ) => void;
  readonly applyRunParameterPatch: (patch: Partial<RunParameters>) => void;
}

export function useRunParameters(): UseRunParametersResult {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedModelId = searchParams.get("model");
  const runParameters = parseRunParameters(searchParams);

  return {
    selectedModelId,
    setSelectedModelId(next) {
      const currentModelId = searchParams.get("model");
      const nextModelId =
        typeof next === "function" ? next(currentModelId) : next;
      const nextSearchParams = buildRunParameterSearchParams(
        searchParams,
        nextModelId,
        runParameters,
      );

      if (nextSearchParams.toString() !== searchParams.toString()) {
        setSearchParams(nextSearchParams, { replace: true });
      }
    },
    runParameters,
    setRunParameters(next) {
      const nextParameters = patchRunParameters(
        runParameters,
        typeof next === "function" ? next(runParameters) : next,
      );
      const nextSearchParams = buildRunParameterSearchParams(
        searchParams,
        selectedModelId,
        nextParameters,
      );

      if (nextSearchParams.toString() !== searchParams.toString()) {
        setSearchParams(nextSearchParams, { replace: true });
      }
    },
    applyRunParameterPatch(patch) {
      const nextParameters = patchRunParameters(runParameters, patch);
      const nextSearchParams = buildRunParameterSearchParams(
        searchParams,
        selectedModelId,
        nextParameters,
      );

      if (nextSearchParams.toString() !== searchParams.toString()) {
        setSearchParams(nextSearchParams, { replace: true });
      }
    },
  };
}
