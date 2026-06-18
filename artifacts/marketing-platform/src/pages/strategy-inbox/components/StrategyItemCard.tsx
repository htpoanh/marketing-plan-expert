import { useQueryClient } from "@tanstack/react-query";
import {
  useUpdateStrategyInboxItem,
  useReanalyzeStrategyInboxItem,
  useDeleteStrategyInboxItem,
  type StrategyInboxItem,
} from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  RefreshCw,
  Trash2,
  CheckCircle2,
  Archive,
  Clock,
  CalendarClock,
  Boxes,
  AlertTriangle,
  Lightbulb,
} from "lucide-react";

const TYPE_LABEL: Record<string, string> = {
  campaign_idea: "Ý tưởng campaign",
  company_goal: "Mục tiêu công ty",
  format_test: "Thử format",
  feedback: "Phản hồi",
  other: "Khác",
};

const PRIORITY_META: Record<string, string> = {
  high: "bg-red-100 text-red-800",
  medium: "bg-amber-100 text-amber-800",
  low: "bg-gray-100 text-gray-700",
};

const STATUS_META: Record<string, { label: string; className: string }> = {
  pending: { label: "Đang phân tích", className: "bg-blue-100 text-blue-800" },
  analyzed: { label: "Đã phân tích", className: "bg-green-100 text-green-800" },
  incorporated: { label: "Đã đưa vào KH", className: "bg-purple-100 text-purple-800" },
  archived: { label: "Lưu trữ", className: "bg-gray-100 text-gray-600" },
};

const FEASIBILITY_META: Record<string, string> = {
  high: "text-green-600",
  medium: "text-amber-600",
  low: "text-red-600",
};

export function StrategyItemCard({
  item,
  brandName,
}: {
  item: StrategyInboxItem;
  brandName: string;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateMutation = useUpdateStrategyInboxItem();
  const reanalyzeMutation = useReanalyzeStrategyInboxItem();
  const deleteMutation = useDeleteStrategyInboxItem();

  const refresh = () => queryClient.invalidateQueries();
  const analysis = item.claudeAnalysis;
  const status = STATUS_META[item.status] ?? STATUS_META.pending;

  const setStatus = (newStatus: "incorporated" | "archived" | "analyzed") =>
    updateMutation.mutate(
      { id: item.id, data: { status: newStatus } },
      { onSuccess: refresh },
    );

  const reanalyze = () =>
    reanalyzeMutation.mutate(
      { id: item.id },
      {
        onSuccess: () => {
          toast({ title: "Đã phân tích lại" });
          refresh();
        },
        onError: () => toast({ title: "Lỗi phân tích", variant: "destructive" }),
      },
    );

  const remove = () =>
    deleteMutation.mutate({ id: item.id }, { onSuccess: refresh });

  return (
    <Card className="p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{brandName}</Badge>
        <Badge variant="outline">{TYPE_LABEL[item.inputType] ?? item.inputType}</Badge>
        <Badge className={PRIORITY_META[item.priority]}>{item.priority}</Badge>
        <Badge className={status.className}>{status.label}</Badge>
        {item.deadline && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarClock className="w-3 h-3" /> {item.deadline}
          </span>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {new Date(item.createdAt).toLocaleString("de-DE")}
        </span>
      </div>

      <p className="text-sm whitespace-pre-wrap text-foreground">{item.content}</p>

      {analysis ? (
        <div className="space-y-2 rounded-lg bg-secondary/40 p-3 text-sm">
          <p className="font-medium">{analysis.summary}</p>
          <div className="flex items-center gap-2">
            <Lightbulb className={`w-4 h-4 ${FEASIBILITY_META[analysis.feasibility?.rating] ?? ""}`} />
            <span className="font-medium">Khả thi: {analysis.feasibility?.rating}</span>
            <span className="text-muted-foreground">— {analysis.feasibility?.rationale}</span>
          </div>
          <div className="flex items-start gap-2">
            <Clock className="w-4 h-4 mt-0.5 text-blue-600" />
            <span><strong>Timeline:</strong> {analysis.timeline} · <strong>Tuần đề xuất:</strong> {analysis.recommendedWeek}</span>
          </div>
          {analysis.resources?.length > 0 && (
            <div className="flex items-start gap-2">
              <Boxes className="w-4 h-4 mt-0.5 text-muted-foreground" />
              <span><strong>Nguồn lực:</strong> {analysis.resources.join(", ")}</span>
            </div>
          )}
          {analysis.risks?.length > 0 && (
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-600" />
              <span><strong>Rủi ro:</strong> {analysis.risks.join("; ")}</span>
            </div>
          )}
          {analysis.alignsWithTrends && (
            <p className="text-xs text-muted-foreground italic">Trend: {analysis.alignsWithTrends}</p>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic">Chưa có phân tích (AI có thể đã lỗi — bấm Phân tích lại).</p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="ghost" onClick={reanalyze} disabled={reanalyzeMutation.isPending}>
          <RefreshCw className="w-4 h-4 mr-1.5" />
          Phân tích lại
        </Button>
        {item.status !== "incorporated" && (
          <Button size="sm" variant="outline" onClick={() => setStatus("incorporated")}>
            <CheckCircle2 className="w-4 h-4 mr-1.5" />
            Đưa vào kế hoạch
          </Button>
        )}
        {item.status !== "archived" && (
          <Button size="sm" variant="ghost" onClick={() => setStatus("archived")}>
            <Archive className="w-4 h-4 mr-1.5" />
            Lưu trữ
          </Button>
        )}
        <Button size="sm" variant="ghost" className="text-destructive" onClick={remove} disabled={deleteMutation.isPending}>
          <Trash2 className="w-4 h-4 mr-1.5" />
          Xoá
        </Button>
      </div>
    </Card>
  );
}
