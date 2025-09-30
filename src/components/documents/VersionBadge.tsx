import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface VersionBadgeProps {
  version: number;
  isLatest: boolean;
  className?: string;
}

export function VersionBadge({ version, isLatest, className }: VersionBadgeProps) {
  return (
    <Badge
      variant={isLatest ? "default" : "secondary"}
      className={cn("font-mono", className)}
    >
      v{version}
      {isLatest && " (senaste)"}
    </Badge>
  );
}
