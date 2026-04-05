import { useEffect, useState } from "react";
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
  const [selectedModelId, setSelectedModelIdState] = useState<string | null>(
    () => searchParams.get("model"),
  );
  const [runParameters, setRunParametersState] = useState<RunParameters>(() =>
    parseRunParameters(searchParams),
  );

  useEffect(() => {
    const nextSearchParams = buildRunParameterSearchParams(
      searchParams,
      selectedModelId,
      runParameters,
    );

    if (nextSearchParams.toString() !== searchParams.toString()) {
      setSearchParams(nextSearchParams, { replace: true });
    }
  }, [runParameters, searchParams, selectedModelId, setSearchParams]);

  return {
    selectedModelId,
    setSelectedModelId(next) {
      setSelectedModelIdState((current) => {
        if (typeof next === "function") {
          return next(current);
        }

        return next;
      });
    },
    runParameters,
    setRunParameters(next) {
      setRunParametersState((current) =>
        patchRunParameters(
          current,
          typeof next === "function" ? next(current) : next,
        ),
      );
    },
    applyRunParameterPatch(patch) {
      setRunParametersState((current) => patchRunParameters(current, patch));
    },
  };
}
