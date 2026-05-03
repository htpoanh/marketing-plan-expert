import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Coins,
  TrendingDown,
  TrendingUp,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  HelpCircle,
} from "lucide-react";
import type { AdsReport, PerformanceOutput } from "../types";

const CONFIDENCE_BADGE: Record<"high" | "medium" | "low", string> = {
  high: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  medium: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  low: "bg-secondary text-muted-foreground border-border/50",
};

const fmtEur = (n: number) =>
  `€${n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function MetricTooltip({ label, hint }: { label: string; hint: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-1 cursor-help">
          {label}
          <HelpCircle className="w-3 h-3 text-muted-foreground/60" />
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">{hint}</TooltipContent>
    </Tooltip>
  );
}

export function PerformanceResult({ report }: { report: AdsReport }) {
  const output = report.output as unknown as PerformanceOutput;
  const inputMeta = report.input as Record<string, unknown> & {
    detectedPlatform?: string;
    parsedStats?: { rowCount: number; totalSpendEur: number; totalConversions: number };
  };

  const [expandedHypothesis, setExpandedHypothesis] = useState<number | null>(0);

  // Reallocation balance check — should sum to ~0 across the array
  const reallocationDelta = (output.budgetReallocation ?? []).reduce(
    (sum, m) => sum + (m.amountEur ?? 0),
    0,
  );

  return (
    <div className="space-y-5 print:space-y-3">
      {/* Stats header */}
      <div className="flex flex-wrap gap-3 items-center">
        {inputMeta.detectedPlatform && (
          <Badge variant="outline" className="capitalize">
            {inputMeta.detectedPlatform === "meta" ? "Meta Ads" : "Google Ads"}
          </Badge>
        )}
        {inputMeta.parsedStats && (
          <Badge variant="outline" className="gap-1.5">
            {inputMeta.parsedStats.rowCount} rows • {fmtEur(inputMeta.parsedStats.totalSpendEur)} spend
          </Badge>
        )}
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

      {/* Executive summary */}
      <div className="border border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-orange-500/5 rounded-xl p-5">
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-amber-400" />
          Tóm tắt
        </h3>
        <p className="text-sm leading-relaxed">{output.executiveSummary}</p>
      </div>

      <Tabs defaultValue="working" className="space-y-3">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="working" className="gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" /> Đang chạy tốt ({output.whatWorking?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="wasting" className="gap-1.5">
            <TrendingDown className="w-3.5 h-3.5" /> Lãng phí ({output.whatWasting?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="hypotheses" className="gap-1.5">
            🧪 Hypotheses ({output.hypotheses?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="reallocation" className="gap-1.5">
            ⇄ Chia lại budget
          </TabsTrigger>
          <TabsTrigger value="risks" className="gap-1.5">
            ⚠ Rủi ro
          </TabsTrigger>
        </TabsList>

        {/* What's working */}
        <TabsContent value="working" className="space-y-3">
          {(output.whatWorking ?? []).length === 0 && (
            <p className="text-xs text-muted-foreground italic py-4">
              AI không tìm ra pattern nào đang work. Có thể do data quá ít hoặc
              tất cả đều underperform — kiểm tra mục "Lãng phí" trước.
            </p>
          )}
          {(output.whatWorking ?? []).map((w, i) => (
            <div
              key={i}
              className="border border-border/50 rounded-lg p-4 bg-card"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <h4 className="font-medium text-sm flex-1">{w.pattern}</h4>
                <Badge
                  variant="outline"
                  className={`text-[10px] uppercase ${CONFIDENCE_BADGE[w.confidence]}`}
                >
                  {w.confidence}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                <strong>Bằng chứng:</strong>{" "}
                {w.evidence.map((e, j) => (
                  <Badge key={j} variant="secondary" className="text-[10px] mr-1 mb-1">
                    {e}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </TabsContent>

        {/* What's wasting */}
        <TabsContent value="wasting" className="space-y-3">
          {(output.whatWasting ?? []).length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <p className="text-sm font-medium">
                AI không thấy chỗ nào đang lãng phí rõ rệt
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                (Vẫn nên xem mục Hypotheses để tối ưu thêm)
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/50">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign / Ad set</TableHead>
                    <TableHead className="w-24 text-right">
                      <MetricTooltip
                        label="Spend"
                        hint="Tổng tiền đã chi cho campaign / ad-set này trong period."
                      />
                    </TableHead>
                    <TableHead>Lý do</TableHead>
                    <TableHead className="w-44">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {output.whatWasting.map((w, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs">
                        <div>{w.campaignName}</div>
                        {w.adSetName && (
                          <div className="text-muted-foreground/70 text-[10px]">
                            {w.adSetName}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-rose-400 font-semibold">
                        {fmtEur(w.spendEur)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {w.reason}
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="outline" className="text-[10px]">
                          {w.recommendedAction}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Hypotheses */}
        <TabsContent value="hypotheses" className="space-y-3">
          {(output.hypotheses ?? []).map((h, i) => (
            <div
              key={i}
              className="border border-border/50 rounded-lg bg-card overflow-hidden"
            >
              <button
                onClick={() =>
                  setExpandedHypothesis(expandedHypothesis === i ? null : i)
                }
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-secondary/20 transition-colors"
              >
                <Badge>H{i + 1}</Badge>
                <div className="flex-1">
                  <div className="font-medium text-sm">{h.name}</div>
                  <div className="text-xs text-muted-foreground line-clamp-1">
                    {h.hypothesis}
                  </div>
                </div>
                {expandedHypothesis === i ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </button>
              {expandedHypothesis === i && (
                <div className="border-t border-border/40 p-4 space-y-3 text-sm">
                  <p className="leading-relaxed">{h.hypothesis}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                      <div className="text-[10px] uppercase font-semibold text-blue-400 mb-1">
                        Variant A (control)
                      </div>
                      <div className="text-xs">{h.variantA}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-violet-500/5 border border-violet-500/20">
                      <div className="text-[10px] uppercase font-semibold text-violet-400 mb-1">
                        Variant B (treatment)
                      </div>
                      <div className="text-xs">{h.variantB}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                    <div>
                      <div className="text-muted-foreground/70 mb-0.5">Sample size</div>
                      <div className="font-mono">{h.sampleSizeNeeded}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground/70 mb-0.5">Decision criteria</div>
                      <div className="font-mono">{h.decisionCriteria}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground/70 mb-0.5">Expected impact</div>
                      <div>{h.expectedImpact}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </TabsContent>

        {/* Budget reallocation */}
        <TabsContent value="reallocation" className="space-y-3">
          {(output.budgetReallocation ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-4">
              AI không đề xuất chia lại budget — có thể tất cả đang chạy hợp
              lý hoặc data chưa đủ rõ.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border border-border/50">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Từ</TableHead>
                      <TableHead className="text-center">→</TableHead>
                      <TableHead>Sang</TableHead>
                      <TableHead className="text-right w-28">Số tiền</TableHead>
                      <TableHead>Lý do</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {output.budgetReallocation.map((m, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-xs text-rose-400">
                          {m.from}
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground">→</TableCell>
                        <TableCell className="font-mono text-xs text-emerald-400">
                          {m.to}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {fmtEur(m.amountEur)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {m.reason}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {Math.abs(reallocationDelta) > 1 && (
                <div className="text-xs text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Tổng dịch chuyển không bằng 0 ({fmtEur(reallocationDelta)}) —
                  AI có thể đã đề xuất tăng/giảm budget tổng. Kiểm tra lại trước
                  khi áp dụng.
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* Risks */}
        <TabsContent value="risks" className="space-y-2">
          {(output.risks ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-4">
              Không có rủi ro nào được flag.
            </p>
          ) : (
            <ul className="space-y-2">
              {output.risks.map((r, i) => (
                <li
                  key={i}
                  className="text-sm border border-amber-500/20 bg-amber-500/5 rounded-lg p-3 flex items-start gap-2"
                >
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">{r}</span>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
