import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Circle } from "lucide-react";

interface GapItem {
  area: string;
  localLevel: string;
  nationalLevel: string;
  gap: string;
  gapType: string;
  severity: "high" | "medium" | "low";
}

interface GapAnalysisProgressProps {
  gapAnalysisMarkdown: string;
}

function parseGapTable(markdown: string): GapItem[] {
  const items: GapItem[] = [];
  const lines = markdown.split("\n").filter(l => l.trim().startsWith("|"));
  
  // Skip header and separator rows
  const dataLines = lines.filter(l => !l.includes("---") && !l.toLowerCase().includes("område"));
  
  for (const line of dataLines) {
    const cells = line.split("|").map(c => c.trim()).filter(Boolean);
    if (cells.length >= 4) {
      const gapText = cells[3] || "";
      let severity: "high" | "medium" | "low" = "medium";
      if (/kritisk|akut|saknas helt|stor brist/i.test(gapText)) severity = "high";
      else if (/marginell|liten|nästan/i.test(gapText)) severity = "low";
      
      const gapTypeMatch = gapText.match(/(genomförande|finansiering|kompetens|process|tekniskt|resurs)/i);
      
      items.push({
        area: cells[0],
        localLevel: cells[1],
        nationalLevel: cells[2],
        gap: gapText,
        gapType: gapTypeMatch?.[0] || "Generellt",
        severity,
      });
    }
  }
  return items;
}

export function GapAnalysisProgress({ gapAnalysisMarkdown }: GapAnalysisProgressProps) {
  const gaps = parseGapTable(gapAnalysisMarkdown);
  
  if (gaps.length === 0) return null;

  const severityCounts = {
    high: gaps.filter(g => g.severity === "high").length,
    medium: gaps.filter(g => g.severity === "medium").length,
    low: gaps.filter(g => g.severity === "low").length,
  };

  const totalScore = gaps.reduce((sum, g) => {
    if (g.severity === "low") return sum + 80;
    if (g.severity === "medium") return sum + 50;
    return sum + 20;
  }, 0);
  const avgProgress = Math.round(totalScore / gaps.length);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span>Gap-analys Framsteg</span>
          <Badge variant="outline" className="text-xs font-normal">
            {gaps.length} identifierade gap
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall progress */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Övergripande gap-täckning</span>
            <span>{avgProgress}%</span>
          </div>
          <Progress value={avgProgress} className="h-2" />
        </div>

        {/* Severity breakdown */}
        <div className="flex gap-3 text-xs">
          <div className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-destructive" />
            <span>{severityCounts.high} kritiska</span>
          </div>
          <div className="flex items-center gap-1">
            <Circle className="h-3 w-3 text-secondary" />
            <span>{severityCounts.medium} medel</span>
          </div>
          <div className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-accent" />
            <span>{severityCounts.low} låga</span>
          </div>
        </div>

        {/* Per-gap items */}
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {gaps.map((gap, idx) => {
            const progress = gap.severity === "low" ? 80 : gap.severity === "medium" ? 50 : 20;
            return (
              <div key={idx} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium truncate max-w-[180px]" title={gap.area}>
                    {gap.area}
                  </span>
                  <Badge
                    variant={gap.severity === "high" ? "destructive" : gap.severity === "medium" ? "secondary" : "default"}
                    className="text-[10px] h-4 px-1.5"
                  >
                    {gap.gapType}
                  </Badge>
                </div>
                <Progress value={progress} className="h-1.5" />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
