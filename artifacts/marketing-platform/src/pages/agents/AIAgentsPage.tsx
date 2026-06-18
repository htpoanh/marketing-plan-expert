import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { useToast } from "@/hooks/use-toast";
import {
  Bot, Brain, Pen, TrendingUp, Save, RotateCcw,
  Plus, Copy, Trash2, X, ChevronRight, Star, Layers,
  Sparkles, Check, MessageSquareHeart
} from "lucide-react";

type AiProfile = {
  id: number;
  profileName: string;
  industry: string | null;
  description: string | null;
  isDefault: boolean;
};

type AgentConfig = {
  id: number;
  profileId: number;
  agentKey: string;
  agentName: string;
  aiModel: string;
  defaultRole: string;
  expertiseArea: string | null;
  customInstructions: string | null;
  outputStyle: string | null;
};

const AGENT_META: Record<string, { icon: React.ReactNode; color: string; badge: string; hint: string }> = {
  trend: {
    icon: <TrendingUp className="w-5 h-5" />,
    color: "from-orange-500 to-red-500",
    badge: "Agent 1",
    hint: "Training Agent 1 biết ngành của bạn giúp AI tìm đúng trend phù hợp.",
  },
  openai: {
    icon: <Brain className="w-5 h-5" />,
    color: "from-green-500 to-emerald-500",
    badge: "Agent 2 & 4",
    hint: "Agent 2 xây chiến lược, Agent 4 tạo prompt hình ảnh/video. Training cả 2.",
  },
  gemini: {
    icon: <Pen className="w-5 h-5" />,
    color: "from-blue-500 to-violet-500",
    badge: "Agent 3",
    hint: "Agent 3 viết caption. Training giọng điệu & cách trình bày content của ngành.",
  },
  claude: {
    icon: <MessageSquareHeart className="w-5 h-5" />,
    color: "from-amber-500 to-orange-500",
    badge: "Agent 5",
    hint: "Claude biên tập nội dung tiếng Đức tự nhiên hơn và viết phản hồi Google Reviews chuyên nghiệp.",
  },
};

