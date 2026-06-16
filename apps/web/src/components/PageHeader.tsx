type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  lead?: string;
  action?: React.ReactNode;
};

export function PageHeader({ eyebrow, title, lead, action }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div className="page-header__row">
        <div>
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          <h1 className="page-title">{title}</h1>
          {lead && <p className="page-lead">{lead}</p>}
        </div>
        {action}
      </div>
    </header>
  );
}
