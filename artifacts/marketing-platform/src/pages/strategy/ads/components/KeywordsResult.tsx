import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, CheckCircle2, Clock, Coins, Download } from "lucide-react";
import type { AdsReport, Keyword, KeywordsOutput } from "../types";
import { useToast } from "@/hooks/use-toast";

const VOLUME_COLORS: Record<Keyword["estimatedVolume"], string> = {
  Low: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  Medium: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  High: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
};

function intentColor(score: number): string {
  if (score >= 8) return "bg-rose-500/15 text-rose-400 border-rose-500/30";
  if (score >= 5) return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  return "bg-secondary text-muted-foreground border-border/50";
}

function KeywordTable({
  rows,
  emptyHint,
}: {
  rows: Keyword[];
  emptyHint: string;
}) {
  if (!rows || rows.length === 0) {
    return (
      <div className="text-xs text-muted-foreground italic py-4">
        {emptyHint}
      </div>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Keyword</TableHead>
          <TableHead className="w-20 text-center">Intent</TableHead>
          <TableHead className="w-20 text-center">Vol</TableHead>
          <TableHead className="w-32">CPC ước</TableHead>
          <TableHead className="w-20 text-center">Match</TableHead>
          <TableHead>Note</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((k, i) => (
          <TableRow key={i}>
            <TableCell className="font-mono text-xs">{k.text}</TableCell>
            <TableCell className="text-center">
              <Badge
                variant="outline"
                className={`text-[10px] ${intentColor(k.intentScore)}`}
              >
                {k.intentScore}
              </Badge>
            </TableCell>
            <TableCell className="text-center">
              <Badge
                variant="outline"
                className={`text-[10px] ${VOLUME_COLORS[k.estimatedVolume]}`}
              >
                {k.estimatedVolume}
              </Badge>
            </TableCell>
            <TableCell className="text-xs">{k.estimatedCpcEur}</TableCell>
            <TableCell className="text-center">
              <Badge variant="secondary" className="text-[10px] uppercase">
                {k.matchTypeRecommended}
              </Badge>
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {k.useCaseNote}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function downloadCsv(filename: string, rows: Keyword[]) {
  const header = [
    "keyword",
    "intent_score",
    "estimated_volume",
    "estimated_cpc_eur",
    "match_type",
    "use_case_note",
  ];
  const escape = (s: string) => `"${(s ?? "").replace(/"/g, '""')}"`;
  const csv = [
    header.join(","),
    ...rows.map((k) =>
      [
        k.text,
        String(k.intentScore),
        k.estimatedVolume,
        k.estimatedCpcEur,
        k.matchTypeRecommended,
        k.useCaseNote,
      ]
        .map(escape)
        .join(","),
    ),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function KeywordsResult({ report }: { report: AdsReport }) {
  const output = report.output as unknown as KeywordsOutput;
  const { toast } = useToast();
  const [tab, setTab] = useState("money");

  const totalKeywords =
    (output.moneyKeywords?.length ?? 0) +
    (output.discoveryKeywords?.length ?? 0) +
    (output.defensiveKeywords?.length ?? 0) +
    (output.longTailBooking?.length ?? 0);

  const exportAll = () => {
    const all = [
      ...(output.moneyKeywords ?? []),
      ...(output.discoveryKeywords ?? []),
      ...(output.defensiveKeywords ?? []),
      ...(output.longTailBooking ?? []),
    ];
    downloadCsv(`keywords-brand${report.brandId}-${report.id}.csv`, all);
    toast({ title: `Exported ${all.length} keywords as CSV` });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <Badge variant="outline" className="gap-1.5">
          {totalKeywords} keywords
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
        <div className="flex-1" />
        <Button size="sm" variant="outline" onClick={exportAll}>
          <Download className="w-3.5 h-3.5 mr-1.5" />
          Export tất cả CSV
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-4">
          <TabsTrigger value="money">
            💰 Money ({output.moneyKeywords?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="discovery">
            🔍 Discovery ({output.discoveryKeywords?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="defensive">
            🛡 Defensive ({output.defensiveKeywords?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="longtail">
            🎯 Long-tail ({output.longTailBooking?.length ?? 0})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="money" className="border border-border/50 rounded-lg p-1 overflow-x-auto">
          <KeywordTable
            rows={output.moneyKeywords}
            emptyHint="Không có keyword nào"
          />
        </TabsContent>
        <TabsContent value="discovery" className="border border-border/50 rounded-lg p-1 overflow-x-auto">
          <KeywordTable
            rows={output.discoveryKeywords}
            emptyHint="Không có keyword nào"
          />
        </TabsContent>
        <TabsContent value="defensive" className="border border-border/50 rounded-lg p-1 overflow-x-auto">
          <KeywordTable
            rows={output.defensiveKeywords}
            emptyHint="Không cung cấp đối thủ → bỏ qua nhóm này (đúng theo prompt)."
          />
        </TabsContent>
        <TabsContent value="longtail" className="border border-border/50 rounded-lg p-1 overflow-x-auto">
          <KeywordTable
            rows={output.longTailBooking}
            emptyHint="Không có keyword nào"
          />
        </TabsContent>
      </Tabs>

      {(output.warnings?.length ?? 0) > 0 && (
        <div className="border border-amber-500/30 bg-amber-500/5 rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2 text-amber-400 text-sm font-medium">
            <AlertTriangle className="w-4 h-4" />
            Cảnh báo
          </div>
          <ul className="text-sm space-y-1 text-muted-foreground list-disc list-inside">
            {output.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {(output.verificationChecklist?.length ?? 0) > 0 && (
        <div className="border border-emerald-500/30 bg-emerald-500/5 rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
            <CheckCircle2 className="w-4 h-4" />
            Verification checklist
          </div>
          <ul className="text-sm space-y-1 text-muted-foreground list-decimal list-inside">
            {output.verificationChecklist.map((v, i) => (
              <li key={i}>{v}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
