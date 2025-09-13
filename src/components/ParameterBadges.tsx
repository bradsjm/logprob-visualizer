import { Badge } from "@/components/ui/badge";
import type { RunParameters } from "@/types/logprob";

interface ParameterBadgesProps {
  parameters: RunParameters;
}

export const ParameterBadges = ({ parameters }: ParameterBadgesProps) => {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      <Badge variant="secondary" className="text-xs">
        T={parameters.temperature}
      </Badge>
      <Badge variant="secondary" className="text-xs">
        p={parameters.top_p}
      </Badge>
      {parameters.top_k && (
        <Badge variant="secondary" className="text-xs">
          k={parameters.top_k}
        </Badge>
      )}
      <Badge variant="secondary" className="text-xs">
        max={parameters.max_tokens}
      </Badge>
      <Badge variant="secondary" className="text-xs">
        top-{parameters.top_logprobs}
      </Badge>
      {(parameters.presence_penalty !== 0 || parameters.frequency_penalty !== 0) && (
        <Badge variant="outline" className="text-xs">
          penalties
        </Badge>
      )}
    </div>
  );
};