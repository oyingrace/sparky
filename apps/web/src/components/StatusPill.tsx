type StatusPillProps = {
  status: string;
};

export function StatusPill({ status }: StatusPillProps) {
  const normalized = status.toLowerCase().replace(/_/g, " ");
  let variant = "";

  if (status === "open" || status === "active") variant = "pill--open";
  else if (status === "locked") variant = "pill--locked";
  else if (status.includes("success") || status === "resolved")
    variant = "pill--resolved";
  else if (status.includes("fail")) variant = "pill--failed";

  return <span className={`pill ${variant}`}>{normalized}</span>;
}
