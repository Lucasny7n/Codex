export interface RuntimeStatus {
  installed: boolean;
  ready: boolean;
  selectedModelId: string | null;
  loadedModelId: string | null;
  fallbackActive: boolean;
}
