export type EnvironmentTab = 'ready' | 'configure' | 'accounts' | 'local' | 'diagnostics';

interface ModelSelectorProps {
  open: boolean;
}

export function ModelSelector({ open }: ModelSelectorProps): JSX.Element | null {
  if (!open) {
    return null;
  }

  return null;
}
