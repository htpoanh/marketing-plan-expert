import { useState } from "react";
import { useAnalyzeAdsPerformance } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles, BarChart3, Printer } from "lucide-react";

import { CSVDropzone } from "./components/CSVDropzone";
import { PerformanceResult } from "./components/PerformanceResult";
import type { Brand, AdsReport } from "./types";

interface Props {
  brands: Brand[];
  brandsLoading: boolean;
}

export default function PerformanceTab({ brands, brandsLoading }: Props) {
  const [brandId, setBrandId] = useState<number | "">("");
  const [csvData, setCsvData] = useState<string>("");
  const [csvFilename, setCsvFilename] = useState<string>("");
  const [cplTarget, setCplTarget] = useState<string>("");
  const [avgTicket, setAvgTicket] = useState<string>("");
  const [roasTarget, setRoasTarget] = useState<string>("");
  const [language, setLanguage] = useState<"de" | "vi" | "en">("vi");
  const [bypassCache, setBypassCache] = useState(false);
  const [result, setResult] = useState<AdsReport | null>(null);

  const { toast } = useToast();
  const mutation = useAnalyzeAdsPerformance();

  const isCacheHit =
    result && Date.now() - new Date(result.createdAt).getTime() > 60_000;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandId) {
      toast({ title: "Chưa chọn cửa hàng", variant: "destructive" });
      return;
    }
    if (!csvData || csvData.length < 50) {
      toast({
        title: "Chưa upload CSV",
        description: "Cần file CSV ads xuất từ Meta hoặc Google Ads.",
        variant: "destructive",
      });
      return;
    }

    try {
      const data = (await mutation.mutateAsync({
        data: {
          brandId: Number(brandId),
          platform: "mixed",
          csvData,
          goal: {
            cplTargetEur: cplTarget ? Number(cplTarget) : null,
            avgTicketEur: avgTicket ? Number(avgTicket) : null,
            roasTarget: roasTarget ? Number(roasTarget) : null,
          },
          outputLanguage: language,
          bypassCache,
        },
      })) as AdsReport;
      setResult(data);

      const wasCached =
        Date.now() - new Date(data.createdAt).getTime() > 60_000;
      if (wasCached) {
        const ageHours = Math.round(
          (Date.now() - new Date(data.createdAt).getTime()) / (60 * 60 * 1000),
        );
        toast({
          title: "💰 Đã dùng cache (tiết kiệm 100%)",
          description: `Report cũ ${ageHours}h trước cùng CSV này.`,
        });
      } else {
        toast({
          title: "Đã phân tích xong",
          description: `${data.aiModel} • ${data.latencyMs}ms • €${data.costEur ?? "0.0000"}`,
        });
      }
    } catch (err) {
      const message = (err as Error)?.message ?? "Analyze failed";
      toast({
        title: "Phân tích thất bại",
        description: message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:grid-cols-1">
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-1 space-y-4 p-5 border border-border/50 rounded-xl bg-card print:hidden"
        >
          <div className="flex items-center gap-2 pb-2 border-b border-border/50">
            <BarChart3 className="w-4 h-4 text-amber-400" />
            <h3 className="font-semibold text-sm">M3 — Performance Reality</h3>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="perf-brand">Cửa hàng</Label>
            <select
              id="perf-brand"
              value={brandId}
              onChange={(e) =>
                setBrandId(e.target.value ? Number(e.target.value) : "")
              }
              disabled={brandsLoading}
              className="w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm"
              data-testid="perf-brand-select"
            >
              <option value="">— Chọn cửa hàng —</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.brandName}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label>Upload CSV ads</Label>
            <CSVDropzone
              onFileLoaded={(text, name) => {
                setCsvData(text);
                setCsvFilename(name);
              }}
              onClear={() => {
                setCsvData("");
                setCsvFilename("");
              }}
              disabled={mutation.isPending}
              maxMb={10}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="perf-cpl" className="text-xs">CPL target (€)</Label>
              <Input
                id="perf-cpl"
                type="number"
                step="0.01"
                min="0"
                value={cplTarget}
                onChange={(e) => setCplTarget(e.target.value)}
                placeholder="VD: 8"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="perf-ticket" className="text-xs">Avg ticket (€)</Label>
              <Input
                id="perf-ticket"
                type="number"
                step="0.01"
                min="0"
                value={avgTicket}
                onChange={(e) => setAvgTicket(e.target.value)}
                placeholder="VD: 45"
              />
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground -mt-2">
            Nếu để trống avg ticket, AI sẽ dùng giá trị từ brand context.
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="perf-roas" className="text-xs">ROAS target (tuỳ chọn)</Label>
            <Input
              id="perf-roas"
              type="number"
              step="0.1"
              min="0"
              value={roasTarget}
              onChange={(e) => setRoasTarget(e.target.value)}
              placeholder="VD: 4"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="perf-language">Ngôn ngữ giải thích</Label>
            <select
              id="perf-language"
              value={language}
              onChange={(e) => setLanguage(e.target.value as typeof language)}
              className="w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm"
            >
              <option value="vi">Tiếng Việt</option>
              <option value="de">Deutsch</option>
              <option value="en">English</option>
            </select>
          </div>

          <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={bypassCache}
              onChange={(e) => setBypassCache(e.target.checked)}
              className="mt-0.5"
              data-testid="perf-bypass-cache"
            />
            <span>
              Bỏ qua cache (tạo mới — tốn ~€0.06).{" "}
              <span className="text-[10px] opacity-70">
                Cùng file CSV trong 7 ngày sẽ trả lại report cũ, miễn phí.
              </span>
            </span>
          </label>

          <Button
            type="submit"
            disabled={mutation.isPending || !csvData}
            className="w-full"
            data-testid="perf-submit"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Đang phân tích…
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Phân tích performance
              </>
            )}
          </Button>
        </form>

        <div className="lg:col-span-2 space-y-4 min-h-[300px]">
          {!result && !mutation.isPending && (
            <div className="border border-dashed border-border/50 rounded-xl p-12 text-center text-muted-foreground">
              <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">
                Upload CSV ads (Meta hoặc Google) → AI sẽ phân tích lãng phí
                và đề xuất chia lại budget.
              </p>
              <p className="text-xs mt-2 opacity-70">
                Claude Sonnet 4.5 • ~€0.06/lần • Cache 7 ngày
              </p>
              <div className="text-[10px] mt-4 text-muted-foreground/70 max-w-md mx-auto leading-relaxed">
                <strong>Cách export CSV:</strong>
                <br />
                <strong>Meta:</strong> Ads Manager → Reports → Export → CSV
                <br />
                <strong>Google:</strong> Google Ads → Campaigns → Download → CSV
              </div>
            </div>
          )}
          {mutation.isPending && (
            <div className="border border-border/50 rounded-xl p-12 text-center space-y-3">
              <Loader2 className="w-8 h-8 mx-auto animate-spin text-amber-400" />
              <p className="text-sm text-muted-foreground">
                Claude Sonnet đang phân tích {csvFilename}…
              </p>
              <p className="text-[11px] text-muted-foreground">
                ~10-15 giây cho 50-200 rows ads. Don't refresh.
              </p>
            </div>
          )}
          {result && (
            <>
              {isCacheHit && (
                <div className="border border-emerald-500/30 bg-emerald-500/5 rounded-lg px-3 py-2 text-xs flex items-center gap-2 print:hidden">
                  <span className="text-base">💰</span>
                  <span>
                    <strong className="text-emerald-400">
                      Cache hit — không gọi AI
                    </strong>{" "}
                    <span className="text-muted-foreground">
                      (report cũ {new Date(result.createdAt).toLocaleString("de-DE")} —
                      tiết kiệm €{result.costEur ?? "0.0000"})
                    </span>
                  </span>
                </div>
              )}
              <div className="flex justify-end print:hidden">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.print()}
                >
                  <Printer className="w-3.5 h-3.5 mr-1.5" />
                  Print / Export PDF
                </Button>
              </div>
              <PerformanceResult report={result} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
