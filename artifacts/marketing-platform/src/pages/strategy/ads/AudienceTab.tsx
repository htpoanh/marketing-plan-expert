import { useState } from "react";
import { useGenerateAdsAudience } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles, Users, Target } from "lucide-react";

import { AudienceResult } from "./components/AudienceResult";
import type { Brand, AdsReport } from "./types";

interface Props {
  brands: Brand[];
  brandsLoading: boolean;
}

const GOAL_OPTIONS: Array<{
  value: "awareness" | "traffic" | "leads" | "conversions" | "retention";
  label: string;
}> = [
  { value: "awareness", label: "Nhận diện thương hiệu" },
  { value: "traffic", label: "Traffic website" },
  { value: "leads", label: "Tìm khách tiềm năng (Leads)" },
  { value: "conversions", label: "Chuyển đổi (Booking/Sale)" },
  { value: "retention", label: "Giữ khách cũ" },
];

export default function AudienceTab({ brands, brandsLoading }: Props) {
  const [brandId, setBrandId] = useState<number | "">("");
  const [service, setService] = useState("");
  const [goal, setGoal] = useState<typeof GOAL_OPTIONS[number]["value"]>(
    "awareness",
  );
  const [budget, setBudget] = useState<string>("");
  const [language, setLanguage] = useState<"de" | "vi" | "en">("de");
  const [bypassCache, setBypassCache] = useState(false);
  const [result, setResult] = useState<AdsReport | null>(null);

  const { toast } = useToast();
  const mutation = useGenerateAdsAudience();

  // A report whose createdAt is older than ~60s is definitely a cache hit.
  // The backend signals it via the X-Cache header, but our generated
  // customFetch returns the JSON body only — checking createdAt is just as
  // reliable for our purposes (a fresh AI call cannot return a multi-minute-old
  // record).
  const isCacheHit =
    result && Date.now() - new Date(result.createdAt).getTime() > 60_000;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandId) {
      toast({
        title: "Chưa chọn cửa hàng",
        description: "Vui lòng chọn brand trước khi tạo persona.",
        variant: "destructive",
      });
      return;
    }
    if (service.trim().length < 3) {
      toast({
        title: "Service quá ngắn",
        description: "Mô tả cụ thể service / sản phẩm cần quảng cáo.",
        variant: "destructive",
      });
      return;
    }

    try {
      const data = (await mutation.mutateAsync({
        data: {
          brandId: Number(brandId),
          service: service.trim(),
          campaignGoal: goal,
          budgetEur: budget ? Number(budget) : null,
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
          description: `Report cũ ${ageHours}h trước, không gọi AI. Tick "Bỏ qua cache" để tạo mới.`,
        });
      } else {
        toast({
          title: "Đã tạo personas",
          description: `${data.aiModel} • ${data.latencyMs}ms • €${data.costEur ?? "0.0000"}`,
        });
      }
    } catch (err) {
      const message = (err as Error)?.message ?? "Generate failed";
      toast({
        title: "Tạo persona thất bại",
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
            <Target className="w-4 h-4 text-violet-400" />
            <h3 className="font-semibold text-sm">M1 — Phân tích đối tượng</h3>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="audience-brand">Cửa hàng</Label>
            <select
              id="audience-brand"
              value={brandId}
              onChange={(e) =>
                setBrandId(e.target.value ? Number(e.target.value) : "")
              }
              disabled={brandsLoading}
              className="w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm"
              data-testid="audience-brand-select"
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
            <Label htmlFor="audience-service">Service / sản phẩm</Label>
            <Input
              id="audience-service"
              value={service}
              onChange={(e) => setService(e.target.value)}
              placeholder="VD: Gel-Nägel Sommer 2026"
              data-testid="audience-service-input"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="audience-goal">Mục tiêu chiến dịch</Label>
            <select
              id="audience-goal"
              value={goal}
              onChange={(e) => setGoal(e.target.value as typeof goal)}
              className="w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm"
            >
              {GOAL_OPTIONS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="audience-budget">Ngân sách hàng tháng (€)</Label>
            <Input
              id="audience-budget"
              type="number"
              min="0"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="VD: 300"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="audience-language">Ngôn ngữ giải thích</Label>
            <select
              id="audience-language"
              value={language}
              onChange={(e) => setLanguage(e.target.value as typeof language)}
              className="w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm"
            >
              <option value="de">Deutsch</option>
              <option value="vi">Tiếng Việt</option>
              <option value="en">English</option>
            </select>
            <p className="text-[11px] text-muted-foreground">
              Tên persona + interests Meta luôn là tiếng Đức (yêu cầu Meta DE).
            </p>
          </div>

          <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={bypassCache}
              onChange={(e) => setBypassCache(e.target.checked)}
              className="mt-0.5"
              data-testid="audience-bypass-cache"
            />
            <span>
              Bỏ qua cache (tạo mới — tốn token).{" "}
              <span className="text-[10px] opacity-70">
                Mặc định cùng input + cùng brand trong 7 ngày sẽ trả lại
                report cũ, miễn phí.
              </span>
            </span>
          </label>

          <Button
            type="submit"
            disabled={mutation.isPending}
            className="w-full"
            data-testid="audience-submit"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Đang sinh personas…
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Tạo personas
              </>
            )}
          </Button>
        </form>

        {/* Result */}
        <div className="md:col-span-2 space-y-4 min-h-[200px]">
          {!result && !mutation.isPending && (
            <div className="border border-dashed border-border/50 rounded-xl p-12 text-center text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">
                Nhập form bên trái và bấm "Tạo personas" để bắt đầu.
              </p>
              <p className="text-xs mt-2 opacity-70">
                Output: 3-5 personas + Meta/Google targeting JSON sẵn sàng
                paste vào Ads Manager.
              </p>
            </div>
          )}
          {mutation.isPending && (
            <div className="border border-border/50 rounded-xl p-12 text-center space-y-3">
              <Loader2 className="w-8 h-8 mx-auto animate-spin text-violet-400" />
              <p className="text-sm text-muted-foreground">
                Claude Haiku đang phân tích brand context và sinh personas…
              </p>
              <p className="text-[11px] text-muted-foreground">
                ~5-10 giây, ước tính €0.01 / lần
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
                      Cache hit — không gọi AI
                    </strong>{" "}
                    <span className="text-muted-foreground">
                      (report cũ ngày{" "}
                      {new Date(result.createdAt).toLocaleString("de-DE")} —
                      tiết kiệm €{result.costEur ?? "0.0000"}). Tick "Bỏ qua
                      cache" trong form nếu muốn tạo mới.
                    </span>
                  </span>
                </div>
              )}
              <AudienceResult report={result} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
