import { useState } from "react";
import { useGetAdsTrendPulse } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles, Radar } from "lucide-react";

import { TrendResult } from "./components/TrendResult";
import type { Brand, AdsReport } from "./types";

interface Props {
  brands: Brand[];
  brandsLoading: boolean;
}

const REGION_PRESETS = [
  "Bayern",
  "Allgäu",
  "Bodensee-Region",
  "Kempten + Umgebung",
  "Memmingen + Umgebung",
  "Friedrichshafen + Bodensee",
  "Süddeutschland",
  "DACH",
];

export default function TrendTab({ brands, brandsLoading }: Props) {
  const [brandId, setBrandId] = useState<number | "">("");
  const [regionFocus, setRegionFocus] = useState("Bayern");
  const [topic, setTopic] = useState("");
  const [language, setLanguage] = useState<"de" | "vi" | "en">("vi");
  const [bypassCache, setBypassCache] = useState(false);
  const [result, setResult] = useState<AdsReport | null>(null);

  const { toast } = useToast();
  const mutation = useGetAdsTrendPulse();

  const isCacheHit =
    result && Date.now() - new Date(result.createdAt).getTime() > 60_000;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandId) {
      toast({ title: "Chưa chọn cửa hàng", variant: "destructive" });
      return;
    }
    if (regionFocus.trim().length < 2) {
      toast({
        title: "Vui lòng chọn region",
        description: "VD: Bayern, Allgäu, hoặc tên thành phố cụ thể.",
        variant: "destructive",
      });
      return;
    }

    try {
      const data = (await mutation.mutateAsync({
        data: {
          brandId: Number(brandId),
          regionFocus: regionFocus.trim(),
          topic: topic.trim() || null,
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
          description: `Trend report cũ ${ageHours}h trước.`,
        });
      } else {
        toast({
          title: "Đã quét trend xong",
          description: `${data.aiModel} • ${data.latencyMs}ms • €${data.costEur ?? "0.0000"}`,
        });
      }
    } catch (err) {
      const message = (err as Error)?.message ?? "Trend search failed";
      toast({
        title: "Quét trend thất bại",
        description: message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-1 space-y-4 p-5 border border-border/50 rounded-xl bg-card"
        >
          <div className="flex items-center gap-2 pb-2 border-b border-border/50">
            <Radar className="w-4 h-4 text-rose-400" />
            <h3 className="font-semibold text-sm">M4 — Trend Pulse</h3>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="trend-brand">Cửa hàng</Label>
            <select
              id="trend-brand"
              value={brandId}
              onChange={(e) =>
                setBrandId(e.target.value ? Number(e.target.value) : "")
              }
              disabled={brandsLoading}
              className="w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm"
              data-testid="trend-brand-select"
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
            <Label htmlFor="trend-region">Region tập trung</Label>
            <Input
              id="trend-region"
              value={regionFocus}
              onChange={(e) => setRegionFocus(e.target.value)}
              placeholder="VD: Bayern"
              list="region-presets"
              data-testid="trend-region-input"
            />
            <datalist id="region-presets">
              {REGION_PRESETS.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
            <p className="text-[11px] text-muted-foreground">
              Claude sẽ search web/news Đức trong region này.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="trend-topic">Topic seed (tuỳ chọn)</Label>
            <Input
              id="trend-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="VD: Nail Trends 2026 (để trống = tự discover)"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="trend-language">Ngôn ngữ</Label>
            <select
              id="trend-language"
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
              data-testid="trend-bypass-cache"
            />
            <span>
              Bỏ qua cache (tạo mới — tốn ~€0.025).{" "}
              <span className="text-[10px] opacity-70">
                Cùng region + topic trong 7 ngày → trả lại trend cũ.
              </span>
            </span>
          </label>

          <Button
            type="submit"
            disabled={mutation.isPending}
            className="w-full"
            data-testid="trend-submit"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Đang quét trend…
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Quét trend (Live Search)
              </>
            )}
          </Button>
        </form>

        <div className="lg:col-span-2 space-y-4 min-h-[200px]">
          {!result && !mutation.isPending && (
            <div className="border border-dashed border-border/50 rounded-xl p-12 text-center text-muted-foreground">
              <Radar className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">
                Claude sẽ search real-time web/news Đức để tìm trend đang lên
                trong region của bạn.
              </p>
              <p className="text-xs mt-2 opacity-70">
                Output: 3-8 trend với suggested angle, sources, capitalize window
              </p>
            </div>
          )}
          {mutation.isPending && (
            <div className="border border-border/50 rounded-xl p-12 text-center space-y-3">
              <Loader2 className="w-8 h-8 mx-auto animate-spin text-rose-400" />
              <p className="text-sm text-muted-foreground">
                Claude đang search web + news Đức (last 7 ngày)…
              </p>
              <p className="text-[11px] text-muted-foreground">
                ~10-20 giây vì có Live Search • ~€0.025 / lần
              </p>
            </div>
          )}
          {result && (
            <>
              {isCacheHit && (
                <div className="border border-emerald-500/30 bg-emerald-500/5 rounded-lg px-3 py-2 text-xs flex items-center gap-2">
                  <span className="text-base">💰</span>
                  <span>
                    <strong className="text-emerald-400">
                      Cache hit — không gọi Claude
                    </strong>{" "}
                    <span className="text-muted-foreground">
                      (report cũ {new Date(result.createdAt).toLocaleString("de-DE")} —
                      tiết kiệm €{result.costEur ?? "0.0000"})
                    </span>
                  </span>
                </div>
              )}
              <TrendResult report={result} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
