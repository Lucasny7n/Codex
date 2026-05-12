import type { ChatAttachment } from '../../types/domain';

export interface DocumentContext {
  id: string;
  name: string;
  path: string;
  kind: string;
  text: string;
  truncated: boolean;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  documentName: string;
  index: number;
  text: string;
  score?: number;
}

const DOCUMENT_TEXT_LIMIT = 32_000;
const CHUNK_SIZE = 1_200;
const CHUNK_OVERLAP = 180;
const SECRET_PATTERNS: RegExp[] = [
  /\bsk-[A-Za-z0-9_-]{12,}\b/gu,
  /\brk-[A-Za-z0-9_-]{12,}\b/gu,
  /\bAIza[A-Za-z0-9_-]{12,}\b/gu,
  /\b(?:api[_-]?key|token|secret|password)\s*[:=]\s*["']?[^"'\s]{8,}/giu,
];

export function redactDocumentSecrets(input: string): string {
  return SECRET_PATTERNS.reduce((text, pattern) => text.replace(pattern, '[segredo-mascarado]'), input);
}

export function documentContextsFromAttachments(attachments: ChatAttachment[]): DocumentContext[] {
  return attachments
    .filter((attachment) => attachment.contextSource !== 'preset' && attachment.contextSource !== 'project_memory')
    .map((attachment) => {
      const raw = attachment.contextText ?? attachment.previewTextLimited ?? '';
      const limited = raw.length > DOCUMENT_TEXT_LIMIT ? raw.slice(0, DOCUMENT_TEXT_LIMIT) : raw;
      return {
        id: attachment.path,
        name: attachment.name,
        path: attachment.path,
        kind: attachment.kind,
        text: redactDocumentSecrets(limited),
        truncated: raw.length > DOCUMENT_TEXT_LIMIT,
      };
    })
    .filter((document) => document.text.trim().length > 0);
}

export function chunkDocumentText(document: DocumentContext): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];
  const text = document.text.trim();
  if (!text) return chunks;

  for (let start = 0; start < text.length; start += CHUNK_SIZE - CHUNK_OVERLAP) {
    const part = text.slice(start, start + CHUNK_SIZE).trim();
    if (!part) continue;
    chunks.push({
      id: `${document.id}#${chunks.length}`,
      documentId: document.id,
      documentName: document.name,
      index: chunks.length,
      text: part,
    });
    if (start + CHUNK_SIZE >= text.length) break;
  }
  return chunks;
}

export function indexDocumentChunks(attachments: ChatAttachment[]): DocumentChunk[] {
  return documentContextsFromAttachments(attachments).flatMap(chunkDocumentText);
}

export function searchDocumentChunks(query: string, chunks: DocumentChunk[], limit = 4): DocumentChunk[] {
  const terms = lexicalTerms(query);
  if (terms.length === 0) return chunks.slice(0, limit);
  return chunks
    .map((chunk) => ({
      ...chunk,
      score: terms.reduce((score, term) => score + occurrences(chunk.text.toLowerCase(), term), 0),
    }))
    .filter((chunk) => (chunk.score ?? 0) > 0)
    .sort((left, right) => (right.score ?? 0) - (left.score ?? 0) || left.index - right.index)
    .slice(0, limit);
}

export function buildDocumentPromptContext(prompt: string, attachments: ChatAttachment[]): string {
  const chunks = searchDocumentChunks(prompt, indexDocumentChunks(attachments));
  if (chunks.length === 0) return '';
  return chunks
    .map((chunk) => `[documento: ${chunk.documentName} | chunk ${chunk.index + 1}]\n${chunk.text}`)
    .join('\n\n');
}

function lexicalTerms(query: string): string[] {
  return Array.from(new Set(
    query
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .split(/[^a-z0-9_.-]+/u)
      .map((term) => term.trim())
      .filter((term) => term.length >= 3),
  ));
}

function occurrences(text: string, term: string): number {
  let count = 0;
  let index = text.indexOf(term);
  while (index !== -1) {
    count += 1;
    index = text.indexOf(term, index + term.length);
  }
  return count;
}
