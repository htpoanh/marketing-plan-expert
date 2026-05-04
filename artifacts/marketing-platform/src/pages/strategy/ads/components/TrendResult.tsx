import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Clock,
  Coins,
  Radar,
  TrendingUp,
  Activity,
  TrendingDown,
  ExternalLink,
  AlertTriangle,
  Hash,
} from "lucide-react";
import { useLocation } from "wouter";
import type { AdsReport, TrendOutput, TrendItem } from "../types";

const MOMENTUM_BADGE: Record<TrendItem["momentum"], string> = {
  rising: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  peak: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  declining: "bg-rose-500/15 text-rose-400 border-rose-500/30",
};
const MOMENTUM_ICON: Record<TrendItem["momentum"], typeof TrendingUp> = {
  rising: TrendingUp,
  peak: Activity,
  declining: TrendingDown,
};
const MOMENTUM_LABEL_VI: Record<TrendItem["momentum"], string> = {
  rising: "đang lên",
  peak: "đỉnh",
  declining: "đang xuống",
};

function relevanceColor(score: number): string {
  if (score >= 8) return "text-rose-400";
  if (score >= 5) return "text-amber-400";
  return "text-muted-foreground";
}

export function TrendResult({ report }: { report: AdsReport }) {
  const output = report.output as unknown as TrendOutput;
  const [, navigate] = useLocation();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <Badge variant="outline" className="gap-1.5">
          <Radar className="w-3 h-3" /> {output.trends?.length ?? 0} trends
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

      {/* Regional signals */}
      {(output.regionalSignals?.bayernSpecific?.length ?? 0) +
        (output.regionalSignals?.germanyWide?.length ?? 0) >
        0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {output.regionalSignals?.bayernSpecific?.length > 0 && (
            <div className="border border-blue-500/20 bg-blue-500/5 rounded-lg p-3">
              <div className="text-xs font-semibold text-blue-400 mb-1.5">
                📍 Bayern / Allgäu
              </div>
              <ul className="text-xs space-y-1 text-muted-foreground">
                {output.regionalSignals.bayernSpecific.map((s, i) => (
                  <li key={i}>• {s}</li>
                ))}
              </ul>
            </div>
          )}
          {output.regionalSignals?.germanyWide?.length > 0 && (
            <div className="border border-rose-500/20 bg-rose-500/5 rounded-lg p-3">
              <div className="text-xs font-semibold text-rose-300 mb-1.5">
                🇩🇪 Toàn Đức
              </div>
              <ul className="text-xs space-y-1 text-muted-foreground">
                {output.regionalSignals.germanyWide.map((s, i) => (
                  <li key={i}>• {s}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Trend cards */}
      <div className="space-y-3">
        {(output.trends ?? [])
          .slice()
          .sort((a, b) => b.relevanceScore - a.relevanceScore)
          .map((t, i) => {
            const MomentumIcon = MOMENTUM_ICON[t.momentum];
            return (
              <div
                key={i}
                className="border border-border/50 rounded-lg p-4 bg-card hover:bg-secondary/10 transition-colors"
                data-testid={`trend-${i}`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center justify-center min-w-[3rem] py-1">
                    <div
                      className={`text-2xl font-bold ${relevanceColor(t.relevanceScore)}`}
                    >
                      {t.relevanceScore}
                    </div>
                    <div className="text-[9px] uppercase text-muted-foreground/60">
                      relevance
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <h4 className="font-semibold text-sm flex-1 leading-tight">
                        {t.topic}
                      </h4>
                      <Badge
                        variant="outline"
                        className={`text-[10px] gap-1 ${MOMENTUM_BADGE[t.momentum]}`}
                      >
                        <MomentumIcon className="w-3 h-3" />
                        {MOMENTUM_LABEL_VI[t.momentum]}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2 leading-relaxed">
                      {t.description}
                    </p>

                    <div className="border-l-2 border-violet-500/40 pl-3 mb-2">
                      <div className="text-[10px] uppercase text-violet-300 font-semibold mb-0.5">
                        💡 Suggested angle
                      </div>
                      <p className="text-xs">{t.suggestedAngle}</p>
                    </div>

                    {t.suggestedKeywords.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {t.suggestedKeywords.map((k, j) => (
                          <Badge
                            key={j}
                            variant="secondary"
                            className="text-[10px] gap-0.5"
                          >
                            <Hash className="w-2.5 h-2.5" />
                            {k}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
                      <span>
                        ⏱ Còn{" "}
                        <strong className="text-foreground">
                          ~{t.estimatedWindowDays} ngày
                        </strong>{" "}
                        để bắt sóng
                      </span>
                      <span>•</span>
                      <span>{t.sources.length} sources</span>
                    </div>

                    {t.sources.length > 0 && (
                      <details className="text-[10px] mt-2">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                          Xem nguồn
                        </summary>
                        <ul className="mt-1 space-y-0.5">
                          {t.sources.map((s, j) => {
                            const isUrl = /^https?:\/\//.test(s);
                            return (
                              <li key={j} className="font-mono">
                                {isUrl ? (
                                  <a
                                    href={s}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-400 hover:underline inline-flex items-center gap-1"
                                  >
                                    {s.slice(0, 80)}
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                ) : (
                                  <span className="text-muted-foreground">{s}</span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </details>
                    )}

                    {/* "Use this trend" button — wires into existing content generator */}
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7"
                        onClick={() => {
                          const params = new URLSearchParams({
                            topic: t.suggestedAngle,
                            keywords: t.suggestedKeywords.join(","),
                          });
                          navigate(`/content/generator?${params}`);
                        }}
                      >
                        ✨ Tạo content cho trend này
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
      </div>

      {/* Risks to avoid */}
      {(output.risksToAvoid?.length ?? 0) > 0 && (
        <div className="border border-amber-500/30 bg-amber-500/5 rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2 text-amber-400 text-sm font-medium">
            <AlertTriangle className="w-4 h-4" />
            Trend cần tránh (gây tranh cãi / off-brand)
          </div>
          <ul className="text-xs space-y-1 text-muted-foreground list-disc list-inside">
            {output.risksToAvoid.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
