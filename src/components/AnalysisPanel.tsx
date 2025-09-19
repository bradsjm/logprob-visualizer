import {
  ChevronDown,
  BarChart,
  Clock,
  Zap,
  AlertCircle,
  Copy,
  FileJson,
  FileDown,
  Loader2,
} from "lucide-react";
import { useState } from "react";

import { LogprobChart } from "./LogprobChart";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "@/components/ui/sonner";
import type { CompletionLP } from "@/types/logprob";
// (legend colors are applied within child components/tooltips)

interface AnalysisPanelProps {
  completion: CompletionLP | null;
  onTokenClick: (tokenIndex: number) => void;
  onTokenHover?: (tokenIndex: number | null) => void;
  isLoadingChart?: boolean;
}

/**
 * Visualizes completion diagnostics, probabilities, and metadata for the active transcript.
 */
export const AnalysisPanel = ({
  completion,
  onTokenClick,
  onTokenHover,
  isLoadingChart,
}: AnalysisPanelProps) => {
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

  const r = (completion.finish_reason || "").toLowerCase();
  const finishReasonClass =
    r === "stop" || r === "end_turn" || r === "completed"
      ? "text-[hsl(var(--success))]"
      : r === "length" || r === "max_completion_tokens"
        ? "text-destructive"
        : r === "content_filter"
          ? "text-[hsl(var(--warning))]"
          : r === "tool_calls"
            ? "text-[hsl(var(--info))]"
            : "text-foreground";

  // Use server-provided usage values directly.

  return (
    <div className="analysis-panel">
      <div className="p-4 space-y-4 overflow-y-auto">
        {/* Legend moved to top */}
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
              <span>
                Dashed underlines indicate tokens with &lt; 50% probability
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Chart */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart className="w-4 h-4" />
              Token Probabilities
              {isLoadingChart ? (
                <span className="ml-2 inline-flex items-center text-muted-foreground text-xs">
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  Rendering analysis…
                </span>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LogprobChart
              tokens={completion.tokens}
              onTokenClick={onTokenClick}
              onTokenHover={onTokenHover}
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
                <div className={`font-medium capitalize ${finishReasonClass}`}>
                  {completion.finish_reason}
                </div>
              </div>
            </div>

            {completion.latency && (
              <div className="pt-2 border-t">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Latency:</span>
                  <span className="font-medium">
                    {formatDuration(completion.latency)}
                  </span>
                </div>
              </div>
            )}

            <div className="pt-2 border-t">
              <div className="flex items-center gap-2 text-sm">
                <Zap className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Model:</span>
                <span className="font-medium font-mono text-xs">
                  {completion.model}
                </span>
              </div>
            </div>

            {/* Export / Copy actions moved here from header */}
            <div className="pt-2 border-t">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm font-medium">Export</div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(completion.text);
                        toast("Copied text", {
                          description: "Completion text copied to clipboard",
                        });
                      } catch (e) {
                        toast("Copy failed", {
                          description: (e as Error).message,
                        });
                      }
                    }}
                    aria-label="Copy completion text"
                  >
                    <Copy className="w-4 h-4 mr-1" /> Copy
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const blob = new Blob(
                        [JSON.stringify(completion, null, 2)],
                        { type: "application/json" },
                      );
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `completion-${Date.now()}.json`;
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                      URL.revokeObjectURL(url);
                    }}
                    aria-label="Download JSON"
                  >
                    <FileJson className="w-4 h-4 mr-1" /> JSON
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const esc = (v: string): string =>
                        `"${v.replace(/"/g, '""')}"`;
                      const header = [
                        "index",
                        "token",
                        "logprob",
                        "prob",
                        "alts",
                      ].join(",");
                      const rows = completion.tokens.map((t) => {
                        const alts =
                          t.top_logprobs?.map((a) => ({
                            token: a.token,
                            logprob: a.logprob,
                            prob: a.prob,
                          })) ?? [];
                        return [
                          t.index,
                          esc(t.token),
                          t.logprob,
                          t.prob,
                          esc(JSON.stringify(alts)),
                        ].join(",");
                      });
                      const csv = [header, ...rows].join("\n");
                      const blob = new Blob([csv], {
                        type: "text/csv;charset=utf-8",
                      });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `completion-${Date.now()}.csv`;
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                      URL.revokeObjectURL(url);
                    }}
                    aria-label="Download CSV"
                  >
                    <FileDown className="w-4 h-4 mr-1" /> CSV
                  </Button>
                </div>
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
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${showRawJson ? "rotate-180" : ""}`}
                  />
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
      </div>
    </div>
  );
};
