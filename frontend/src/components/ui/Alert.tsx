import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";

type AlertTone = "info" | "success" | "warning" | "danger";

const TONES: Record<AlertTone, { wrap: string; icon: typeof Info }> = {
  info: { wrap: "border-secondary/30 bg-secondary/10 text-secondary", icon: Info },
  success: { wrap: "border-success/30 bg-success/10 text-success", icon: CheckCircle2 },
  warning: { wrap: "border-warning/30 bg-warning/10 text-warning", icon: AlertTriangle },
  danger: { wrap: "border-danger/30 bg-danger/10 text-danger", icon: XCircle },
};

/**
 * Inline status banner used for form errors and confirmations.
 */
export function Alert({
  tone = "info",
  children,
  className,
}: {
  tone?: AlertTone;
  children: React.ReactNode;
  className?: string;
}) {
  const { wrap, icon: Icon } = TONES[tone];
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm",
        wrap,
        className,
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="text-foreground/90">{children}</span>
    </div>
  );
}
