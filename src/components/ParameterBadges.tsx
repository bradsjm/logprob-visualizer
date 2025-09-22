import { Badge } from "@/components/ui/badge";
import type { RunParameters } from "@/types/logprob";

interface ParameterBadgesProps {
  parameters: RunParameters;
}

/**
 * Displays the active sampling parameters as compact badges for quick reference.
 */
export const ParameterBadges = ({ parameters }: ParameterBadgesProps) => {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      <Badge variant="secondary" className="text-xs">
        p={parameters.top_p}
      </Badge>
      <Badge variant="secondary" className="text-xs">
        max={parameters.max_completion_tokens}
      </Badge>
      <Badge variant="secondary" className="text-xs">
        top-{parameters.top_logprobs}
      </Badge>
    </div>
  );
};
