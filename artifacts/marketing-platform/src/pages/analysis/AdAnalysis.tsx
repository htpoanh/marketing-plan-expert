import { useState, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useListBrands } from "@workspace/api-client-react";
import {
  BarChart2, Upload, Loader2, ChevronDown, ChevronUp, FileText,
  TrendingUp, TrendingDown, Minus, Lightbulb, AlertCircle, Zap, Star
} from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

type Platform = "facebook" | "instagram" | "tiktok" | "google" | "mixed";
const PLATFORMS: { id: Platform; label: string; color: string }[] = [
  { id: "facebook", label: "Facebook Ads", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  { id: "instagram", label: "Instagram Insights", color: "bg-pink-500/20 text-pink-400 border-pink-500/30" },
  { id: "tiktok", label: "TikTok Ads", color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
  { id: "google", label: "Google Ads", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  { id: "mixed", label: "Nhiều nền tảng", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
];

const trendIcon = (t: string) =>
  t === "up" ? <TrendingUp className="w-4 h-4 text-emerald-400" /> :
  t === "down" ? <TrendingDown className="w-4 h-4 text-rose-400" /> :
  <Minus className="w-4 h-4 text-muted-foreground" />;

const priorityBadge = (p: string) =>
  p === "high" ? "bg-rose-500/20 text-rose-400 border-rose-500/30" :
  p === "medium" ? "bg-amber-500/20 text-amber-400 border-amber-500/30" :
  "bg-secondary text-muted-foreground border-border/50";

export default function AdAnalysis() {
  const { data: brands = [] } = useListBrands();
  const [platform, setPlatform] = useState<Platform>("facebook");
  const [brandId, setBrandId] = useState<string>("");
  const [goal, setGoal] = useState("");
  const [rawData, setRawData] = useState("");
  const [contentText, setContentText] = useState("");
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedCampaign, setExpandedCampaign] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = ev => setRawData(String(ev.target?.result ?? ""));
    reader.readAsText(file, "utf-8");
  };

  const handleAnalyze = async () => {
    if (!rawData && !contentText) {
      setError("Hãy tải lên file dữ liệu hoặc nhập nội dung cần phân tích");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    setExpandedCampaign(null);
    try {
      const selectedBrand = (brands as any[]).find(b => b.id === Number(brandId));
      const r = await fetch(`${BASE}/api/ad-analysis/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          rawData: rawData || undefined,
          contentText: contentText || undefined,
          brandName: selectedBrand?.brandName,
          goal: goal || undefined,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Phân tích thất bại");
      setResult(data.analysis);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-8 max-w-5xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-violet-400 to-indigo-400 flex items-center gap-3">
            <BarChart2 className="w-8 h-8 text-violet-400" />
            Phân tích Quảng cáo AI
          </h1>
          <p className="mt-2 text-muted-foreground">
            Upload dữ liệu từ Facebook Ads, TikTok, Instagram, Google Ads — AI phân tích và đề xuất chiến dịch cải thiện.
          </p>
        </div>

        {/* Config panel */}
        <div className="bg-card rounded-2xl border border-border/50 p-6 space-y-6">
          {/* Platform selector */}
          <div>
            <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 block">Nền tảng</label>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map(p => (
                <button
                  key={p.id}
                  onClick={() => setPlatform(p.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                    platform === p.id ? p.color : "bg-secondary/30 text-muted-foreground border-border/40 hover:border-border"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Brand selector */}
            <div>
              <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">Cửa hàng (tuỳ chọn)</label>
              <select
                value={brandId}
                onChange={e => setBrandId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-background border border-border text-sm text-foreground focus:ring-2 focus:ring-primary outline-none"
              >
                <option value="">— Không chọn —</option>
                {(brands as any[]).map(b => (
                  <option key={b.id} value={b.id}>{b.brandName}</option>
                ))}
              </select>
            </div>

            {/* Goal */}
            <div>
              <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">Mục tiêu Marketing</label>
              <input
                value={goal}
                onChange={e => setGoal(e.target.value)}
                placeholder="VD: Tăng đặt lịch, tăng lượt ghé thăm..."
                className="w-full px-3 py-2.5 rounded-xl bg-background border border-border text-sm text-foreground focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
          </div>

          {/* File upload */}
          <div>
            <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">
              Dữ liệu quảng cáo (CSV / TXT export từ Ads Manager)
            </label>
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-border/50 hover:border-primary/40 rounded-xl p-6 text-center cursor-pointer transition-colors group"
            >
              <input ref={fileRef} type="file" accept=".csv,.txt,.tsv,.xlsx,.xls" className="hidden" onChange={handleFile} />
              <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground group-hover:text-primary transition-colors" />
              {fileName ? (
                <div>
                  <p className="font-semibold text-foreground">{fileName}</p>
                  <p className="text-xs text-muted-foreground mt-1">{(rawData.length / 1024).toFixed(1)} KB dữ liệu</p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Kéo thả hoặc click để chọn file</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Hỗ trợ: CSV, TXT export từ Facebook Ads, TikTok Ads, Google Ads</p>
                </div>
              )}
            </div>
            {rawData && (
              <div className="mt-2 p-3 bg-secondary/30 rounded-xl border border-border/50">
                <p className="text-xs text-muted-foreground font-mono line-clamp-3">{rawData.substring(0, 200)}...</p>
              </div>
            )}
          </div>

          {/* Content paste area */}
          <div>
            <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">
              <FileText className="w-4 h-4 inline mr-1" />
              Nội dung Post/Quảng cáo cần AI đánh giá
            </label>
            <textarea
              value={contentText}
              onChange={e => setContentText(e.target.value)}
              rows={6}
              placeholder={`Dán nội dung quảng cáo đã chạy vào đây để AI đánh giá chất lượng...\n\nVD:\n"Mùa xuân đến rồi! Hãy để Paradise Nails làm đẹp cho đôi tay của bạn..."\n\nHoặc dán nhiều bài khác nhau để so sánh.`}
              className="w-full px-4 py-3 rounded-xl bg-background border border-border text-sm text-foreground focus:ring-2 focus:ring-primary outline-none resize-y"
            />
          </div>

          {/* Analyze button */}
          <button
            onClick={handleAnalyze}
            disabled={loading || (!rawData && !contentText)}
            className="w-full py-4 rounded-xl font-bold bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-lg shadow-violet-500/25 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0"
          >
            {loading ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> AI đang phân tích...</>
            ) : (
              <><BarChart2 className="w-5 h-5" /> Phân tích & Đề xuất Chiến dịch</>
            )}
          </button>

          {error && (
            <div className="flex items-start gap-3 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Results */}
        {result && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            {/* Summary */}
            {result.summary && (
              <div className="bg-card rounded-2xl border border-violet-500/30 p-6">
                <h2 className="text-lg font-bold text-violet-400 mb-3 flex items-center gap-2">
                  <Star className="w-5 h-5" /> Tổng quan
                </h2>
                <p className="text-foreground/90 leading-relaxed">{result.summary}</p>
              </div>
            )}

            {/* Key metrics */}
            {result.keyMetrics?.length > 0 && (
              <div>
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <BarChart2 className="w-5 h-5 text-primary" /> Chỉ số Chính
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {result.keyMetrics.map((m: any, i: number) => (
                    <div key={i} className="bg-card rounded-xl border border-border/50 p-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">{m.label}</span>
                        {trendIcon(m.trend)}
                      </div>
                      <p className="text-2xl font-bold text-foreground">{m.value}</p>
                      {m.comment && <p className="text-xs text-muted-foreground mt-1">{m.comment}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Content score */}
            {result.contentScore && (
              <div className="bg-card rounded-2xl border border-border/50 p-6">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-amber-400" /> Đánh giá Nội dung
                </h2>
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-20 h-20 rounded-full border-4 border-primary/30 flex items-center justify-center">
                    <span className="text-2xl font-bold text-primary">{result.contentScore.score}</span>
                  </div>
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    {Object.entries(result.contentScore.breakdown ?? {}).map(([k, v]: any) => (
                      <div key={k}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground capitalize">{k}</span>
                          <span className="font-semibold">{v}/100</span>
                        </div>
                        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${v}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {result.contentScore.feedback && (
                  <p className="text-sm text-muted-foreground leading-relaxed">{result.contentScore.feedback}</p>
                )}
              </div>
            )}

            {/* SWOT */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {result.strengths?.length > 0 && (
                <div className="bg-card rounded-2xl border border-emerald-500/20 p-5">
                  <h3 className="font-bold text-emerald-400 mb-3 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" /> Điểm mạnh
                  </h3>
                  <ul className="space-y-2">
                    {result.strengths.map((s: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                        <span className="text-emerald-400 mt-0.5">✓</span> {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {result.weaknesses?.length > 0 && (
                <div className="bg-card rounded-2xl border border-rose-500/20 p-5">
                  <h3 className="font-bold text-rose-400 mb-3 flex items-center gap-2">
                    <TrendingDown className="w-4 h-4" /> Điểm yếu
                  </h3>
                  <ul className="space-y-2">
                    {result.weaknesses.map((w: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                        <span className="text-rose-400 mt-0.5">!</span> {w}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {result.opportunities?.length > 0 && (
                <div className="bg-card rounded-2xl border border-amber-500/20 p-5 md:col-span-2">
                  <h3 className="font-bold text-amber-400 mb-3 flex items-center gap-2">
                    <Lightbulb className="w-4 h-4" /> Cơ hội cải thiện
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {result.opportunities.map((o: string, i: number) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                        <span className="text-amber-400 mt-0.5">→</span> {o}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Campaigns */}
            {result.campaigns?.length > 0 && (
              <div>
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-primary" /> Chiến dịch Đề xuất ({result.campaigns.length})
                </h2>
                <div className="space-y-3">
                  {result.campaigns.map((c: any, i: number) => (
                    <div key={i} className="bg-card rounded-2xl border border-border/50 overflow-hidden">
                      <button
                        onClick={() => setExpandedCampaign(expandedCampaign === i ? null : i)}
                        className="w-full flex items-center justify-between p-5 text-left hover:bg-secondary/20 transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${priorityBadge(c.priority)}`}>
                            {c.priority === "high" ? "🔴 Ưu tiên cao" : c.priority === "medium" ? "🟡 Trung bình" : "🟢 Thấp"}
                          </span>
                          <span className="font-semibold text-foreground">{c.title}</span>
                          <span className="text-xs text-muted-foreground">{c.contentType} · {c.duration}</span>
                        </div>
                        {expandedCampaign === i ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
                      </button>
                      {expandedCampaign === i && (
                        <div className="px-5 pb-5 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm border-t border-border/50 pt-4 animate-in fade-in slide-in-from-top-2">
                          {[
                            ["Mục tiêu", c.objective],
                            ["Nền tảng", c.platform],
                            ["Ngân sách", c.budget],
                            ["Thời gian chạy", c.duration],
                            ["Đối tượng", c.targetAudience],
                            ["Loại nội dung", c.contentType],
                          ].map(([label, val]) => val && (
                            <div key={label}>
                              <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                              <p className="font-medium text-foreground">{val}</p>
                            </div>
                          ))}
                          {c.contentAngle && (
                            <div className="md:col-span-2">
                              <p className="text-xs text-muted-foreground mb-0.5">Góc tiếp cận nội dung</p>
                              <p className="font-medium text-foreground">{c.contentAngle}</p>
                            </div>
                          )}
                          {c.expectedResult && (
                            <div className="md:col-span-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                              <p className="text-xs text-emerald-400 mb-0.5">Kết quả kỳ vọng</p>
                              <p className="text-sm text-foreground">{c.expectedResult}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick wins */}
            {result.quickWins?.length > 0 && (
              <div className="bg-card rounded-2xl border border-primary/20 p-6">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-primary">
                  <Zap className="w-5 h-5" /> Quick Wins — Làm ngay hôm nay
                </h2>
                <div className="space-y-2">
                  {result.quickWins.map((qw: string, i: number) => (
                    <div key={i} className="flex items-start gap-3 p-3 bg-primary/5 rounded-xl border border-primary/10">
                      <span className="text-primary font-bold text-sm shrink-0">{i + 1}.</span>
                      <p className="text-sm text-foreground/90">{qw}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
