import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import type { RunParameters } from "@/types/logprob";

interface ParametersDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  parameters: RunParameters;
  onParametersChange: (params: RunParameters) => void;
}

export const ParametersDrawer = ({ isOpen, parameters, onParametersChange, onClose }: ParametersDrawerProps) => {
  const updateParameter = (key: keyof RunParameters, value: number) => {
    onParametersChange({ ...parameters, [key]: value });
  };

  return (
    <Drawer open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DrawerContent className="bg-background">
        <DrawerHeader className="relative">
          <DrawerTitle>Generation Parameters</DrawerTitle>
          <DrawerClose asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2 h-8 w-8"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </DrawerClose>
        </DrawerHeader>

        <div className="px-6 pb-4 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Temperature */}
            <div className="space-y-2">
              <Label htmlFor="temperature">Temperature: {parameters.temperature}</Label>
              <Slider
                id="temperature"
                min={0}
                max={2}
                step={0.1}
                value={[parameters.temperature]}
                onValueChange={([value]) => updateParameter("temperature", value)}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Controls randomness. Higher = more creative, lower = more focused.
              </p>
            </div>

            {/* Top-p */}
            <div className="space-y-2">
              <Label htmlFor="top-p">Top-p: {parameters.top_p}</Label>
              <Slider
                id="top-p"
                min={0}
                max={1}
                step={0.05}
                value={[parameters.top_p]}
                onValueChange={([value]) => updateParameter("top_p", value)}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Nucleus sampling. Controls diversity by probability mass.
              </p>
            </div>

            {/* Max tokens */}
            <div className="space-y-2">
              <Label htmlFor="max-tokens">Max tokens</Label>
              <Input
                id="max-tokens"
                type="number"
                min={1}
                max={256}
                value={parameters.max_tokens}
                onChange={(e) => updateParameter("max_tokens", Math.min(256, Math.max(1, parseInt(e.target.value) || 1)))}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Maximum completion length (capped at 256).
              </p>
            </div>

            {/* Top logprobs */}
            <div className="space-y-2">
              <Label htmlFor="top-logprobs">Top alternatives: {parameters.top_logprobs}</Label>
              <Slider
                id="top-logprobs"
                min={1}
                max={10}
                step={1}
                value={[parameters.top_logprobs]}
                onValueChange={([value]) => updateParameter("top_logprobs", value)}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Number of alternative tokens to show (max 10).
              </p>
            </div>

            {/* Top-k removed */}

            {/* Presence penalty */}
            <div className="space-y-2">
              <Label htmlFor="presence-penalty">Presence penalty: {parameters.presence_penalty}</Label>
              <Slider
                id="presence-penalty"
                min={-2}
                max={2}
                step={0.1}
                value={[parameters.presence_penalty]}
                onValueChange={([value]) => updateParameter("presence_penalty", value)}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Penalizes tokens that appear in the text so far.
              </p>
            </div>

            {/* Frequency penalty */}
            <div className="space-y-2">
              <Label htmlFor="frequency-penalty">Frequency penalty: {parameters.frequency_penalty}</Label>
              <Slider
                id="frequency-penalty"
                min={-2}
                max={2}
                step={0.1}
                value={[parameters.frequency_penalty]}
                onValueChange={([value]) => updateParameter("frequency_penalty", value)}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Penalizes tokens based on their frequency.
              </p>
            </div>
          </div>
          {null}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
