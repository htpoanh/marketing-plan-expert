import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { useToast } from "@/hooks/use-toast";
import { 
  Bot, Brain, Pen, TrendingUp, Save, RotateCcw, 
  ChevronDown, ChevronUp, Sparkles, Shield, Zap, Info
} from "lucide-react";

const AGENT_DISPLAY = {
  grok: {
    icon: TrendingUp,
    color: "from-orange-500 to-red-500",
    bg: "bg-orange-500/10 border-orange-500/20",
    badge: "bg-orange-500/20 text-orange-400",
    label: "Agent 1",
    tip: "Agent này nghiên cứu xu hướng thị trường, từ khóa trending và bối cảnh mùa vụ. Training thêm về ngành của bạn giúp AI tìm đúng trend.",
  },
  openai: {
    icon: Brain,
    color: "from-green-500 to-emerald-500",
    bg: "bg-green-500/10 border-green-500/20",
    badge: "bg-green-500/20 text-green-400",
    label: "Agent 2 & 4",
    tip: "Agent này lập chiến lược marketing và tạo prompts hình ảnh/video. Cung cấp thông tin ngành sẽ giúp AI chọn mô hình (AIDA, STP...) chuẩn hơn.",
  },
  gemini: {
    icon: Pen,
    color: "from-blue-500 to-violet-500",
    bg: "bg-blue-500/10 border-blue-500/20",
    badge: "bg-blue-500/20 text-blue-400",
    label: "Agent 3",
    tip: "Agent viết nội dung trực tiếp. Đây là AI quan trọng nhất — training tốt sẽ giúp giọng văn nhất quán với thương hiệu của bạn.",
  },
};

