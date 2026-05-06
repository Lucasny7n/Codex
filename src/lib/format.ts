export function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

export function shortPath(path: string, keep = 2): string {
  const tokens = path.split('/').filter(Boolean);
  if (tokens.length <= keep) {
    return path;
  }
  return `.../${tokens.slice(-keep).join('/')}`;
}

export function trimMultiline(input: string): string {
  return input
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
}
