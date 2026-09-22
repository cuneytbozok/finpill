import { useId } from "react";

import type { ReactNode } from "react";

type StateProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

export function LoadingSkeleton({
  label = "İçerik yükleniyor",
}: {
  label?: string;
}) {
  return (
    <div
      aria-busy="true"
      aria-label={label}
      className="skeleton-stack"
      role="status"
    >
      <span className="skeleton skeleton-title" />
      <span className="skeleton skeleton-line" />
      <span className="skeleton skeleton-line skeleton-line-short" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function EmptyState({ title, description, action }: StateProps) {
  const titleId = useId();
  return (
    <section className="state-card" aria-labelledby={titleId}>
      <p className="eyebrow">Henüz veri yok</p>
      <h2 id={titleId}>{title}</h2>
      <p>{description}</p>
      {action}
    </section>
  );
}

export function ErrorState({ title, description, action }: StateProps) {
  const titleId = useId();
  return (
    <section
      className="state-card state-card-error"
      aria-labelledby={titleId}
      role="alert"
    >
      <p className="eyebrow">Veri alınamadı</p>
      <h2 id={titleId}>{title}</h2>
      <p>{description}</p>
      {action}
    </section>
  );
}

export function StaleBadge({ children }: { children: ReactNode }) {
  return <span className="freshness-badge">{children}</span>;
}