function AgentCard({ agent, onSave, onReset }: { agent: any; onSave: (key: string, data: any) => void; onReset: (key: string) => void }) {
  const display = AGENT_DISPLAY[agent.agentKey as keyof typeof AGENT_DISPLAY];
  const Icon = display?.icon ?? Bot;
  const [expanded, setExpanded] = useState(true);
  const [form, setForm] = useState({
    expertiseArea: agent.expertiseArea ?? "",
    customInstructions: agent.customInstructions ?? "",
    outputStyle: agent.outputStyle ?? "",
  });
  const [dirty, setDirty] = useState(false);

  const handleChange = (field: string, val: string) => {
    setForm(prev => ({ ...prev, [field]: val }));
    setDirty(true);
  };

  return (
    <div className={`rounded-2xl border ${display?.bg ?? "bg-secondary/30 border-border/50"} overflow-hidden`}>
      <button
        className="w-full flex items-center justify-between p-5 text-left hover:bg-white/5 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${display?.color ?? "from-primary to-accent"} flex items-center justify-center shadow-lg flex-shrink-0`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${display?.badge}`}>{display?.label}</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full bg-secondary/50 text-muted-foreground`}>{agent.aiModel}</span>
              {(form.expertiseArea || form.customInstructions) && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/20 text-primary">Đã training</span>
              )}
            </div>
            <h3 className="font-semibold text-foreground">{agent.agentName}</h3>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-5">
          <div className="p-3 bg-secondary/30 rounded-xl border border-border/30 flex gap-2">
            <Info className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground leading-relaxed mb-1"><strong className="text-foreground">Vai trò mặc định:</strong> {agent.defaultRole}</p>
              <p className="text-xs text-primary/80">{display?.tip}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Chuyên môn / Ngành nghề <span className="text-xs text-muted-foreground font-normal">(training AI biết về lĩnh vực của bạn)</span>
              </label>
              <input
                value={form.expertiseArea}
                onChange={e => handleChange("expertiseArea", e.target.value)}
                placeholder="Vd: Nail salon cao cấp tập trung vào nail nghệ thuật 3D, khách hàng chủ yếu 25-35 tuổi, giá trung bình 300k-800k..."
                className="w-full px-4 py-3 rounded-xl bg-background/50 border border-border focus:ring-2 focus:ring-primary/50 outline-none text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                Hướng dẫn bổ sung <span className="text-xs text-muted-foreground font-normal">(phong cách, quy tắc AI cần tuân theo)</span>
              </label>
              <textarea
                rows={4}
                value={form.customInstructions}
                onChange={e => handleChange("customInstructions", e.target.value)}
                placeholder="Vd: Luôn viết giọng thân thiện, gần gũi như người bạn thân. Không dùng từ ngữ quá hoa mỹ. Luôn đề cập đến địa chỉ cửa hàng ở cuối bài. Hashtag phải có #nailsaigon..."
                className="w-full px-4 py-3 rounded-xl bg-background/50 border border-border focus:ring-2 focus:ring-primary/50 outline-none text-sm resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                Định dạng output <span className="text-xs text-muted-foreground font-normal">(cách trình bày nội dung)</span>
              </label>
              <input
                value={form.outputStyle}
                onChange={e => handleChange("outputStyle", e.target.value)}
                placeholder="Vd: Caption cần có emoji, xuống dòng sau mỗi ý, CTA in hoa, hashtag viết thường liền nhau..."
                className="w-full px-4 py-3 rounded-xl bg-background/50 border border-border focus:ring-2 focus:ring-primary/50 outline-none text-sm"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              disabled={!dirty}
              onClick={() => { onSave(agent.agentKey, form); setDirty(false); }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary text-white rounded-xl font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" /> Lưu cấu hình
            </button>
            <button
              onClick={() => {
                onReset(agent.agentKey);
                setForm({ expertiseArea: "", customInstructions: "", outputStyle: "" });
                setDirty(false);
              }}
              className="px-4 py-2.5 border border-border/50 text-muted-foreground rounded-xl text-sm hover:bg-secondary/50 transition-colors flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AIAgentsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: agents = [], isLoading } = useQuery({
    queryKey: ["ai-agents"],
    queryFn: async () => {
      const r = await fetch("/api/ai-agents");
      if (!r.ok) throw new Error("Failed to fetch agents");
      return r.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ key, data }: { key: string; data: any }) => {
      const r = await fetch(`/api/ai-agents/${key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error("Failed to save");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-agents"] });
      toast({ title: "Đã lưu", description: "Cấu hình AI đã được cập nhật và sẽ áp dụng ngay cho pipeline tiếp theo." });
    },
    onError: () => toast({ title: "Lỗi", description: "Không thể lưu cấu hình", variant: "destructive" }),
  });

  const resetMutation = useMutation({
    mutationFn: async (key: string) => {
      const r = await fetch(`/api/ai-agents/reset/${key}`, { method: "POST" });
      if (!r.ok) throw new Error("Failed to reset");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-agents"] });
      toast({ title: "Đã reset", description: "AI đã về cấu hình mặc định." });
    },
  });

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/25">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-display font-bold">Cấu hình AI Agents</h1>
          </div>
          <p className="text-muted-foreground">Training từng AI agent theo lĩnh vực và phong cách thương hiệu của bạn. Các cài đặt này sẽ được áp dụng tự động mỗi khi chạy pipeline.</p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[
            { icon: Zap, title: "Tự động học", desc: "AI dùng cấu hình của bạn trong mỗi lần tạo nội dung" },
            { icon: Shield, title: "Nhất quán", desc: "Giọng văn và phong cách thống nhất xuyên suốt" },
            { icon: Sparkles, title: "Chuyên sâu hơn", desc: "Nội dung phù hợp hơn với ngành và khách hàng của bạn" },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="p-4 bg-card border border-border/50 rounded-xl text-center">
              <Icon className="w-5 h-5 text-primary mx-auto mb-2" />
              <p className="text-sm font-semibold">{title}</p>
              <p className="text-xs text-muted-foreground mt-1">{desc}</p>
            </div>
          ))}
        </div>

        {isLoading ? (
          <div className="text-center text-muted-foreground py-12">Đang tải cấu hình AI...</div>
        ) : (
          <div className="space-y-4">
            {agents.map((agent: any) => (
              <AgentCard
                key={agent.agentKey}
                agent={agent}
                onSave={(key, data) => saveMutation.mutate({ key, data })}
                onReset={(key) => resetMutation.mutate(key)}
              />
            ))}
          </div>
        )}

        <div className="p-5 bg-primary/5 border border-primary/20 rounded-2xl">
          <h3 className="font-semibold text-primary mb-2 flex items-center gap-2">
            <Info className="w-4 h-4" /> Mẹo training hiệu quả
          </h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• <strong className="text-foreground">Chuyên môn</strong>: Mô tả cụ thể ngành, phân khúc giá, đối tượng khách hàng, điểm khác biệt so với đối thủ</li>
            <li>• <strong className="text-foreground">Hướng dẫn</strong>: Quy tắc giọng văn, từ ngữ nên/không nên dùng, cách đề cập địa chỉ, SĐT trong bài</li>
            <li>• <strong className="text-foreground">Định dạng</strong>: Cấu trúc bài, cách dùng emoji, xuống dòng, hashtag format</li>
            <li>• <strong className="text-foreground">Địa chỉ & SĐT</strong>: Điền vào hồ sơ cửa hàng — AI sẽ tự động thêm vào caption mà không cần nhắc</li>
          </ul>
        </div>
      </div>
    </AppLayout>
  );
}
