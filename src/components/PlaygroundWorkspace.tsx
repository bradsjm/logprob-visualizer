import { AlertCircle, Loader2 } from "lucide-react";
import { useDeferredValue, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { AnalysisPanel } from "@/components/AnalysisPanel";
import { ChatTranscript } from "@/components/ChatTranscript";
import { Composer, type ComposerHandle } from "@/components/Composer";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { usePlaygroundSession } from "@/features/playground/hooks/usePlaygroundSession";
import { useTokenNavigation } from "@/features/playground/hooks/useTokenNavigation";
import type { RequestBlockState } from "@/features/playground/lib/types";
import { StreamTransport } from "@/lib/transport/stream";
import type { ProviderConnection } from "@/types/connection";
import type { RunParameters } from "@/types/logprob";

interface CapabilityNotice {
  readonly title: string;
  readonly description: string;
}

interface PlaygroundWorkspaceProps {
  readonly connection: ProviderConnection;
  readonly selectedModelId: string | null;
  readonly runParameters: RunParameters;
  readonly setRunParameters: (
    next:
      | Readonly<RunParameters>
      | ((current: Readonly<RunParameters>) => RunParameters),
  ) => void;
  readonly blockState: RequestBlockState | null;
  readonly capabilityNotice: CapabilityNotice | null;
  readonly onOpenSettings: () => void;
}

export function PlaygroundWorkspace({
  connection,
  selectedModelId,
  runParameters,
  setRunParameters,
  blockState,
  capabilityNotice,
  onOpenSettings,
}: PlaygroundWorkspaceProps) {
  const composerRef = useRef<ComposerHandle>(null);
  const resetTokenNavigationRef = useRef<() => void>(() => undefined);
  const [showWhitespaceOverlays, setShowWhitespaceOverlays] = useState(false);
  const [showPunctuationOverlays, setShowPunctuationOverlays] = useState(false);
  const transport = useMemo(() => new StreamTransport(connection), [connection]);
  const session = usePlaygroundSession({
    transport,
    selectedModelId,
    runParameters,
    blockState,
    onRequireSettings: onOpenSettings,
    onFocusComposer: () => composerRef.current?.focus(),
    onResetTokenNavigation: () => resetTokenNavigationRef.current(),
  });
  const tokenNavigation = useTokenNavigation({
    composerRef,
    currentCompletion: session.currentCompletion,
    activeCompletionMessageId: session.activeCompletionMessageId,
    lastLowIndex: session.lastLowIndex,
    onLastLowIndexChange: session.setLastLowIndex,
    onAnnounce: session.setLiveMessage,
  });

  resetTokenNavigationRef.current = tokenNavigation.resetTokenNavigation;

  const deferredCompletion = useDeferredValue(session.currentCompletion);

  return (
    <main className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <div aria-live="polite" className="sr-only" role="status">
          {session.liveMessage}
        </div>
        {blockState ?? capabilityNotice ? (
          <div className="px-6 pt-4">
            <Alert
              variant={
                blockState?.kind === "unsupported-model" ||
                blockState?.kind === "model-error"
                  ? "destructive"
                  : "default"
              }
            >
              {blockState?.kind === "checking-capability" ||
              blockState?.kind === "loading-models" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertTitle>{(blockState ?? capabilityNotice)?.title}</AlertTitle>
              <AlertDescription>
                {(blockState ?? capabilityNotice)?.description}
              </AlertDescription>
            </Alert>
          </div>
        ) : null}
        <ChatTranscript
          messages={session.messages}
          isLoading={session.isLoading}
          onTokenClick={tokenNavigation.handleBranch}
          onRegenerateMessage={session.regenerateMessage}
          regenerableMessageId={session.regenerableMessageId}
          isRegenerateDisabled={session.isLoading || blockState !== null}
          activeCompletionMessageId={session.activeCompletionMessageId}
          highlightedTokenIndex={tokenNavigation.highlightedTokenIndex}
          showWhitespaceOverlays={showWhitespaceOverlays}
          showPunctuationOverlays={showPunctuationOverlays}
        />
        <Composer
          ref={composerRef}
          onSendMessage={session.sendMessage}
          isLoading={session.isLoading}
          isStreaming={session.isStreaming}
          canSubmit={blockState === null}
          blockedSendMessage={blockState?.description ?? null}
          onBlockedSend={() => {
            if (blockState?.kind === "missing-settings") {
              onOpenSettings();
            }
            if (blockState) {
              toast("Cannot send request", {
                description: blockState.description,
              });
            }
          }}
          onCancel={session.cancelStream}
          parameters={runParameters}
          onParametersChange={setRunParameters}
          showWhitespaceOverlays={showWhitespaceOverlays}
          showPunctuationOverlays={showPunctuationOverlays}
          onReadabilityChange={(patch) => {
            if (typeof patch.showWhitespace === "boolean") {
              setShowWhitespaceOverlays(patch.showWhitespace);
            }
            if (typeof patch.showPunctuation === "boolean") {
              setShowPunctuationOverlays(patch.showPunctuation);
            }
          }}
          onClearHistory={session.clearHistory}
        />
      </div>

      <AnalysisPanel
        completion={deferredCompletion}
        isLoadingChart={session.isChartPending}
        onTokenClick={(tokenIndex) => tokenNavigation.scrollToToken(tokenIndex)}
        onTokenHover={tokenNavigation.handleChartHover}
      />
    </main>
  );
}
