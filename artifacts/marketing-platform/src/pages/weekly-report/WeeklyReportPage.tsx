import { useQueryClient } from "@tanstack/react-query";
import {
  useListWeeklyReports,
  useGenerateWeeklyReport,
  useApproveWeeklyReport,
  type WeeklyReport,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  FileBarChart,
  RefreshCw,
  CheckCircle2,
  MessageSquare,
  AlertTriangle,
  Lightbulb,
  TrendingUp,
  Globe,
} from "lucide-react";

type Kpi = {
  reviewsAutoReplied: number;
  reviewsEscalated: number;
  commentsHandled: number;
  trendsProposed: number;
  strategyItemsPending: number;
  marketSignals: number;
};

type Insight = { kind: "success" | "danger" | "info"; title: string; detail: string };
type Sections = {
  topTrends?: Array<{ trendName: string; score: number }>;
  pendingStrategy?: Array<{ id: number; content: string }>;
  marketSignals?: Array<{ source: string; title: string }>;
  insights?: Insight[];
};

const INSIGHT_STYLE: Record<string, string> = {
  success: "border-green-200 bg-green-50",
  danger: "border-red-200 bg-red-50",
  info: "border-blue-200 bg-blue-50",
};

export default function WeeklyReportPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: reports, isLoading } = useListWeeklyReports({ limit: 20 });
  const generateMutation = useGenerateWeeklyReport();
  const approveMutation = useApproveWeeklyReport();

  const latest: WeeklyReport | undefined = reports?.[0];
  const kpi = (latest?.kpiData ?? null) as Kpi | null;
  const sections = (latest?.sections ?? {}) as Sections;

  const refresh = () => queryClient.invalidateQueries();

  const generate = () =>
    generateMutation.mutate(undefined, {
      onSuccess: () => {
        toast({ title: "Đã tạo báo cáo tuần" });
        refresh();
      },
      onError: () => toast({ title: "Lỗi tạo báo cáo", variant: "destructive" }),
    });

  const approve = () => {
    if (!latest) return;
    approveMutation.mutate(
      { id: latest.id },
      {
        onSuccess: () => {
          toast({ title: "Đã duyệt kế hoạch tuần" });
          refresh();
        },
      },
    );
  };

  const chartData = kpi
    ? [
        { name: "Review auto", value: kpi.reviewsAutoReplied, color: "#16a34a" },
        { name: "Escalated", value: kpi.reviewsEscalated, color: "#dc2626" },
        { name: "Comments", value: kpi.commentsHandled, color: "#2563eb" },
        { name: "Trends", value: kpi.trendsProposed, color: "#9333ea" },
        { name: "Ý tưởng", value: kpi.strategyItemsPending, color: "#d97706" },
        { name: "Tín hiệu TT", value: kpi.marketSignals, color: "#0891b2" },
      ]
    : [];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <FileBarChart className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold">Báo cáo tuần</h1>
              <p className="text-sm text-muted-foreground">
                {latest ? `KW ${latest.weekNumber} · ${latest.weekStart ?? ""}` : "Chưa có báo cáo"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={generate} disabled={generateMutation.isPending}>
              <RefreshCw className="w-4 h-4 mr-1.5" />
              {generateMutation.isPending ? "Đang tạo..." : "Tạo báo cáo"}
            </Button>
            {latest && !latest.approvedByUser && (
              <Button onClick={approve} disabled={approveMutation.isPending}>
                <CheckCircle2 className="w-4 h-4 mr-1.5" /> Duyệt kế hoạch
              </Button>
            )}
            {latest?.approvedByUser && (
              <Badge className="bg-green-100 text-green-800 gap-1">
                <CheckCircle2 className="w-3 h-3" /> Đã duyệt
              </Badge>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : !latest ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            Chưa có báo cáo. Bấm "Tạo báo cáo" để tổng hợp tuần này.
          </Card>
        ) : (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <Kpi label="Review auto" value={kpi?.reviewsAutoReplied ?? 0} icon={CheckCircle2} accent="text-green-600" />
              <Kpi label="Cần xử lý" value={kpi?.reviewsEscalated ?? 0} icon={AlertTriangle} accent="text-red-600" />
              <Kpi label="Comments" value={kpi?.commentsHandled ?? 0} icon={MessageSquare} accent="text-blue-600" />
              <Kpi label="Trends" value={kpi?.trendsProposed ?? 0} icon={TrendingUp} accent="text-purple-600" />
              <Kpi label="Ý tưởng chờ" value={kpi?.strategyItemsPending ?? 0} icon={Lightbulb} accent="text-amber-600" />
              <Kpi label="Tín hiệu TT" value={kpi?.marketSignals ?? 0} icon={Globe} accent="text-cyan-600" />
            </div>

            {/* Chart */}
            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-3">Tổng quan hoạt động tuần</h3>
              <div style={{ width: "100%", height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={chartData}>
                    <XAxis dataKey="name" fontSize={11} />
                    <YAxis allowDecimals={false} fontSize={11} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {chartData.map((d, i) => (
                        <Cell key={i} fill={d.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Insights */}
            {(sections.insights ?? []).length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {sections.insights!.map((ins, i) => (
                  <Card key={i} className={`p-4 border ${INSIGHT_STYLE[ins.kind]}`}>
                    <p className="font-medium text-sm">{ins.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{ins.detail}</p>
                  </Card>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Panel title="Top trend" icon={TrendingUp}>
                {(sections.topTrends ?? []).length === 0 ? (
                  <Empty />
                ) : (
                  sections.topTrends!.map((t, i) => (
                    <Row key={i} left={t.trendName} right={String(t.score)} />
                  ))
                )}
              </Panel>
              <Panel title="Ý tưởng chờ duyệt" icon={Lightbulb}>
                {(sections.pendingStrategy ?? []).length === 0 ? (
                  <Empty />
                ) : (
                  sections.pendingStrategy!.map((s) => (
                    <p key={s.id} className="text-sm text-muted-foreground truncate">• {s.content}</p>
                  ))
                )}
              </Panel>
              <Panel title="Tín hiệu thị trường" icon={Globe}>
                {(sections.marketSignals ?? []).length === 0 ? (
                  <Empty />
                ) : (
                  sections.marketSignals!.map((m, i) => (
                    <p key={i} className="text-sm text-muted-foreground truncate">
                      <span className="text-xs uppercase text-primary mr-1">{m.source}</span>
                      {m.title}
                    </p>
                  ))
                )}
              </Panel>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}

function Kpi({ label, value, icon: Icon, accent }: { label: string; value: number; icon: typeof CheckCircle2; accent: string }) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">
        <Icon className={`w-4 h-4 ${accent}`} /> {label}
      </div>
      <div className="text-xl font-bold">{value}</div>
    </Card>
  );
}

function Panel({ title, icon: Icon, children }: { title: string; icon: typeof CheckCircle2; children: React.ReactNode }) {
  return (
    <Card className="p-4 space-y-1.5">
      <div className="flex items-center gap-2 text-sm font-semibold mb-1">
        <Icon className="w-4 h-4 text-primary" /> {title}
      </div>
      {children}
    </Card>
  );
}

function Row({ left, right }: { left: string; right: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="truncate">{left}</span>
      <Badge variant="secondary">{right}</Badge>
    </div>
  );
}

function Empty() {
  return <p className="text-xs text-muted-foreground italic">Trống.</p>;
}
