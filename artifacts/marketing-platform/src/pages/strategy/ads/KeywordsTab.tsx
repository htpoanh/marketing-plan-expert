import { useState } from "react";
import { useGenerateAdsKeywords } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles, Hash } from "lucide-react";

import { KeywordsResult } from "./components/KeywordsResult";
import type { Brand, AdsReport } from "./types";

interface Props {
  brands: Brand[];
  brandsLoading: boolean;
}

export default function KeywordsTab({ brands, brandsLoading }: Props) {
  const [brandId, setBrandId] = useState<number | "">("");
  const [service, setService] = useState("");
  const [competitorsText, setCompetitorsText] = useState("");
  const [language, setLanguage] = useState<"de" | "vi" | "en">("de");
  const [result, setResult] = useState<AdsReport | null>(null);

  const { toast } = useToast();
  const mutation = useGenerateAdsKeywords();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandId) {
      toast({
        title: "Chưa chọn cửa hàng",
        variant: "destructive",
      });
      return;
    }
    if (service.trim().length < 3) {
      toast({
        title: "Mô tả service quá ngắn",
        variant: "destructive",
      });
      return;
    }

    const competitors = competitorsText
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      const data = await mutation.mutateAsync({
        data: {
          brandId: Number(brandId),
          service: service.trim(),
          competitors,
          outputLanguage: language,
        },
      });
      setResult(data as AdsReport);
      toast({
        title: "Đã sinh keywords",
        description: `${(data as AdsReport).aiModel} • ${(data as AdsReport).latencyMs}ms • €${(data as AdsReport).costEur ?? "0.0000"}`,
      });
    } catch (err) {
      const message = (err as Error)?.message ?? "Generate failed";
      toast({
        title: "Sinh keywords thất bại",
        description: message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <form
          onSubmit={handleSubmit}
          className="md:col-span-1 space-y-4 p-5 border border-border/50 rounded-xl bg-card"
        >
          <div className="flex items-center gap-2 pb-2 border-b border-border/50">
            <Hash className="w-4 h-4 text-emerald-400" />
            <h3 className="font-semibold text-sm">M2 — Keyword có sức nặng</h3>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="kw-brand">Cửa hàng</Label>
            <select
              id="kw-brand"
              value={brandId}
              onChange={(e) =>
                setBrandId(e.target.value ? Number(e.target.value) : "")
              }
              disabled={brandsLoading}
              className="w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm"
              data-testid="keywords-brand-select"
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
            <Label htmlFor="kw-service">Service / sản phẩm</Label>
            <Input
              id="kw-service"
              value={service}
              onChange={(e) => setService(e.target.value)}
              placeholder="VD: Gel-Nägel Kempten"
              data-testid="keywords-service-input"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="kw-competitors">
              Đối thủ (mỗi dòng / dấu phẩy)
            </Label>
            <textarea
              id="kw-competitors"
              value={competitorsText}
              onChange={(e) => setCompetitorsText(e.target.value)}
              placeholder="VD: Nail Lounge Kempten, Beauty Studio Allgäu"
              rows={3}
              className="w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm resize-y"
            />
            <p className="text-[11px] text-muted-foreground">
              Để trống → bỏ qua nhóm "defensive keywords".
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="kw-language">Ngôn ngữ ghi chú</Label>
            <select
              id="kw-language"
              value={language}
              onChange={(e) => setLanguage(e.target.value as typeof language)}
              className="w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm"
            >
              <option value="de">Deutsch</option>
              <option value="vi">Tiếng Việt</option>
              <option value="en">English</option>
            </select>
            <p className="text-[11px] text-muted-foreground">
              Keywords luôn là tiếng Đức (customer search language).
            </p>
          </div>

          <Button
            type="submit"
            disabled={mutation.isPending}
            className="w-full"
            data-testid="keywords-submit"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Đang sinh keywords…
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Sinh keywords
              </>
            )}
          </Button>
        </form>

        <div className="md:col-span-2 space-y-4 min-h-[200px]">
          {!result && !mutation.isPending && (
            <div className="border border-dashed border-border/50 rounded-xl p-12 text-center text-muted-foreground">
              <Hash className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">
                Nhập form bên trái để sinh 4 nhóm keyword theo intent.
              </p>
              <p className="text-xs mt-2 opacity-70">
                Money / Discovery / Defensive / Long-tail • Output German •
                ~€0.001 / lần
              </p>
            </div>
          )}
          {mutation.isPending && (
            <div className="border border-border/50 rounded-xl p-12 text-center space-y-3">
              <Loader2 className="w-8 h-8 mx-auto animate-spin text-emerald-400" />
              <p className="text-sm text-muted-foreground">
                Gemini Flash đang sinh keyword groups…
              </p>
            </div>
          )}
          {result && <KeywordsResult report={result} />}
        </div>
      </div>
    </div>
  );
}
