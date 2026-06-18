import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListBrands,
  useListTrendInsights,
  useScanTrendIntelligence,
  useUpdateTrendInsight,
  useDeleteTrendInsight,
  type TrendInsight,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { TrendingUp, Radar, Trash2, CheckCircle2, Archive } from "lucide-react";

function bucket(score: number): { label: string; className: string } {
  if (score > 50) return { label: "Làm ngay", className: "bg-green-100 text-green-800" };
  if (score >= 30) return { label: "Backlog", className: "bg-amber-100 text-amber-800" };
  return { label: "Bỏ qua", className: "bg-gray-100 text-gray-600" };
}

const MOMENTUM_ICON: Record<string, string> = { rising: "📈", peak: "🔥", declining: "📉" };

export default function TrendIntelligencePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: brands } = useListBrands();
  const [brandId, setBrandId] = useState<string>("");

  const scanMutation = useScanTrendIntelligence();
  const updateMutation = useUpdateTrendInsight();
  const deleteMutation = useDeleteTrendInsight();

  const listParams = brandId ? { brandId: Number(brandId) } : undefined;
  const { data: insights, isLoading } = useListTrendInsights(listParams);

  const refresh = () => queryClient.invalidateQueries();

  const scan = () => {
    if (!brandId) {
      toast({ title: "Chọn thương hiệu trước", variant: "destructive" });
      return;
    }
    scanMutation.mutate(
      { data: { brandId: Number(brandId) } },
      {
        onSuccess: (res) => {
          toast({
            title: "Quét trend xong",
            description: `${res?.inserted?.length ?? 0} trend · ${res?.region ?? ""}`,
          });
          refresh();
        },
        onError: () => toast({ title: "Lỗi quét trend (cần ANTHROPIC_API_KEY)", variant: "destructive" }),
      },
    );
  };

  const setStatus = (id: number, status: "actioned" | "skipped") =>
    updateMutation.mutate({ id, data: { status } }, { onSuccess: refresh });
  const remove = (id: number) => deleteMutation.mutate({ id }, { onSuccess: refresh });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold">Trend Intelligence</h1>
              <p className="text-sm text-muted-foreground">
                Điểm trend = sức mạnh × liên quan × phù hợp chiến lược ÷ độ khó · &gt;50 làm ngay
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={brandId} onValueChange={setBrandId}>
              <SelectTrigger className="w-52"><SelectValue placeholder="Chọn thương hiệu" /></SelectTrigger>
              <SelectContent>
                {(brands ?? []).map((b) => (
                  <SelectItem key={b.id} value={String(b.id)}>{b.brandName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={scan} disabled={scanMutation.isPending}>
              <Radar className="w-4 h-4 mr-1.5" />
              {scanMutation.isPending ? "Đang quét..." : "Quét trend"}
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : !insights || insights.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            Chưa có trend. Chọn thương hiệu và bấm "Quét trend".
          </Card>
        ) : (
          <div className="space-y-3">
            {insights.map((t: TrendInsight) => {
              const score = parseFloat(t.trendScore);
              const b = bucket(score);
              return (
                <Card key={t.id} className="p-4 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-lg">{t.momentum ? MOMENTUM_ICON[t.momentum] : ""}</span>
                    <span className="font-semibold">{t.trendName}</span>
                    <Badge className={b.className}>{b.label} · {score}</Badge>
                    {t.estimatedWindowDays != null && (
                      <Badge variant="outline">{t.estimatedWindowDays} ngày</Badge>
                    )}
                    <Badge variant="secondary" className="capitalize">{t.status}</Badge>
                  </div>
                  {t.description && <p className="text-sm text-muted-foreground">{t.description}</p>}
                  {t.suggestedAngle && (
                    <p className="text-sm"><strong>Góc nội dung:</strong> {t.suggestedAngle}</p>
                  )}
                  {t.strategyAlignmentNote && (
                    <p className="text-xs text-muted-foreground italic">{t.strategyAlignmentNote}</p>
                  )}
                  {t.recommendedAction && (
                    <p className="text-xs text-primary">→ {t.recommendedAction}</p>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setStatus(t.id, "actioned")}>
                      <CheckCircle2 className="w-4 h-4 mr-1.5" /> Đã làm
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setStatus(t.id, "skipped")}>
                      <Archive className="w-4 h-4 mr-1.5" /> Bỏ qua
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(t.id)}>
                      <Trash2 className="w-4 h-4 mr-1.5" /> Xoá
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
