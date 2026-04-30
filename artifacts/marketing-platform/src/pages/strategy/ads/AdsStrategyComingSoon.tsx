import { AppLayout } from "@/components/layout/AppLayout";
import { Sparkles, Target, Hash, BarChart3, Radar } from "lucide-react";

/**
 * Phase 1 placeholder. The real Ads Strategy Page lands in Phase 2 (M1+M2)
 * and Phase 3 (M3) per docs/UPGRADE_PLAN.md.
 *
 * Backend endpoints + DB schema + OpenAPI types are already in place — this
 * page is just the entry point so the navigation is wired up early and the
 * old `/analysis` page (replaced per audit decision 4A) doesn't 404.
 */
export default function AdsStrategyComingSoon() {
  const modules = [
    {
      id: "audience",
      icon: Target,
      title: "M1 — Phân tích đối tượng",
      desc: "Tự động sinh personas + JSON targeting cho Meta/Google Ads dựa trên brand context.",
      ai: "Claude Haiku",
      color: "from-violet-500/20 to-fuchsia-500/20 border-violet-500/30",
    },
    {
      id: "keyword",
      icon: Hash,
      title: "M2 — Keyword có sức nặng",
      desc: "4 nhóm keyword theo intent (informational, commercial, navigational, transactional) + negative keywords.",
      ai: "Gemini Flash",
      color: "from-emerald-500/20 to-teal-500/20 border-emerald-500/30",
    },
    {
      id: "performance",
      icon: BarChart3,
      title: "M3 — Performance Reality",
      desc: "Upload CSV ads (Meta/Google) → phân tích lãng phí + đề xuất chia lại budget cụ thể €.",
      ai: "Claude Sonnet",
      color: "from-amber-500/20 to-orange-500/20 border-amber-500/30",
    },
    {
      id: "trend",
      icon: Radar,
      title: "M4 — Trend Pulse",
      desc: "Trend real-time từ Đức + Bayern, citations sources, suggested angle để bắt sóng nhanh.",
      ai: "Grok 3",
      color: "from-rose-500/20 to-pink-500/20 border-rose-500/30",
    },
  ];

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto p-6 space-y-8">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/25 shrink-0">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Ads Strategy Agent</h1>
            <p className="text-muted-foreground mt-2 max-w-2xl">
              Bộ 4 module AI giúp tối ưu quảng cáo: phân tích đối tượng, sinh keyword,
              audit performance, và bắt trend. Đang trong giai đoạn triển khai —
              backend đã sẵn sàng, UI sẽ cập nhật ở Phase 2 & 3.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {modules.map((m) => {
            const Icon = m.icon;
            return (
              <div
                key={m.id}
                className={`p-5 rounded-xl border bg-gradient-to-br ${m.color} hover:shadow-lg transition-shadow`}
                data-testid={`ads-module-${m.id}`}
              >
                <div className="flex items-start gap-3">
                  <Icon className="w-5 h-5 mt-0.5 text-foreground" />
                  <div className="flex-1">
                    <h3 className="font-semibold">{m.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{m.desc}</p>
                    <div className="text-xs text-muted-foreground mt-3 font-mono">
                      AI: {m.ai}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-sm text-muted-foreground border-l-2 border-primary/40 pl-4 py-2">
          <strong>Trang AdAnalysis cũ</strong> đã được thay thế bởi module này (quyết
          định 4A trong AUDIT_REPORT). Khi Phase 2 ship, các tab sẽ hiển thị form
          + kết quả thực tế.
        </div>
      </div>
    </AppLayout>
  );
}
