import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Check, Users, Clock, Coins } from "lucide-react";
import type { AdsReport, AudienceOutput } from "../types";
import { useToast } from "@/hooks/use-toast";

export function AudienceResult({ report }: { report: AdsReport }) {
  const output = report.output as unknown as AudienceOutput;
  const { toast } = useToast();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
    toast({ title: "Đã copy vào clipboard" });
  };

  return (
    <div className="space-y-4">
      {/* Stats header */}
      <div className="flex flex-wrap gap-3 items-center">
        <Badge variant="outline" className="gap-1.5">
          <Users className="w-3 h-3" /> {output.personas?.length ?? 0} personas
        </Badge>
        <Badge variant="outline" className="gap-1.5">
          <Clock className="w-3 h-3" /> {report.latencyMs ?? 0}ms
        </Badge>
        <Badge variant="outline" className="gap-1.5">
          <Coins className="w-3 h-3" /> €{report.costEur ?? "0.0000"}
        </Badge>
        <Badge variant="outline" className="font-mono text-[10px]">
          {report.aiModel}
        </Badge>
      </div>

      <Tabs defaultValue="personas" className="space-y-3">
        <TabsList>
          <TabsTrigger value="personas">Personas</TabsTrigger>
          <TabsTrigger value="meta">Meta Targeting</TabsTrigger>
          <TabsTrigger value="google">Google Targeting</TabsTrigger>
          <TabsTrigger value="budget">Budget + Next Steps</TabsTrigger>
        </TabsList>

        <TabsContent value="personas" className="space-y-3">
          {output.personas?.map((p) => (
            <div
              key={p.rank}
              className="border border-border/50 rounded-lg p-4 bg-card space-y-2"
              data-testid={`persona-${p.rank}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold flex items-center gap-2">
                    <Badge>#{p.rank}</Badge>
                    {p.name} ({p.age}, {p.profession})
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    📍 {p.locationDetail} • 💰 {p.budgetPerPurchase ?? "—"}
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  {p.estimatedAudienceSize}
                </Badge>
              </div>
              {p.painPoints && p.painPoints.length > 0 && (
                <div className="text-xs">
                  <div className="font-medium text-rose-400 mb-1">Pain points:</div>
                  <ul className="space-y-0.5 text-muted-foreground">
                    {p.painPoints.map((pp, i) => (
                      <li key={i}>• {pp}</li>
                    ))}
                  </ul>
                </div>
              )}
              {p.buyingTriggers && p.buyingTriggers.length > 0 && (
                <div className="text-xs">
                  <div className="font-medium text-emerald-400 mb-1">
                    Buying triggers:
                  </div>
                  <ul className="space-y-0.5 text-muted-foreground">
                    {p.buyingTriggers.map((t, i) => (
                      <li key={i}>• {t}</li>
                    ))}
                  </ul>
                </div>
              )}
              {p.onlineBehavior?.platforms && (
                <div className="text-xs flex flex-wrap gap-1 pt-1">
                  {p.onlineBehavior.platforms.map((pl) => (
                    <Badge
                      key={pl}
                      variant="secondary"
                      className="text-[10px]"
                    >
                      {pl}
                    </Badge>
                  ))}
                  {p.onlineBehavior.activeHours && (
                    <span className="text-muted-foreground ml-1">
                      🕐 {p.onlineBehavior.activeHours}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </TabsContent>

        <TabsContent value="meta" className="space-y-3">
          <div className="text-xs text-muted-foreground">
            JSON này có thể paste thẳng vào Meta Ads Manager (audiences /
            ad-set settings).
          </div>
          {output.metaTargeting?.map((m, i) => {
            const json = JSON.stringify(m, null, 2);
            const key = `meta-${i}`;
            return (
              <div
                key={i}
                className="border border-border/50 rounded-lg p-3 bg-card space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">
                    <Badge className="mr-2">P{m.personaRank}</Badge>
                    {m.adSetName}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copy(json, key)}
                  >
                    {copiedKey === key ? (
                      <Check className="w-3 h-3 mr-1" />
                    ) : (
                      <Copy className="w-3 h-3 mr-1" />
                    )}
                    Copy JSON
                  </Button>
                </div>
                <pre className="text-[10px] bg-secondary/50 p-2 rounded overflow-x-auto">
                  {json}
                </pre>
              </div>
            );
          })}
        </TabsContent>

        <TabsContent value="google" className="space-y-3">
          {output.googleTargeting?.map((g, i) => (
            <div
              key={i}
              className="border border-border/50 rounded-lg p-3 bg-card space-y-2"
            >
              <div className="text-sm font-medium">
                <Badge className="mr-2">P{g.personaRank}</Badge>
                <Badge variant="secondary" className="mr-2 uppercase text-[10px]">
                  {g.campaignType}
                </Badge>
              </div>
              <div className="text-xs">
                <div className="font-medium mb-1">Keyword themes:</div>
                <div className="flex flex-wrap gap-1">
                  {g.keywordThemes.map((k, j) => (
                    <Badge key={j} variant="outline" className="text-[10px]">
                      {k}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="budget" className="space-y-4">
          {output.budgetSplit && output.budgetSplit.length > 0 && (
            <div className="border border-border/50 rounded-lg p-4 bg-card">
              <h4 className="font-semibold text-sm mb-3">Budget split</h4>
              <div className="space-y-2">
                {output.budgetSplit.map((b, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 text-sm"
                  >
                    <div className="w-12 text-right font-mono text-xs">
                      {b.percentage}%
                    </div>
                    <div className="flex-1">
                      <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-violet-500/70 rounded-full"
                          style={{ width: `${b.percentage}%` }}
                        />
                      </div>
                    </div>
                    <div className="w-16 text-right text-xs font-mono">
                      €{b.amountEur ?? "—"}
                    </div>
                    <div className="flex-[2] text-xs text-muted-foreground">
                      P{b.personaRank}: {b.reason}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {output.negativeAudiences && output.negativeAudiences.length > 0 && (
            <div className="border border-border/50 rounded-lg p-4 bg-card">
              <h4 className="font-semibold text-sm mb-3 text-rose-400">
                Loại trừ (negative audiences)
              </h4>
              <ul className="space-y-2 text-sm">
                {output.negativeAudiences.map((n, i) => (
                  <li key={i} className="text-muted-foreground">
                    <strong className="text-foreground">{n.exclude}</strong> —{" "}
                    {n.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {output.nextSteps && output.nextSteps.length > 0 && (
            <div className="border border-border/50 rounded-lg p-4 bg-card">
              <h4 className="font-semibold text-sm mb-3">Next steps</h4>
              <ol className="space-y-1.5 text-sm list-decimal list-inside text-muted-foreground">
                {output.nextSteps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
