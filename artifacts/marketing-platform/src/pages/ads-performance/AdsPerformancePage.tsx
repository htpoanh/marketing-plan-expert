import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListBrands,
  useListAdsPerformance,
  useScanAdsPerformance,
  useGetAdsPerformanceSummary,
  type AdsPerformanceRow,
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
import { BarChart3, RefreshCw, AlertCircle } from "lucide-react";

export default function AdsPerformancePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: brands } = useListBrands();
  const [brandId, setBrandId] = useState<string>("");

  const scanMutation = useScanAdsPerformance();
  const params = brandId ? { brandId: Number(brandId) } : undefined;
  const { data: rows, isLoading } = useListAdsPerformance(params);
  const { data: summary } = useGetAdsPerformanceSummary(params);

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
          const active = res?.statuses?.filter((s) => s.active).length ?? 0;
          const inactive = res?.statuses?.filter((s) => !s.active) ?? [];
          toast({
            title: `Quét xong: ${active} kênh hoạt động`,
            description: inactive.length ? `Cần key: ${inactive.map((s) => s.platform).join(", ")}` : undefined,
          });
          refresh();
        },
        onError: () => toast({ title: "Lỗi quét", variant: "destructive" }),
      },
    );
  };

  const sum = (summary?.summary ?? {}) as {
    totalSpendEur?: number;
    blendedRoas?: number | null;
    bestPlatform?: string | null;
  };
  const suggestion = (summary?.suggestion ?? null) as { reason?: string } | null;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold">Hiệu quả quảng cáo</h1>
              <p className="text-sm text-muted-foreground">
                FB / TikTok / Google. Cần API key để pull dữ liệu thật (sẽ kích hoạt sau).
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
              <RefreshCw className="w-4 h-4 mr-1.5" />
              {scanMutation.isPending ? "Đang quét..." : "Pull dữ liệu"}
            </Button>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Tổng chi tiêu</div>
            <div className="text-2xl font-bold">€{sum.totalSpendEur ?? 0}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">ROAS tổng hợp</div>
            <div className="text-2xl font-bold">{sum.blendedRoas ?? "—"}</div>
            {sum.bestPlatform && <Badge variant="secondary" className="mt-1">Tốt nhất: {sum.bestPlatform}</Badge>}
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Đề xuất ngân sách</div>
            <div className="text-sm mt-1">{suggestion?.reason ?? "Chưa đủ dữ liệu để đề xuất."}</div>
          </Card>
        </div>

        {/* Rows */}
        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : !rows || rows.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            <AlertCircle className="w-5 h-5 mx-auto mb-2 text-amber-500" />
            Chưa có dữ liệu. Pull cần API key (FACEBOOK_ADS_*, TIKTOK_ADS_*, GOOGLE_ADS_*). Có thể nhập tay sau.
          </Card>
        ) : (
          <Card className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 text-left">
                <tr>
                  <th className="p-3">Kênh</th><th className="p-3">Tuần</th><th className="p-3">Chi tiêu</th>
                  <th className="p-3">Reach</th><th className="p-3">CTR</th><th className="p-3">CPC</th><th className="p-3">ROAS</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r: AdsPerformanceRow) => (
                  <tr key={r.id} className="border-t border-border/50">
                    <td className="p-3 capitalize">{r.platform}</td>
                    <td className="p-3">{r.weekStart ?? "—"}</td>
                    <td className="p-3">€{r.spendEur ?? "—"}</td>
                    <td className="p-3">{r.reach ?? "—"}</td>
                    <td className="p-3">{r.ctr ?? "—"}</td>
                    <td className="p-3">€{r.cpc ?? "—"}</td>
                    <td className="p-3">{r.roas ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
