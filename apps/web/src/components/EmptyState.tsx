import Link from "next/link";

type EmptyStateProps = {
  title: string;
  body: string;
  actionLabel?: string;
  actionHref?: string;
};

export function EmptyState({
  title,
  body,
  actionLabel,
  actionHref,
}: EmptyStateProps) {
  return (
    <div className="empty-state">
      <p className="empty-state__title">{title}</p>
      <p className="empty-state__body">{body}</p>
      {actionLabel && actionHref && (
        <Link href={actionHref} className="primary-btn">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
