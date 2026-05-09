import type { FileBrowserEntry, FileEntryKind } from '../../types/domain';
import type { UiIconName } from '../common/AppIcons';

export function fileIconNameForKind(kind: FileEntryKind): UiIconName {
  if (kind === 'directory') return 'folder';
  if (kind === 'pdf') return 'filePdf';
  if (kind === 'zip') return 'zip';
  if (kind === 'text') return 'fileText';
  if (kind === 'json') return 'fileJson';
  if (kind === 'image') return 'image';
  if (kind === 'code') return 'fileCode';
  if (kind === 'audio') return 'music';
  if (kind === 'video') return 'video';
  return 'file';
}

export function formatFileSize(size?: number): string {
  if (typeof size !== 'number') return 'Pasta';
  if (size < 1024) return `${size} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = size / 1024;
  let unit = units[0];
  for (let index = 1; index < units.length && value >= 1024; index += 1) {
    value /= 1024;
    unit = units[index];
  }
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${unit}`;
}

export function fileKindLabel(entry: Pick<FileBrowserEntry, 'kind' | 'extension' | 'isDirectory'>): string {
  if (entry.isDirectory) return 'Pasta';
  if (entry.kind === 'pdf') return 'PDF';
  if (entry.kind === 'zip') return 'ZIP';
  if (entry.kind === 'json') return 'JSON';
  if (entry.kind === 'image') return 'Imagem';
  if (entry.kind === 'code') return entry.extension ? `Código .${entry.extension}` : 'Código';
  if (entry.kind === 'text') return entry.extension ? `Texto .${entry.extension}` : 'Texto';
  if (entry.kind === 'audio') return 'Áudio';
  if (entry.kind === 'video') return 'Vídeo';
  return entry.extension ? `.${entry.extension}` : 'Arquivo';
}
