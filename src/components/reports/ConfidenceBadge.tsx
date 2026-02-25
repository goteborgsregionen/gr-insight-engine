import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ConfidenceBadgeProps {
  sourceCount: number;
}

export function ConfidenceBadge({ sourceCount }: ConfidenceBadgeProps) {
  const level =
    sourceCount >= 3 ? "high" : sourceCount >= 1 ? "medium" : "low";

  const config = {
    high: { color: "bg-emerald-500", label: "Hög konfidens" },
    medium: { color: "bg-amber-500", label: "Medel konfidens" },
    low: { color: "bg-muted-foreground/40", label: "Inga källor" },
  }[level];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`inline-block h-2.5 w-2.5 rounded-full ${config.color}`} />
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {config.label} ({sourceCount} käll{sourceCount === 1 ? "a" : "or"})
      </TooltipContent>
    </Tooltip>
  );
}