function AgentCard({ agent, profileId, onSaved }: { agent: AgentConfig; profileId: number; onSaved: () => void }) {
  const { toast } = useToast();
  const [expertise, setExpertise] = useState(agent.expertiseArea ?? "");
  const [instructions, setInstructions] = useState(agent.customInstructions ?? "");
  const [style, setStyle] = useState(agent.outputStyle ?? "");
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const meta = AGENT_META[agent.agentKey] ?? AGENT_META.trend;

  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch(`/api/ai-profiles/${profileId}/agents/${agent.agentKey}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ expertiseArea: expertise, customInstructions: instructions, outputStyle: style }),
      });
      if (!r.ok) throw new Error();
      toast({ title: "Đã lưu cấu hình agent" });
      onSaved();
    } catch {
      toast({ title: "Lỗi khi lưu", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    setResetting(true);
    try {
      const r = await fetch(`/api/ai-profiles/${profileId}/reset/${agent.agentKey}`, { method: "POST", credentials: "include" });
      if (!r.ok) throw new Error();
      setExpertise(""); setInstructions(""); setStyle("");
      toast({ title: "Đã reset về mặc định" });
      onSaved();
    } catch {
      toast({ title: "Lỗi khi reset", variant: "destructive" });
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
      <div className={`bg-gradient-to-r ${meta.color} p-4 flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white">
            {meta.icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white/70 uppercase tracking-wider">{meta.badge}</span>
              <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full">{agent.aiModel}</span>
            </div>
            <p className="text-white font-semibold text-sm mt-0.5">{agent.agentName}</p>
          </div>
        </div>
      </div>
      <div className="p-5 space-y-4">
        <p className="text-xs text-primary/80 bg-primary/5 border border-primary/10 rounded-lg px-3 py-2">{meta.hint}</p>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Chuyên môn / Ngành nghề
            <span className="ml-1 font-normal normal-case">(training AI biết về lĩnh vực của bạn)</span>
          </label>
          <textarea
            value={expertise}
            onChange={e => setExpertise(e.target.value)}
            rows={2}
            className="w-full px-3 py-2.5 rounded-xl bg-secondary/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none transition-all"
            placeholder="Vd: Nail salon cao cấp tập trung vào nail nghệ thuật 3D, khách hàng chủ yếu 25-35 tuổi, giá trung bình 300-500k..."
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Hướng dẫn bổ sung
            <span className="ml-1 font-normal normal-case">(phong cách, quy tắc AI cần tuân theo)</span>
          </label>
          <textarea
            value={instructions}
            onChange={e => setInstructions(e.target.value)}
            rows={3}
            className="w-full px-3 py-2.5 rounded-xl bg-secondary/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none transition-all"
            placeholder="Vd: Luôn viết giọng thân thiện, gần gũi như người bạn thân. Không dùng từ ngữ quá hoa mỹ..."
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Định dạng output
            <span className="ml-1 font-normal normal-case">(cách trình bày nội dung)</span>
          </label>
          <textarea
            value={style}
            onChange={e => setStyle(e.target.value)}
            rows={2}
            className="w-full px-3 py-2.5 rounded-xl bg-secondary/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none transition-all"
            placeholder="Vd: Caption cần có emoji, xuống dòng sau mỗi ý, CTA in hoa, hashtag viết thường liền nhau..."
          />
        </div>
        <div className="flex gap-2 pt-1">
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            <Save className="w-4 h-4" />
            {saving ? "Đang lưu..." : "Lưu cấu hình"}
          </button>
          <button
            onClick={reset}
            disabled={resetting}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}

type CreateProfileModalProps = {
  profiles: AiProfile[];
  onClose: () => void;
  onCreate: (data: { profileName: string; industry: string; description: string; cloneFromId: number | null }) => void;
  creating: boolean;
};

function CreateProfileModal({ profiles, onClose, onCreate, creating }: CreateProfileModalProps) {
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [description, setDescription] = useState("");
  const [cloneFrom, setCloneFrom] = useState<number | null>(null);

  const QUICK_INDUSTRIES = ["Nail salon", "Nhà hàng / F&B", "Siêu thị / Tạp hóa", "Thời trang", "Spa / Làm đẹp", "Gym / Yoga", "Khách sạn", "Giáo dục", "Bất động sản", "Khác"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Layers className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-bold">Tạo Profile AI mới</h3>
              <p className="text-xs text-muted-foreground">Mỗi ngành có bộ AI riêng</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium">Tên Profile <span className="text-red-400">*</span></label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="Vd: AI Nail Salon, AI Nhà hàng..."
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Ngành nghề</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {QUICK_INDUSTRIES.map(ind => (
                <button
                  key={ind}
                  onClick={() => { setIndustry(ind); if (!name) setName(`AI ${ind}`); }}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-all ${industry === ind ? "bg-primary text-white border-primary" : "border-border hover:border-primary/50 text-muted-foreground hover:text-foreground"}`}
                >
                  {ind}
                </button>
              ))}
            </div>
            <input
              value={industry}
              onChange={e => setIndustry(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="Hoặc nhập ngành tùy chỉnh..."
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Clone từ profile có sẵn</label>
            <p className="text-xs text-muted-foreground">Sao chép toàn bộ cấu hình agent từ profile chọn, rồi chỉnh sửa thêm.</p>
            <select
              value={cloneFrom ?? ""}
              onChange={e => setCloneFrom(e.target.value ? Number(e.target.value) : null)}
              className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">Bắt đầu từ mặc định (không clone)</option>
              {profiles.map(p => (
                <option key={p.id} value={p.id}>{p.profileName}{p.industry ? ` — ${p.industry}` : ""}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="p-6 border-t border-border/50 flex justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl font-medium hover:bg-secondary transition-colors text-sm">
            Hủy
          </button>
          <button
            onClick={() => onCreate({ profileName: name, industry, description, cloneFromId: cloneFrom })}
            disabled={!name.trim() || creating}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium bg-primary text-white hover:bg-primary/90 disabled:opacity-50 transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            {creating ? "Đang tạo..." : "Tạo Profile"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AIAgentsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);

  const { data: profiles = [], isLoading: profilesLoading } = useQuery<AiProfile[]>({
    queryKey: ["/api/ai-profiles"],
    queryFn: async () => {
      const r = await fetch("/api/ai-profiles", { credentials: "include" });
      if (!r.ok) throw new Error();
      return r.json();
    },
  });

  useEffect(() => {
    if (!selectedProfileId && profiles.length > 0) {
      setSelectedProfileId(profiles.find(p => p.isDefault)?.id ?? profiles[0].id);
    }
  }, [profiles, selectedProfileId]);

  const selectedProfile = profiles.find(p => p.id === selectedProfileId) ?? null;

  const { data: agents = [], isLoading: agentsLoading } = useQuery<AgentConfig[]>({
    queryKey: ["/api/ai-profiles", selectedProfileId, "agents"],
    queryFn: async () => {
      if (!selectedProfileId) return [];
      const r = await fetch(`/api/ai-profiles/${selectedProfileId}/agents`, { credentials: "include" });
      if (!r.ok) throw new Error();
      return r.json();
    },
    enabled: !!selectedProfileId,
  });

  const handleCreate = async (data: { profileName: string; industry: string; description: string; cloneFromId: number | null }) => {
    setCreating(true);
    try {
      const r = await fetch("/api/ai-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error();
      const newProfile = await r.json();
      queryClient.invalidateQueries({ queryKey: ["/api/ai-profiles"] });
      setSelectedProfileId(newProfile.id);
      setShowCreateModal(false);
      toast({ title: `Profile "${data.profileName}" đã được tạo!` });
    } catch {
      toast({ title: "Lỗi khi tạo profile", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (profile: AiProfile) => {
    if (profile.isDefault) return;
    if (!confirm(`Xóa profile "${profile.profileName}"? Thao tác này không thể hoàn tác.`)) return;
    try {
      const r = await fetch(`/api/ai-profiles/${profile.id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error();
      queryClient.invalidateQueries({ queryKey: ["/api/ai-profiles"] });
      if (selectedProfileId === profile.id) {
        setSelectedProfileId(profiles.find(p => p.id !== profile.id)?.id ?? null);
      }
      toast({ title: "Đã xóa profile" });
    } catch {
      toast({ title: "Lỗi khi xóa", variant: "destructive" });
    }
  };

  const handleClone = (profile: AiProfile) => {
    setShowCreateModal(true);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/25">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl font-bold">Nhân bản AI theo Ngành</h1>
            </div>
            <p className="text-sm text-muted-foreground ml-13">Tạo nhiều bộ AI riêng cho từng ngành — Nail, Nhà hàng, Siêu thị... Gán cho từng cửa hàng để AI hiểu đúng ngành đó.</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold bg-gradient-to-r from-primary to-primary/80 text-white shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 text-sm whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Tạo Profile AI mới
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
          {/* ─── Left: Profile List ─── */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-3">Profile AI ({profiles.length})</p>
            {profilesLoading ? (
              <div className="space-y-2">
                {[1, 2].map(i => <div key={i} className="h-20 bg-card rounded-xl border border-border/50 animate-pulse" />)}
              </div>
            ) : (
              profiles.map(profile => (
                <div
                  key={profile.id}
                  onClick={() => setSelectedProfileId(profile.id)}
                  className={`group relative cursor-pointer rounded-xl border p-4 transition-all duration-200 ${
                    selectedProfileId === profile.id
                      ? "bg-primary/10 border-primary/40 shadow-sm shadow-primary/10"
                      : "bg-card border-border/50 hover:border-primary/30 hover:bg-card/80"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {profile.isDefault && (
                          <Star className="w-3 h-3 text-yellow-400 fill-yellow-400 flex-shrink-0" />
                        )}
                        <span className="font-semibold text-sm truncate">{profile.profileName}</span>
                      </div>
                      {profile.industry && (
                        <span className="text-xs text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded-full">{profile.industry}</span>
                      )}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={e => { e.stopPropagation(); setShowCreateModal(true); }}
                        title="Clone profile này"
                        className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      {!profile.isDefault && (
                        <button
                          onClick={e => { e.stopPropagation(); handleDelete(profile); }}
                          title="Xóa profile"
                          className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  {selectedProfileId === profile.id && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <ChevronRight className="w-4 h-4 text-primary" />
                    </div>
                  )}
                </div>
              ))
            )}

            <button
              onClick={() => setShowCreateModal(true)}
              className="w-full mt-2 flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-border hover:border-primary/50 text-sm text-muted-foreground hover:text-foreground transition-all"
            >
              <Plus className="w-4 h-4" />
              Thêm profile
            </button>

            <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <p className="text-xs text-amber-400 font-medium mb-1">Cách dùng:</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>① Tạo profile cho từng ngành</li>
                <li>② Training AI biết chuyên môn ngành đó</li>
                <li>③ Vào <strong className="text-foreground">Quản lý Cửa hàng</strong> → gán profile cho cửa hàng</li>
                <li>④ Pipeline sẽ dùng AI đúng ngành</li>
              </ul>
            </div>
          </div>

          {/* ─── Right: Agent Cards ─── */}
          <div>
            {selectedProfile ? (
              <>
                <div className="flex items-center gap-3 mb-5">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-bold text-lg">{selectedProfile.profileName}</h2>
                      {selectedProfile.isDefault && (
                        <span className="text-xs bg-yellow-400/20 text-yellow-400 px-2 py-0.5 rounded-full border border-yellow-400/30 flex items-center gap-1">
                          <Star className="w-3 h-3 fill-yellow-400" /> Mặc định
                        </span>
                      )}
                    </div>
                    {selectedProfile.industry && (
                      <p className="text-sm text-muted-foreground">Ngành: {selectedProfile.industry}</p>
                    )}
                  </div>
                </div>

                {agentsLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map(i => <div key={i} className="h-72 bg-card rounded-2xl border border-border/50 animate-pulse" />)}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {agents.map(agent => (
                      <AgentCard
                        key={agent.id}
                        agent={agent}
                        profileId={selectedProfile.id}
                        onSaved={() => queryClient.invalidateQueries({ queryKey: ["/api/ai-profiles", selectedProfileId, "agents"] })}
                      />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <Bot className="w-12 h-12 text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">Chọn một profile để xem cấu hình AI</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {showCreateModal && (
        <CreateProfileModal
          profiles={profiles}
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreate}
          creating={creating}
        />
      )}
    </AppLayout>
  );
}
