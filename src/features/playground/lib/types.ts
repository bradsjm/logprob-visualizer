export interface RequestBlockState {
  readonly kind:
    | "missing-settings"
    | "loading-models"
    | "model-error"
    | "missing-model"
    | "checking-capability"
    | "unsupported-model";
  readonly title: string;
  readonly description: string;
}
