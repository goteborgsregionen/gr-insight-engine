import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, AlertCircle } from "lucide-react";

interface TestStep {
  id: string;
  title: string;
  description: string;
  status: "pending" | "in-progress" | "completed" | "failed";
  details?: string;
}

interface Sprint1TestGuideProps {
  testResults: {
    hasClaims: boolean;
    hasEvidence: boolean;
    hasReasoningSteps: boolean;
    hasEvidenceStatements: boolean;
    claimsCount?: number;
    evidenceCount?: number;
    reasoningStepsCount?: number;
    evidenceStatementsCount?: number;
  } | null;
}

export function Sprint1TestGuide({ testResults }: Sprint1TestGuideProps) {
  const getStepStatus = (check: boolean | undefined): "completed" | "failed" | "pending" => {
    if (check === undefined) return "pending";
    return check ? "completed" : "failed";
  };

  const steps: TestStep[] = [
    {
      id: "claims",
      title: "Claims genererade",
      description: "Verifierar att strukturerade påståenden skapades från evidens",
      status: getStepStatus(testResults?.hasClaims),
      details: testResults?.claimsCount ? `${testResults.claimsCount} claims hittades` : undefined,
    },
    {
      id: "evidence",
      title: "Evidence extraherad",
      description: "Kontrollerar att tabeller och nyckeltal extraherades från dokumenten",
      status: getStepStatus(testResults?.hasEvidence),
      details: testResults?.evidenceCount ? `${testResults.evidenceCount} evidence poster` : undefined,
    },
    {
      id: "reasoning",
      title: "Chain-of-Thought reasoning",
      description: "AI:ns tankeprocess dokumenterad i reasoning_steps",
      status: getStepStatus(testResults?.hasReasoningSteps),
      details: testResults?.reasoningStepsCount ? `${testResults.reasoningStepsCount} reasoning steg` : undefined,
    },
    {
      id: "evidence_statements",
      title: "Evidensbaserade påståenden",
      description: "Rapportpåståenden med direkta evidenshänvisningar",
      status: getStepStatus(testResults?.hasEvidenceStatements),
      details: testResults?.evidenceStatementsCount ? `${testResults.evidenceStatementsCount} evidensbaserade påståenden` : undefined,
    },
  ];

  const allCompleted = steps.every(s => s.status === "completed");
  const anyFailed = steps.some(s => s.status === "failed");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Sprint 1 Test Guide
          {allCompleted && <Badge variant="default">✓ Alla tester passerade</Badge>}
          {anyFailed && <Badge variant="destructive">Några tester misslyckades</Badge>}
        </CardTitle>
        <CardDescription>
          Verifiera att Sprint 1-förbättringarna fungerar korrekt
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-2">
          <h4 className="font-semibold text-sm">📋 Så här testar du:</h4>
          <ol className="text-sm space-y-1 list-decimal list-inside text-muted-foreground">
            <li>Välj <strong>minst 2 dokument</strong> (aktiverar automatiskt strategic analysis)</li>
            <li>Starta analysen och vänta tills den är klar</li>
            <li>Kontrollera testresultaten nedan</li>
            <li>Verifiera att rapporten innehåller evidenshänvisningar som [E-001]</li>
          </ol>
        </div>

        {!testResults && (
          <div className="bg-muted/50 border rounded-lg p-6 text-center">
            <Circle className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Väntar på testresultat... Skapa en ny strategic analys för att börja testa.
            </p>
          </div>
        )}

        {testResults && (
          <div className="space-y-3">
            {steps.map((step) => (
              <div
                key={step.id}
                className="flex items-start gap-3 p-3 border rounded-lg"
              >
                {step.status === "completed" && (
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-500 flex-shrink-0 mt-0.5" />
                )}
                {step.status === "failed" && (
                  <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                )}
                {step.status === "pending" && (
                  <Circle className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                )}
                
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-sm">{step.title}</h4>
                    <Badge
                      variant={
                        step.status === "completed"
                          ? "default"
                          : step.status === "failed"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {step.status === "completed"
                        ? "Pass"
                        : step.status === "failed"
                        ? "Fail"
                        : "Pending"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                  {step.details && (
                    <p className="text-xs font-mono text-primary">{step.details}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="bg-muted/30 border rounded-lg p-4 text-sm space-y-2">
          <h4 className="font-semibold">💡 Vad ska fungera:</h4>
          <ul className="space-y-1 text-muted-foreground list-disc list-inside">
            <li>Claims genereras från extraherad evidence (tables + numbers)</li>
            <li>AI:ns reasoning process visas i reasoning_steps</li>
            <li>Rapportpåståenden har evidenshänvisningar som [E-001, E-023]</li>
            <li>Gap-analyser följer strukturerat format med kategoriserade gap</li>
            <li>Rekommendationer innehåller konkreta siffror och åtgärder</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
