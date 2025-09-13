import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { LogprobChart } from "./LogprobChart";
import { ChevronDown, BarChart, Clock, Zap, AlertCircle } from "lucide-react";
import type { CompletionLP } from "@/types/logprob";

interface AnalysisPanelProps {
  completion: CompletionLP | null;
  onTokenClick: (tokenIndex: number) => void;
}

export const AnalysisPanel = ({ completion, onTokenClick }: AnalysisPanelProps) => {
  const [showRawJson, setShowRawJson] = useState(false);

  if (!completion) {
    return (
      <div className="analysis-panel">
        <div className="p-6 text-center text-muted-foreground">
          <BarChart className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-sm">Generate a completion to see analysis</p>
        </div>
      </div>
    );
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="analysis-panel">
      <div className="p-4 space-y-4 overflow-y-auto">
        {/* Chart */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart className="w-4 h-4" />
              Token Probabilities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LogprobChart 
              tokens={completion.tokens}
              onTokenClick={onTokenClick}
            />
          </CardContent>
        </Card>

        {/* Stats */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Statistics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="space-y-1">
                <div className="text-muted-foreground">Prompt tokens</div>
                <div className="font-medium">{completion.usage.prompt_tokens}</div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">Completion tokens</div>
                <div className="font-medium">{completion.usage.completion_tokens}</div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">Total tokens</div>
                <div className="font-medium">{completion.usage.total_tokens}</div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">Finish reason</div>
                <div className="font-medium capitalize">{completion.finish_reason}</div>
              </div>
            </div>

            {completion.latency && (
              <div className="pt-2 border-t">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Latency:</span>
                  <span className="font-medium">{formatDuration(completion.latency)}</span>
                </div>
              </div>
            )}

            <div className="pt-2 border-t">
              <div className="flex items-center gap-2 text-sm">
                <Zap className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Model:</span>
                <span className="font-medium font-mono text-xs">{completion.model}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Raw JSON */}
        <Card>
          <Collapsible open={showRawJson} onOpenChange={setShowRawJson}>
            <CollapsibleTrigger asChild>
              <CardHeader className="pb-3 cursor-pointer hover:bg-surface/50 transition-colors">
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                  <span>Raw Response</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showRawJson ? "rotate-180" : ""}`} />
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <div className="text-xs font-mono bg-muted p-3 rounded overflow-auto max-h-64">
                  <pre className="whitespace-pre-wrap">
                    {JSON.stringify(completion, null, 2)}
                  </pre>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        {/* Legend */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Color Legend</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-4 h-3 bg-token-high/15 border border-token-high/30 rounded"></div>
                <span>High probability (&gt; 75th percentile)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-3 bg-token-med-high/15 border border-token-med-high/30 rounded"></div>
                <span>Medium-high probability</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-3 bg-token-med-low/15 border border-token-med-low/30 rounded"></div>
                <span>Medium-low probability</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-3 bg-token-low/15 border-b-2 border-dashed border-token-low rounded"></div>
                <span>Low probability (&lt; 25th percentile)</span>
              </div>
            </div>
            <div className="pt-2 border-t text-xs text-muted-foreground flex items-start gap-2">
              <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span>Dashed underlines indicate tokens with &lt; 50% probability</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};