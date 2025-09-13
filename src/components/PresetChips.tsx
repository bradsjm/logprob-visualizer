import { Button } from "@/components/ui/button";
import type { RunParameters } from "@/types/logprob";

export interface PresetChipsProps {
  readonly onApplyPreset: (patch: Partial<RunParameters>) => void;
}

/**
 * Small preset chip buttons for quick parameter changes.
 * Local state only; no network or persistence.
 */
export const PresetChips = ({ onApplyPreset }: PresetChipsProps) => {
  const applyDeterministic = () => onApplyPreset({ temperature: 0, top_p: 1 });
  const applyCreative = () => onApplyPreset({ temperature: 1.2, top_p: 1 });

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        className="h-8 px-2 text-xs"
        onClick={applyDeterministic}
        aria-label="Apply Deterministic preset"
      >
        Deterministic
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-8 px-2 text-xs"
        onClick={applyCreative}
        aria-label="Apply Creative preset"
      >
        Creative
      </Button>
    </div>
  );
};
