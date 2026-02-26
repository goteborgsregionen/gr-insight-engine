import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

interface TrendChartProps {
  temporalYears?: number[];
  claimsPosts?: Array<{
    claim_type: string;
    confidence_score?: number;
    kpi_tags?: string[];
    text: string;
  }>;
  kpiConflictsCount?: number;
}

export function TrendChart({ temporalYears, claimsPosts, kpiConflictsCount }: TrendChartProps) {
  if (!temporalYears || temporalYears.length < 2) return null;

  // Build chart data: count evidence/claims per year
  const chartData = temporalYears.map(year => {
    const yearStr = String(year);
    const relevantClaims = (claimsPosts || []).filter(c => c.text.includes(yearStr));
    const avgConfidence = relevantClaims.length > 0
      ? Math.round(relevantClaims.reduce((s, c) => s + (c.confidence_score || 50), 0) / relevantClaims.length)
      : 0;

    return {
      year: yearStr,
      claims: relevantClaims.length,
      confidence: avgConfidence,
    };
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Temporal Trendanalys
        </CardTitle>
        <div className="flex gap-2">
          <Badge variant="outline" className="text-xs">
            {temporalYears.length} år
          </Badge>
          {kpiConflictsCount != null && kpiConflictsCount > 0 && (
            <Badge variant="destructive" className="text-xs">
              {kpiConflictsCount} KPI-konflikter
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorClaims" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorConfidence" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="year" className="text-xs" tick={{ fontSize: 11 }} />
              <YAxis className="text-xs" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  borderColor: "hsl(var(--border))",
                  borderRadius: "var(--radius)",
                  fontSize: 12,
                }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
              />
              <Area
                type="monotone"
                dataKey="claims"
                name="Påståenden"
                stroke="hsl(var(--primary))"
                fill="url(#colorClaims)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="confidence"
                name="Snitt konfidens"
                stroke="hsl(var(--accent))"
                fill="url(#colorConfidence)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
