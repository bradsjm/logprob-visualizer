import type { RunParameters } from "@/types/logprob";

export type RunParameterKey = keyof RunParameters;
export type RunParameterControl = "slider" | "number";

export interface RunParameterDefinition<TKey extends RunParameterKey = RunParameterKey> {
  readonly key: TKey;
  readonly label: string;
  readonly description: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly control: RunParameterControl;
  readonly formatValue: (value: number) => string;
  readonly normalizeValue: (value: number) => number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function formatDecimal(value: number): string {
  return value.toFixed(2);
}

function formatInteger(value: number): string {
  return String(Math.round(value));
}

const buildDefinition = <TKey extends RunParameterKey>(
  definition: RunParameterDefinition<TKey>,
): RunParameterDefinition<TKey> => definition;

export const RUN_PARAMETER_DEFINITIONS = [
  buildDefinition({
    key: "temperature",
    label: "Temperature",
    description:
      "Controls randomness. Higher = more creative, lower = more focused.",
    min: 0,
    max: 2,
    step: 0.1,
    control: "slider",
    formatValue: formatDecimal,
    normalizeValue: (value) => clamp(value, 0, 2),
  }),
  buildDefinition({
    key: "top_p",
    label: "Top-p",
    description:
      "Limits choices to the most likely words; lower stays safe, higher invites more variety.",
    min: 0,
    max: 1,
    step: 0.05,
    control: "slider",
    formatValue: formatDecimal,
    normalizeValue: (value) => clamp(value, 0, 1),
  }),
  buildDefinition({
    key: "max_completion_tokens",
    label: "Max completion tokens",
    description: "Maximum completion length (capped at 256).",
    min: 1,
    max: 256,
    step: 1,
    control: "number",
    formatValue: formatInteger,
    normalizeValue: (value) => Math.round(clamp(value, 1, 256)),
  }),
  buildDefinition({
    key: "top_logprobs",
    label: "Top alternatives",
    description: "Number of alternative tokens to show (max 10).",
    min: 1,
    max: 10,
    step: 1,
    control: "slider",
    formatValue: formatInteger,
    normalizeValue: (value) => Math.round(clamp(value, 1, 10)),
  }),
  buildDefinition({
    key: "presence_penalty",
    label: "Presence penalty",
    description:
      "Encourage fresh topics. Increase to avoid repeating the same ideas.",
    min: -2,
    max: 2,
    step: 0.1,
    control: "slider",
    formatValue: formatDecimal,
    normalizeValue: (value) => clamp(value, -2, 2),
  }),
  buildDefinition({
    key: "frequency_penalty",
    label: "Frequency penalty",
    description:
      "Rein in repeated words. Higher values cut down on echoing phrases.",
    min: -2,
    max: 2,
    step: 0.1,
    control: "slider",
    formatValue: formatDecimal,
    normalizeValue: (value) => clamp(value, -2, 2),
  }),
] as const satisfies readonly RunParameterDefinition[];

const RUN_PARAMETER_DEFINITION_MAP = new Map(
  RUN_PARAMETER_DEFINITIONS.map((definition) => [definition.key, definition]),
);

export const DEFAULT_RUN_PARAMETERS: Readonly<RunParameters> = Object.freeze({
  temperature: 0.7,
  top_p: 1.0,
  max_completion_tokens: 128,
  top_logprobs: 5,
  presence_penalty: 0,
  frequency_penalty: 0,
});

export function getRunParameterDefinition<TKey extends RunParameterKey>(
  key: TKey,
): RunParameterDefinition<TKey> {
  return RUN_PARAMETER_DEFINITION_MAP.get(key)! as RunParameterDefinition<TKey>;
}

export function normalizeRunParameter<TKey extends RunParameterKey>(
  key: TKey,
  rawValue: number,
): RunParameters[TKey] {
  return getRunParameterDefinition(key).normalizeValue(rawValue);
}

export function sanitizeRunParameters(
  parameters: Readonly<RunParameters>,
): RunParameters {
  return {
    temperature: normalizeRunParameter("temperature", parameters.temperature),
    top_p: normalizeRunParameter("top_p", parameters.top_p),
    max_completion_tokens: normalizeRunParameter(
      "max_completion_tokens",
      parameters.max_completion_tokens,
    ),
    top_logprobs: normalizeRunParameter("top_logprobs", parameters.top_logprobs),
    presence_penalty: normalizeRunParameter(
      "presence_penalty",
      parameters.presence_penalty,
    ),
    frequency_penalty: normalizeRunParameter(
      "frequency_penalty",
      parameters.frequency_penalty,
    ),
  };
}

export function parseRunParameters(
  searchParams: Readonly<URLSearchParams>,
): RunParameters {
  const parsed = { ...DEFAULT_RUN_PARAMETERS };

  for (const definition of RUN_PARAMETER_DEFINITIONS) {
    const rawValue = searchParams.get(definition.key);
    if (rawValue === null) {
      continue;
    }

    const numericValue = Number(rawValue);
    if (!Number.isFinite(numericValue)) {
      continue;
    }

    parsed[definition.key] = definition.normalizeValue(
      numericValue,
    ) as RunParameters[typeof definition.key];
  }

  return parsed;
}

export function buildRunParameterSearchParams(
  currentSearchParams: Readonly<URLSearchParams>,
  selectedModelId: string | null,
  parameters: Readonly<RunParameters>,
): URLSearchParams {
  const nextSearchParams = new URLSearchParams(currentSearchParams);

  if (selectedModelId) {
    nextSearchParams.set("model", selectedModelId);
  } else {
    nextSearchParams.delete("model");
  }

  for (const definition of RUN_PARAMETER_DEFINITIONS) {
    nextSearchParams.set(
      definition.key,
      definition.formatValue(parameters[definition.key]),
    );
  }

  return nextSearchParams;
}

export function patchRunParameters(
  current: Readonly<RunParameters>,
  patch: Partial<RunParameters>,
): RunParameters {
  return sanitizeRunParameters({
    ...current,
    ...patch,
  });
}
