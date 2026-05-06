import clsx from 'clsx';
import type { ReactNode } from 'react';

interface BadgeProps {
  tone?: 'neutral' | 'info' | 'warn' | 'danger' | 'ok';
  children: ReactNode;
}

export function Badge({ tone = 'neutral', children }: BadgeProps): JSX.Element {
  return <span className={clsx('badge', `badge-${tone}`)}>{children}</span>;
}
