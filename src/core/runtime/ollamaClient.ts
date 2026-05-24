export interface OllamaModelInfo {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
}

export interface OllamaTagsResponse {
  models: OllamaModelInfo[];
}

export interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  stream?: boolean;
}

export interface OllamaGenerateResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
}

const OLLAMA_BASE_URL = 'http://localhost:11434';

export async function checkOllamaStatus(): Promise<boolean> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
    return response.ok;
  } catch {
    return false;
  }
}

export async function getOllamaModels(): Promise<string[]> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
    if (!response.ok) return [];
    const data = await response.json() as OllamaTagsResponse;
    return data.models.map(m => m.name);
  } catch {
    return [];
  }
}

export async function generateOllamaText(model: string, prompt: string): Promise<string> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
      } as OllamaGenerateRequest),
    });

    if (!response.ok) {
      throw new Error(`Ollama HTTP error! status: ${response.status}`);
    }

    const data = await response.json() as OllamaGenerateResponse;
    return data.response;
  } catch (error) {
    throw new Error(`Erro ao gerar com Ollama: ${error instanceof Error ? error.message : String(error)}`);
  }
}
