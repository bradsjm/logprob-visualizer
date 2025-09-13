import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { ModelInfo } from "@/types/logprob";

interface ModelSelectorProps {
  selectedModel: ModelInfo;
  onModelChange: (model: ModelInfo) => void;
}

const AVAILABLE_MODELS: ModelInfo[] = [
  { id: "gpt-4o", name: "GPT-4", supportsTopK: false },
  { id: "gpt-4o-mini", name: "GPT-4 Mini", supportsTopK: false },
  { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo", supportsTopK: false },
];

export const ModelSelector = ({ selectedModel, onModelChange }: ModelSelectorProps) => {
  return (
    <div className="flex items-center gap-2">
      <Select
        value={selectedModel.id}
        onValueChange={(modelId) => {
          const model = AVAILABLE_MODELS.find(m => m.id === modelId);
          if (model) {
            onModelChange(model);
          }
        }}
      >
        <SelectTrigger className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {AVAILABLE_MODELS.map((model) => (
            <SelectItem key={model.id} value={model.id}>
              <div className="flex items-center justify-between w-full">
                <span>{model.name}</span>
                {model.supportsTopK && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    Top-K
                  </Badge>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      {!selectedModel.supportsTopK && (
        <Badge variant="outline" className="text-xs">
          No Top-K
        </Badge>
      )}
    </div>
  );
};