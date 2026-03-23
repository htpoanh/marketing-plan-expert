import { useState, useRef } from "react";
import { useListBrands, useGenerateStrategy } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Lightbulb, Target, BrainCircuit, Send, ArrowRight, CheckCircle2, Loader2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

interface SituationSuggestions {
  suggestedTopics: string[];
  suggestedGoals: string[];
}

export default function StrategyGenerator() {
  const { data: brands } = useListBrands();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [formData, setFormData] = useState({
    brandId: 0,
    platform: "Đa nền tảng",
    campaignGoal: "",
    duration: "1 Tuần",
    storeSituation: ""
  });

  const [suggestions, setSuggestions] = useState<SituationSuggestions | null>(null);
  const [analyzingBlur, setAnalyzingBlur] = useState(false);
  const analyzeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const generateMutation = useGenerateStrategy();

  const handleSituationBlur = async () => {
    const text = formData.storeSituation.trim();
    if (!text || text.length < 20) return;

    if (analyzeTimeoutRef.current) clearTimeout(analyzeTimeoutRef.current);
    analyzeTimeoutRef.current = setTimeout(async () => {
      setAnalyzingBlur(true);
      try {
        const res = await fetch(`${BASE}/api/content/analyze-situation`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ situation: text, brandId: formData.brandId || undefined }),
        });
        if (res.ok) {
          const data: SituationSuggestions = await res.json();
          if ((data.suggestedTopics?.length ?? 0) > 0 || (data.suggestedGoals?.length ?? 0) > 0) {
            setSuggestions(data);
          }
        }
      } catch {
        // silently ignore
      } finally {
        setAnalyzingBlur(false);
      }
    }, 300);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.brandId) {
      toast({ title: "Lỗi", description: "Vui lòng chọn cửa hàng", variant: "destructive" });
      return;
    }
    generateMutation.mutate({ data: formData });
  };

  const handleSendToPipeline = () => {
    if (!generateMutation.data) return;
    const strategy = generateMutation.data;
    const brand = brands?.find((b: any) => b.id === formData.brandId);

    const params = new URLSearchParams({
      brandId: String(formData.brandId),
      brandName: brand?.brandName ?? "",
      topic: strategy.suggestedTopics?.[0] ?? "",
      goal: formData.campaignGoal,
      platform: formData.platform === "Đa nền tảng" ? "Facebook" : formData.platform,
      storeSituation: formData.storeSituation,
    });
    navigate(`/pipeline?${params.toString()}`);
    toast({ title: "Đã gửi sang Pipeline AI", description: "Form đã được điền sẵn từ chiến lược." });
  };

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-400 to-orange-500 flex items-center gap-3">
            <Lightbulb className="w-8 h-8 text-amber-400" />
            AI Phân tích Chiến lược
          </h1>
          <p className="mt-2 text-muted-foreground">Ứng dụng các mô hình Marketing (AIDA, 4P, STP) để lên kế hoạch.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 bg-card rounded-2xl border border-border/50 p-6 shadow-lg h-fit">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium">Cửa hàng cần phân tích</label>
                <select
                  required
                  value={formData.brandId}
                  onChange={e => setFormData({ ...formData, brandId: Number(e.target.value) })}
                  className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border focus:ring-2 focus:ring-amber-500/50 outline-none"
                >
                  <option value={0}>-- Chọn cửa hàng --</option>
                  {brands?.map((b: any) => (
                    <option key={b.id} value={b.id}>{b.brandName}</option>
                  ))}
                </select>
              </div>

              {/* Tình trạng hiện tại */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  Tình trạng hiện tại
                  <span className="text-xs text-muted-foreground font-normal">(không bắt buộc)</span>
                  {analyzingBlur && <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />}
                </label>
                <textarea
                  rows={4}
                  value={formData.storeSituation}
                  onChange={e => {
                    setFormData({ ...formData, storeSituation: e.target.value });
                    if (suggestions) setSuggestions(null);
                  }}
                  onBlur={handleSituationBlur}
                  placeholder="Vd: Tiệm mới mở 2 tháng, khách chưa đông, chủ yếu walk-in, chưa có review Google. Muốn tăng nhận diện và kéo khách đặt lịch..."
                  className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border focus:ring-2 focus:ring-amber-500/50 outline-none resize-none text-sm leading-relaxed"
                />
                <p className="text-xs text-muted-foreground">AI sẽ phân tích tình trạng thực tế để đề xuất chiến lược phù hợp hơn</p>

                {/* AI Chips: Topic & Goal suggestions */}
                {suggestions && (
                  <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-amber-500 uppercase tracking-wide">Gợi ý từ AI</p>
                      <button
                        type="button"
                        onClick={() => setSuggestions(null)}
                        className="p-0.5 text-muted-foreground hover:text-foreground"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {suggestions.suggestedTopics.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs text-muted-foreground font-medium">Chủ đề gợi ý → nhấn để điền vào Pipeline</p>
                        <div className="flex flex-wrap gap-1.5">
                          {suggestions.suggestedTopics.map((t, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => {
                                const params = new URLSearchParams({
                                  brandId: String(formData.brandId),
                                  topic: t,
                                  goal: formData.campaignGoal,
                                  platform: formData.platform === "Đa nền tảng" ? "Facebook" : formData.platform,
                                  storeSituation: formData.storeSituation,
                                });
                                navigate(`/pipeline?${params.toString()}`);
                              }}
                              className="px-2.5 py-1 text-xs rounded-full bg-amber-500/15 text-amber-600 border border-amber-500/30 hover:bg-amber-500/30 transition-colors font-medium"
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {suggestions.suggestedGoals.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs text-muted-foreground font-medium">Mục tiêu gợi ý → nhấn để điền vào form</p>
                        <div className="flex flex-wrap gap-1.5">
                          {suggestions.suggestedGoals.map((g, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => setFormData(prev => ({ ...prev, campaignGoal: g }))}
                              className="px-2.5 py-1 text-xs rounded-full bg-blue-500/15 text-blue-600 border border-blue-500/30 hover:bg-blue-500/30 transition-colors font-medium"
                            >
                              {g}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Mục tiêu chiến dịch (Goal)</label>
                <textarea
                  required
                  value={formData.campaignGoal}
                  onChange={e => setFormData({ ...formData, campaignGoal: e.target.value })}
                  placeholder="Vd: Đẩy mạnh doanh thu cuối tuần, xả hàng tồn kho..."
                  className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border focus:ring-2 focus:ring-amber-500/50 outline-none min-h-[80px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nền tảng</label>
                  <select
                    value={formData.platform}
                    onChange={e => setFormData({ ...formData, platform: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border focus:ring-2 focus:ring-amber-500/50 outline-none"
                  >
                    <option>Đa nền tảng</option>
                    <option>Facebook</option>
                    <option>TikTok</option>
                    <option>Instagram</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Thời gian</label>
                  <select
                    value={formData.duration}
                    onChange={e => setFormData({ ...formData, duration: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border focus:ring-2 focus:ring-amber-500/50 outline-none"
                  >
                    <option>1 Tuần</option>
                    <option>1 Tháng</option>
                    <option>Quý</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={generateMutation.isPending}
                className="w-full py-4 rounded-xl font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/25 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {generateMutation.isPending ? (
                  <span className="animate-pulse flex items-center gap-2">
                    <BrainCircuit className="w-5 h-5 animate-spin" /> Phân tích...
                  </span>
                ) : (
                  <>
                    <Target className="w-5 h-5" /> Phân tích chiến lược
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="lg:col-span-8">
            {generateMutation.isPending ? (
              <div className="h-full min-h-[400px] bg-card rounded-2xl border border-border/50 flex flex-col items-center justify-center">
                <BrainCircuit className="w-16 h-16 text-amber-500 animate-bounce mb-4" />
                <p className="text-muted-foreground animate-pulse text-lg">Hệ thống đang thiết kế chiến lược...</p>
              </div>
            ) : generateMutation.data ? (
              <div className="bg-card rounded-2xl border border-border/50 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-500">
                <div className="p-6 border-b border-border/50 bg-gradient-to-r from-amber-500/10 to-transparent flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold font-display text-amber-500 flex items-center gap-2">
                      <Target className="w-6 h-6" /> {generateMutation.data.campaignAngle}
                    </h2>
                    {formData.storeSituation && (
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Đã phân tích từ tình trạng thực tế
                      </p>
                    )}
                  </div>
                  <button
                    onClick={handleSendToPipeline}
                    className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-bold shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 transition-all shrink-0"
                  >
                    <Send className="w-4 h-4" /> Gửi sang Pipeline AI
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-6 space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-secondary/30 rounded-xl border border-border/50">
                      <p className="text-xs text-muted-foreground mb-1">Mô hình áp dụng</p>
                      <p className="font-bold text-primary">{generateMutation.data.marketingModel}</p>
                    </div>
                    <div className="p-4 bg-secondary/30 rounded-xl border border-border/50">
                      <p className="text-xs text-muted-foreground mb-1">Giai đoạn Phễu</p>
                      <p className="font-bold text-emerald-500">{generateMutation.data.funnelStage}</p>
                    </div>
                    <div className="p-4 bg-secondary/30 rounded-xl border border-border/50">
                      <p className="text-xs text-muted-foreground mb-1">Cảm xúc mục tiêu</p>
                      <p className="font-bold text-rose-500">{generateMutation.data.targetEmotion}</p>
                    </div>
                    <div className="p-4 bg-secondary/30 rounded-xl border border-border/50">
                      <p className="text-xs text-muted-foreground mb-1">Chiến lược CTA</p>
                      <p className="font-bold text-blue-500">{generateMutation.data.ctaStrategy}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-bold text-foreground flex items-center gap-2">
                      <BrainCircuit className="w-5 h-5 text-amber-500" /> Lý luận AI (Reasoning)
                    </h4>
                    <p className="p-4 bg-secondary/20 rounded-xl text-sm leading-relaxed text-muted-foreground border border-border/50">
                      {generateMutation.data.reasoning}
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-foreground">Gợi ý chủ đề triển khai</h4>
                      <p className="text-xs text-muted-foreground">Nhấn "Gửi sang Pipeline" để tạo nội dung từ chủ đề đầu tiên</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {generateMutation.data.suggestedTopics.map((topic: string, i: number) => (
                        <div key={i} className="flex items-start gap-3 p-3 bg-secondary/30 rounded-xl border border-border hover:border-amber-500/50 transition-colors cursor-default">
                          <div className="w-6 h-6 rounded bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                            {i + 1}
                          </div>
                          <p className="text-sm">{topic}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-foreground">Sẵn sàng tạo nội dung từ chiến lược này?</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Pipeline AI sẽ được điền sẵn thông tin brand, topic và mục tiêu.</p>
                    </div>
                    <button
                      onClick={handleSendToPipeline}
                      className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all shrink-0"
                    >
                      <Send className="w-4 h-4" /> Gửi sang Pipeline
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full min-h-[400px] border-2 border-dashed border-border/50 rounded-2xl flex flex-col items-center justify-center text-center p-8">
                <Target className="w-16 h-16 text-muted-foreground/30 mb-4" />
                <h3 className="text-xl font-bold">Chưa có bản kế hoạch</h3>
                <p className="text-muted-foreground mt-2">Nhập thông tin mục tiêu để AI giúp bạn vạch ra chiến lược.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
