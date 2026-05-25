export type ProviderDomain = 'cloud' | 'local';

export interface ProviderProductConfig {
  id: string;
  label: string;
  domain: ProviderDomain;
  auth: 'api_key' | 'oauth' | 'cli' | 'local_runtime' | 'custom_endpoint';
  statusPolicy: string;
  secretPolicy: string;
}

export const providerProductConfig: ProviderProductConfig[] = [
  {
    id: 'openai-api',
    label: 'OpenAI API',
    domain: 'cloud',
    auth: 'api_key',
    statusPolicy: 'Ready only after a real connection test succeeds.',
    secretPolicy: 'Store through CredentialStore/keyring abstraction; never log raw API keys.',
  },
  {
    id: 'anthropic-api',
    label: 'Anthropic API',
    domain: 'cloud',
    auth: 'api_key',
    statusPolicy: 'Configured credentials enter testing until validated by the provider adapter.',
    secretPolicy: 'Mask keys in UI and persist only through the credential abstraction.',
  },
  {
    id: 'gemini-api',
    label: 'Google Gemini API',
    domain: 'cloud',
    auth: 'api_key',
    statusPolicy: 'Requires explicit test before model selection.',
    secretPolicy: 'Do not expose keys in error messages, screenshots or exports.',
  },
  {
    id: 'openai-compatible',
    label: 'OpenAI-compatible endpoint',
    domain: 'cloud',
    auth: 'custom_endpoint',
    statusPolicy: 'Endpoint, model id and credential must be tested together.',
    secretPolicy: 'Endpoint URLs may be visible; credentials remain masked.',
  },
  {
    id: 'local-ollama',
    label: 'Local Ollama',
    domain: 'local',
    auth: 'local_runtime',
    statusPolicy: 'Installed models must come from /api/tags or ollama list and pass generation tests.',
    secretPolicy: 'No cloud credential is used for local Ollama routing.',
  },
];
