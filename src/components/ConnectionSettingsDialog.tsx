import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resolveBaseUrl, validateBaseUrl } from "@/lib/connection";
import type { ConnectionSettings } from "@/types/connection";

interface ConnectionSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: Readonly<ConnectionSettings>;
  resolvedBaseUrl: string;
  onSave: (settings: Readonly<ConnectionSettings>) => void;
  onClear: () => void;
}

export function ConnectionSettingsDialog({
  open,
  onOpenChange,
  settings,
  resolvedBaseUrl,
  onSave,
  onClear,
}: ConnectionSettingsDialogProps) {
  const [draft, setDraft] = useState<ConnectionSettings>(settings);

  useEffect(() => {
    if (open) {
      setDraft(settings);
    }
  }, [open, settings]);

  const baseUrlError = validateBaseUrl(draft.baseUrl);
  const canSave = draft.apiKey.trim().length > 0 && !baseUrlError;
  const nextResolvedBaseUrl = resolveBaseUrl(draft.baseUrl);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connection Settings</DialogTitle>
          <DialogDescription>
            Your API key is stored locally in this browser. A blank base URL
            uses the default OpenAI API.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="api-key">API key</Label>
            <Input
              id="api-key"
              autoComplete="off"
              placeholder="sk-..."
              type="password"
              value={draft.apiKey}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, apiKey: event.target.value }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="base-url">Base URL</Label>
            <Input
              id="base-url"
              autoComplete="off"
              placeholder="https://api.openai.com/v1"
              value={draft.baseUrl}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, baseUrl: event.target.value }))
              }
            />
            <p className="text-xs text-muted-foreground">
              Resolved API base: {nextResolvedBaseUrl || resolvedBaseUrl}
            </p>
            {baseUrlError ? (
              <p className="text-xs text-destructive">{baseUrlError}</p>
            ) : null}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onClear();
              onOpenChange(false);
            }}
          >
            Clear
          </Button>
          <Button
            type="button"
            disabled={!canSave}
            onClick={() => {
              onSave(draft);
              onOpenChange(false);
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
