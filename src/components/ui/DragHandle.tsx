import type { CSSProperties, ReactNode } from 'react';

interface Props {
  dragId: string;
  object?: Record<string, unknown>;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  title?: string;
}

export function DragHandle({ dragId, object, children, className, style, title }: Props) {
  return (
    <div
      data-drag-id={dragId}
      data-drag-object={object ? JSON.stringify(object) : undefined}
      className={className}
      style={style}
      title={title}
    >
      {children}
    </div>
  );
}
