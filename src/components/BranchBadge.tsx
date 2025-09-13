import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, GitBranch } from "lucide-react";
import type { BranchContext } from "@/types/logprob";

interface BranchBadgeProps {
  branchContext: BranchContext;
  onClear: () => void;
}

export const BranchBadge = ({ branchContext, onClear }: BranchBadgeProps) => {
  const displayToken = branchContext.newToken.length > 20 
    ? branchContext.newToken.slice(0, 20) + "..." 
    : branchContext.newToken;

  return (
    <Badge variant="outline" className="flex items-center gap-2 pl-2 pr-1">
      <GitBranch className="w-3 h-3" />
      <span className="text-xs">
        Branched at #{branchContext.tokenIndex} with "{displayToken}"
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
        onClick={onClear}
        aria-label="Clear branch"
      >
        <X className="h-2 w-2" />
      </Button>
    </Badge>
  );
};