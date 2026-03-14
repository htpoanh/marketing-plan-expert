import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MessagesSquare, Settings, CalendarCheck, CheckCircle2, XCircle,
  Clock, ChevronDown, ChevronUp, Copy, ExternalLink, RefreshCw,
  AlertCircle, Info, Shield, Phone, User, Scissors, Calendar,
  Link2, Key, Globe, Zap, ArrowRight, BookOpen, Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
const getApiUrl = (path: string) => `${BASE}${path}`;

interface BrandOverview {
  brand: {
    id: number;
    brandName: string;
    industry: string;
    branchLocation: string;
  };
  config: {
    id?: number;
    brandId?: number;
    pageAccessToken?: string;
    verifyToken?: string;
    managerPsid?: string;
    pageId?: string;
    isActive: boolean;
    welcomeMessage?: string;
    businessHoursInfo?: string;
    servicesInfo?: string;
  } | null;
  stats: {
    pending: number;
    confirmed: number;
    total: number;
  };
}

interface Appointment {
  id: number;
  brandId: number;
  brandName: string;
  customerPsid: string;
  customerName: string;
  service: string;
  preferredDate: string;
  preferredTime: string;
  phone: string;
  status: "pending" | "confirmed" | "rejected";
  notes?: string;
  createdAt: string;
  confirmedAt?: string;
}

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  confirmed: "bg-green-100 text-green-800 border-green-200",
  rejected: "bg-red-100 text-red-800 border-red-200",
};

const STATUS_ICONS: Record<string, JSX.Element> = {
  pending: <Clock className="w-3.5 h-3.5" />,
  confirmed: <CheckCircle2 className="w-3.5 h-3.5" />,
  rejected: <XCircle className="w-3.5 h-3.5" />,
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Đang chờ",
  confirmed: "Đã xác nhận",
  rejected: "Đã từ chối",
};

function ConfigForm({ brandId, initialConfig, onSaved }: {
  brandId: number;
  initialConfig: BrandOverview["config"];
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    pageAccessToken: initialConfig?.pageAccessToken ?? "",
    verifyToken: initialConfig?.verifyToken ?? "",
    managerPsid: initialConfig?.managerPsid ?? "",
    pageId: initialConfig?.pageId ?? "",
    isActive: initialConfig?.isActive ?? false,
    welcomeMessage: initialConfig?.welcomeMessage ?? "",
    businessHoursInfo: initialConfig?.businessHoursInfo ?? "Di–Sa 9:00–19:00, So 10:00–17:00",
    servicesInfo: initialConfig?.servicesInfo ?? "Gel Nails, Acryl, Pedicure, Maniküre, Nageldesign",
  });

  const qc = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(getApiUrl(`/api/messenger/config/${brandId}`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "✅ Đã lưu cấu hình Messenger!" });
      qc.invalidateQueries({ queryKey: ["messenger-overview"] });
      onSaved();
    },
    onError: (e: any) => {
      toast({ title: "Lỗi", description: e.message, variant: "destructive" });
    },
  });

  const set = (key: string, val: any) => setForm(f => ({ ...f, [key]: val }));

  const origin = window.location.origin.replace(/:\d+$/, "");
  const webhookUrl = `${origin}/api/messenger/webhook`;
  const makeEndpointUrl = `${origin}/api/messenger/process-make`;

  const [guideTab, setGuideTab] = useState<"make" | "direct">("make");
  const [guideOpen, setGuideOpen] = useState(false);

  return (
    <div className="space-y-6">

      {/* ── Connection flow diagram ────────────────────────────────── */}
      <div className="p-4 rounded-xl border border-orange-200 bg-orange-50">
        <p className="text-sm font-bold text-orange-700 mb-3 flex items-center gap-2">
          <img src="https://www.make.com/en/images/favicons/favicon.ico" className="w-4 h-4" onError={e => (e.currentTarget.style.display="none")} alt="" />
          Luồng kết nối qua Make.com
        </p>
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          {[
            { icon: "💬", label: "Khách nhắn\nMessenger" },
            { arrow: true },
            { icon: "🔶", label: "Make.com\nnhận tin" },
            { arrow: true },
            { icon: "🤖", label: "AI Server\n(GPT-4o)" },
            { arrow: true },
            { icon: "🔶", label: "Make.com\ngửi reply" },
            { arrow: true },
            { icon: "📩", label: "Khách nhận\ntrả lời Đức" },
          ].map((item, i) =>
            (item as any).arrow ? (
              <ArrowRight key={i} className="w-3 h-3 text-orange-400 flex-shrink-0" />
            ) : (
              <div key={i} className="flex flex-col items-center text-center px-2 py-1.5 bg-white rounded-lg border border-orange-200 shadow-sm min-w-[56px]">
                <span className="text-sm mb-0.5">{(item as any).icon}</span>
                <span className="text-[10px] text-foreground/70 whitespace-pre-line leading-tight">{(item as any).label}</span>
              </div>
            )
          )}
        </div>
      </div>

      {/* ── Step-by-step guide (collapsible, 2 tabs) ───────────────────────── */}
      <div className="rounded-xl border border-border overflow-hidden">
        <button
          type="button"
          onClick={() => setGuideOpen(v => !v)}
          className="w-full flex items-center justify-between p-4 bg-secondary/40 hover:bg-secondary/60 transition-colors text-left"
        >
          <span className="flex items-center gap-2 font-semibold text-sm">
            <BookOpen className="w-4 h-4 text-primary" />
            📋 Hướng dẫn kết nối từng bước
          </span>
          {guideOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>

        {guideOpen && (
          <div className="border-t border-border bg-card">
            {/* Tab switcher */}
            <div className="flex border-b border-border">
              <button
                type="button"
                onClick={() => setGuideTab("make")}
                className={`flex-1 py-2.5 text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${guideTab === "make" ? "bg-orange-50 text-orange-700 border-b-2 border-orange-500" : "text-muted-foreground hover:bg-secondary/40"}`}
              >
                🔶 Qua Make.com <span className="text-xs font-normal px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full">Khuyên dùng</span>
              </button>
              <button
                type="button"
                onClick={() => setGuideTab("direct")}
                className={`flex-1 py-2.5 text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${guideTab === "direct" ? "bg-blue-50 text-blue-700 border-b-2 border-blue-500" : "text-muted-foreground hover:bg-secondary/40"}`}
              >
                📡 Trực tiếp Facebook API
              </button>
            </div>

            {/* MAKE.COM TAB */}
            {guideTab === "make" && (
              <div className="p-5 space-y-5">
                <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg text-xs text-orange-700">
                  <strong>Ưu điểm Make.com:</strong> Không cần Facebook Developer Console. Chỉ cần kết nối tài khoản Facebook trong Make.com là đủ. Kịch bản (scenario) tự động nhận tin → gọi AI → gửi lại.
                </div>

                {/* Blueprint download */}
                <div className="p-4 bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl text-white">
                  <p className="font-bold text-sm mb-1 flex items-center gap-2">
                    <Download className="w-4 h-4" /> Tải Blueprint (Import thẳng vào Make.com)
                  </p>
                  <p className="text-xs text-white/80 mb-3">
                    File JSON sẵn sàng import — đã có đủ 4 module, filter tự động, cả luồng JA/NEIN cho Manager. Chỉ cần thay 2 chỗ: <strong>Page Access Token</strong> + <strong>Manager PSID</strong>.
                  </p>
                  <a
                    href="/blueprints/happywok-messenger-bot.json"
                    download="happywok-messenger-bot.json"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white text-orange-600 rounded-lg text-sm font-bold hover:bg-orange-50 transition-colors shadow"
                  >
                    <Download className="w-4 h-4" />
                    Tải happywok-messenger-bot.json
                  </a>
                  <p className="text-xs text-white/70 mt-2">
                    Make.com → Create Scenario → ··· → Import Blueprint → chọn file này
                  </p>
                </div>

                {/* What to replace after import */}
                <div className="p-3 bg-yellow-50 border border-yellow-300 rounded-lg">
                  <p className="text-xs font-bold text-yellow-800 mb-2">⚡ Sau khi import, chỉ cần sửa 2 chỗ:</p>
                  <div className="space-y-1.5 text-xs text-yellow-700">
                    <div className="flex items-start gap-2">
                      <span className="font-bold w-4 flex-shrink-0">1.</span>
                      <span>Module <strong>"Gửi Reply"</strong> + <strong>"Thông Báo Manager"</strong>: thay <code className="bg-yellow-100 px-1 rounded border border-yellow-200">REPLACE_WITH_YOUR_PAGE_ACCESS_TOKEN</code> bằng token thật của Happy Wok Fanpage</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="font-bold w-4 flex-shrink-0">2.</span>
                      <span>Module <strong>"Manager xác nhận JA/NEIN"</strong>: thay <code className="bg-yellow-100 px-1 rounded border border-yellow-200">REPLACE_WITH_MANAGER_PSID</code> bằng PSID Facebook của Manager</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="font-bold w-4 flex-shrink-0">3.</span>
                      <span>Module <strong>"Nhận Tin Nhắn"</strong>: kết nối Custom Webhook → copy URL từ Make.com → dán vào Facebook Webhooks</span>
                    </div>
                  </div>
                </div>

                {/* Make endpoint URL */}
                <div>
                  <p className="text-xs font-semibold text-foreground mb-2">🔗 URL endpoint để Make.com gọi vào:</p>
                  <div className="flex items-center gap-2 p-2 bg-orange-50 border border-orange-300 rounded-lg">
                    <Globe className="w-3.5 h-3.5 text-orange-600 flex-shrink-0" />
                    <code className="text-xs text-orange-800 flex-1 break-all">{makeEndpointUrl}</code>
                    <button onClick={() => { navigator.clipboard.writeText(makeEndpointUrl); toast({ title: "✅ Đã copy URL!" }); }} className="p-1 hover:bg-orange-100 rounded flex-shrink-0">
                      <Copy className="w-3.5 h-3.5 text-orange-700" />
                    </button>
                  </div>
                </div>

                {/* Make scenario steps */}
                <div className="space-y-4">
                  <p className="text-xs font-bold text-foreground">Cấu trúc Scenario trong Make.com:</p>

                  {/* Module 1 */}
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-xs">1</div>
                    <div className="flex-1 p-3 bg-secondary/30 rounded-lg border border-border">
                      <p className="text-xs font-bold mb-1">Module 1 — Facebook Messenger → Watch Messages</p>
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        <p>→ Tìm module: <strong>Facebook Messenger</strong> (hoặc <strong>Facebook Pages</strong>)</p>
                        <p>→ Chọn trigger: <strong>"Watch Messages" / "Watch New Messages"</strong></p>
                        <p>→ Kết nối tài khoản Facebook (OAuth) → Chọn Page <strong>Happy Wok</strong></p>
                        <p className="text-orange-600">→ Sẽ nhận được: <code className="bg-white px-1 rounded border">senderId</code>, <code className="bg-white px-1 rounded border">message.text</code>, <code className="bg-white px-1 rounded border">pageId</code></p>
                      </div>
                    </div>
                  </div>

                  {/* Module 2 */}
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-xs">2</div>
                    <div className="flex-1 p-3 bg-secondary/30 rounded-lg border border-border">
                      <p className="text-xs font-bold mb-1">Module 2 — HTTP → Make a request</p>
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        <p>→ URL: <code className="bg-white px-1 rounded border text-orange-700 break-all">{makeEndpointUrl}</code></p>
                        <p>→ Method: <strong>POST</strong> | Content-Type: <strong>application/json</strong></p>
                        <p>→ Body (JSON):</p>
                        <pre className="mt-1 p-2 bg-white border rounded text-[10px] leading-relaxed">{`{
  "senderId": "{{1.senderId}}",
  "message": "{{1.message.text}}",
  "pageId": "{{1.pageId}}"
}`}</pre>
                        <p className="text-green-600">→ Response sẽ có: <code className="bg-white px-1 rounded border">reply</code> (text AI trả lời), <code className="bg-white px-1 rounded border">bookingCreated</code></p>
                      </div>
                    </div>
                  </div>

                  {/* Module 3 */}
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-xs">3</div>
                    <div className="flex-1 p-3 bg-secondary/30 rounded-lg border border-border">
                      <p className="text-xs font-bold mb-1">Module 3 — Facebook Messenger → Send Message</p>
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        <p>→ Recipient: <code className="bg-white px-1 rounded border">{"{{1.senderId}}"}</code> (PSID khách)</p>
                        <p>→ Message: <code className="bg-white px-1 rounded border">{"{{2.data.reply}}"}</code> (AI reply từ module 2)</p>
                        <p className="text-green-600 font-medium">✅ Xong! Khách nhắn → Make.com gọi AI → gửi lại tiếng Đức</p>
                      </div>
                    </div>
                  </div>

                  {/* Module 4 optional - notify manager */}
                  <div className="flex gap-3 opacity-70">
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-secondary text-muted-foreground flex items-center justify-center font-bold text-xs">4</div>
                    <div className="flex-1 p-3 bg-secondary/20 rounded-lg border border-dashed border-border">
                      <p className="text-xs font-bold mb-1">Module 4 (tuỳ chọn) — Filter + Notify Manager</p>
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        <p>→ Thêm Filter: <code className="bg-white px-1 rounded border">{"{{2.data.bookingCreated}}"}</code> = <code className="bg-white px-1 rounded border">true</code></p>
                        <p>→ Facebook Messenger → Send Message tới Manager PSID</p>
                        <p>→ Message: <code className="bg-white px-1 rounded border">{"{{2.data.managerMessage}}"}</code></p>
                      </div>
                    </div>
                  </div>
                </div>

                <a href="https://www.make.com/en/integrations/facebook-messenger" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs text-orange-600 hover:underline font-medium">
                  <ExternalLink className="w-3 h-3" /> Xem Make.com × Facebook Messenger integration
                </a>
              </div>
            )}

            {/* DIRECT FACEBOOK API TAB */}
            {guideTab === "direct" && (
              <div className="p-5 space-y-4">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
                  <strong>Khi dùng trực tiếp:</strong> Cần có Facebook Developer App, cấu hình webhook, lấy token. Phức tạp hơn nhưng real-time hơn (không phụ thuộc Make.com polling).
                </div>

                {[
                  { n: 1, color: "blue", title: "Tạo Facebook App", steps: ["Vào developers.facebook.com → My Apps → Create App", "Chọn loại Business → Đặt tên Happy Wok Bot", "Dashboard → Add Product → Messenger"] },
                  { n: 2, color: "amber", title: "Lấy Page Access Token", steps: ["Messenger settings → Access Tokens", "Chọn Page Happy Wok → Generate Token", "Token dạng EAAxxxx... (cần quyền pages_messaging)"] },
                  { n: 3, color: "green", title: "Cài Webhook", steps: [`Messenger → Webhooks → Add Callback URL`, `Dán: ${webhookUrl}`, "Verify Token: đặt tự do (VD: happywok_2025)", "Tick: messages + messaging_postbacks → Verify and Save"] },
                  { n: 4, color: "violet", title: "Lấy Page ID", steps: ["Fanpage Happy Wok → Giới thiệu → Page ID", "Hoặc: Cài đặt trang → Thông tin trang"] },
                  { n: 5, color: "rose", title: "Lấy Manager PSID", steps: ["Manager nhắn tin vào Inbox Happy Wok", "PSID xuất hiện trong webhook payload: sender.id"] },
                ].map(step => (
                  <div key={step.n} className="flex gap-3">
                    <div className={`flex-shrink-0 w-7 h-7 rounded-full bg-${step.color}-100 text-${step.color}-700 flex items-center justify-center font-bold text-xs`}>{step.n}</div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold mb-1">{step.title}</p>
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        {step.steps.map((s, i) => <p key={i}>→ {s}</p>)}
                      </div>
                    </div>
                  </div>
                ))}

                <div className="p-2 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                  <code className="text-xs text-green-800 flex-1 break-all">{webhookUrl}</code>
                  <button onClick={() => { navigator.clipboard.writeText(webhookUrl); toast({ title: "✅ Đã copy!" }); }} className="p-1 hover:bg-green-100 rounded">
                    <Copy className="w-3.5 h-3.5 text-green-700" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Active toggle */}
      <div className="flex items-center justify-between p-4 bg-card border border-border rounded-xl">
        <div>
          <p className="font-medium text-sm">Kích hoạt AI Booking</p>
          <p className="text-xs text-muted-foreground mt-0.5">Bật để nhận và xử lý tin nhắn đặt lịch tự động</p>
        </div>
        <Switch
          checked={form.isActive}
          onCheckedChange={v => set("isActive", v)}
        />
      </div>

      {/* Credentials */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            Page ID
          </Label>
          <Input
            placeholder="123456789012345"
            value={form.pageId}
            onChange={e => set("pageId", e.target.value)}
          />
          <p className="text-xs text-muted-foreground">ID của Facebook Page (tìm trong Cài đặt trang)</p>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Shield className="w-4 h-4 text-green-600" />
            Verify Token
          </Label>
          <Input
            placeholder="my_custom_verify_token_123"
            value={form.verifyToken}
            onChange={e => set("verifyToken", e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Token tự đặt khi cấu hình webhook trên Facebook</p>
        </div>

        <div className="md:col-span-2 space-y-2">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Shield className="w-4 h-4 text-amber-600" />
            Page Access Token
          </Label>
          <Input
            type="password"
            placeholder="EAAxxxxxxxxxxxxxxx..."
            value={form.pageAccessToken}
            onChange={e => set("pageAccessToken", e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Token lấy từ Facebook Developer App → Access Tokens (cần quyền pages_messaging)</p>
        </div>

        <div className="md:col-span-2 space-y-2">
          <Label className="text-sm font-medium flex items-center gap-2">
            <User className="w-4 h-4 text-violet-600" />
            PSID của Manager
          </Label>
          <Input
            placeholder="9876543210123456"
            value={form.managerPsid}
            onChange={e => set("managerPsid", e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Page-Scoped ID của tài khoản quản lý nhận thông báo lịch hẹn. Khi có lịch mới → bot nhắn tin "JA/NEIN" cho manager.</p>
        </div>
      </div>

      {/* Business info */}
      <div className="space-y-4 p-4 bg-secondary/30 rounded-xl border border-border">
        <p className="font-medium text-sm text-foreground">Thông tin tự động cung cấp cho AI</p>

        <div className="space-y-2">
          <Label className="text-sm">Dịch vụ cung cấp (Services)</Label>
          <Input
            placeholder="Gel Nails, Acryl, Pedicure, Maniküre..."
            value={form.servicesInfo}
            onChange={e => set("servicesInfo", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm">Giờ mở cửa (Öffnungszeiten)</Label>
          <Input
            placeholder="Di–Sa 9:00–19:00, So 10:00–17:00"
            value={form.businessHoursInfo}
            onChange={e => set("businessHoursInfo", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm">Lời chào mừng (tùy chọn)</Label>
          <Textarea
            placeholder="Hallo! Willkommen bei uns! Wie kann ich Ihnen helfen?"
            rows={3}
            value={form.welcomeMessage}
            onChange={e => set("welcomeMessage", e.target.value)}
          />
        </div>
      </div>

      <Button
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
        className="w-full bg-primary text-white hover:bg-primary/90"
      >
        {saveMutation.isPending ? "Đang lưu..." : "💾 Lưu cấu hình"}
      </Button>
    </div>
  );
}

function AppointmentCard({ appt, onAction }: { appt: Appointment; onAction: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const updateStatus = useMutation({
    mutationFn: async (status: string) => {
      const r = await fetch(getApiUrl(`/api/messenger/appointments/${appt.id}/status`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: (_, status) => {
      toast({ title: status === "confirmed" ? "✅ Đã xác nhận lịch!" : "❌ Đã từ chối lịch" });
      qc.invalidateQueries({ queryKey: ["messenger-appointments"] });
      qc.invalidateQueries({ queryKey: ["messenger-overview"] });
      onAction();
    },
    onError: (e: any) => toast({ title: "Lỗi", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-foreground">{appt.customerName || "Khách hàng"}</span>
            <Badge
              className={`${STATUS_STYLES[appt.status]} border text-xs flex items-center gap-1 font-medium`}
            >
              {STATUS_ICONS[appt.status]}
              {STATUS_LABELS[appt.status]}
            </Badge>
            {appt.brandName && (
              <Badge variant="outline" className="text-xs">{appt.brandName}</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            PSID: {appt.customerPsid.slice(0, 8)}...
          </p>
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {new Date(appt.createdAt).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="flex items-center gap-2 text-sm">
          <Scissors className="w-4 h-4 text-primary/70 flex-shrink-0" />
          <span className="truncate">{appt.service || "—"}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="w-4 h-4 text-blue-500/70 flex-shrink-0" />
          <span className="truncate">{appt.preferredDate || "—"}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Clock className="w-4 h-4 text-green-500/70 flex-shrink-0" />
          <span>{appt.preferredTime || "—"}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Phone className="w-4 h-4 text-violet-500/70 flex-shrink-0" />
          <span>{appt.phone || "—"}</span>
        </div>
      </div>

      {appt.status === "pending" && (
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            onClick={() => updateStatus.mutate("confirmed")}
            disabled={updateStatus.isPending}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
          >
            <CheckCircle2 className="w-4 h-4 mr-1.5" />
            Xác nhận (JA)
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => updateStatus.mutate("rejected")}
            disabled={updateStatus.isPending}
            className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
          >
            <XCircle className="w-4 h-4 mr-1.5" />
            Từ chối (NEIN)
          </Button>
        </div>
      )}
    </div>
  );
}

export default function MessengerBot() {
  const [selectedBrandId, setSelectedBrandId] = useState<number | null>(null);
  const [apptFilter, setApptFilter] = useState<string>("all");
  const qc = useQueryClient();

  const { data: overview = [], isLoading } = useQuery<BrandOverview[]>({
    queryKey: ["messenger-overview"],
    queryFn: () => fetch(getApiUrl("/api/messenger/overview")).then(r => r.json()),
    refetchInterval: 30_000,
  });

  const { data: appointments = [], isLoading: apptLoading, refetch: refetchAppts } = useQuery<Appointment[]>({
    queryKey: ["messenger-appointments", apptFilter],
    queryFn: () => {
      const url = apptFilter === "all"
        ? getApiUrl("/api/messenger/appointments")
        : getApiUrl(`/api/messenger/appointments?brandId=${apptFilter}`);
      return fetch(url).then(r => r.json());
    },
    refetchInterval: 15_000,
  });

  const selectedOverview = selectedBrandId
    ? overview.find(o => o.brand.id === selectedBrandId)
    : null;

  const pendingCount = appointments.filter(a => a.status === "pending").length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-primary/50" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center shadow-lg">
            <MessagesSquare className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">AI Đặt lịch qua Messenger</h1>
            <p className="text-sm text-muted-foreground">Khách nhắn tin → AI thu thập thông tin → Manager xác nhận JA/NEIN</p>
          </div>
        </div>
        {pendingCount > 0 && (
          <Badge className="bg-amber-500 text-white px-3 py-1.5 text-sm animate-pulse">
            {pendingCount} lịch chờ duyệt
          </Badge>
        )}
      </div>

      {/* Flow diagram */}
      <div className="p-4 bg-gradient-to-r from-violet-50 to-blue-50 border border-violet-200 rounded-xl">
        <div className="flex items-center gap-2 flex-wrap text-sm">
          <div className="flex items-center gap-1.5 bg-white rounded-lg px-3 py-1.5 border border-violet-200 shadow-sm">
            <MessagesSquare className="w-4 h-4 text-blue-600" />
            <span className="font-medium">Khách nhắn tin</span>
          </div>
          <span className="text-muted-foreground">→</span>
          <div className="flex items-center gap-1.5 bg-white rounded-lg px-3 py-1.5 border border-violet-200 shadow-sm">
            <span className="text-sm">🤖</span>
            <span className="font-medium">GPT-4o thu thập (tiếng Đức)</span>
          </div>
          <span className="text-muted-foreground">→</span>
          <div className="flex items-center gap-1.5 bg-white rounded-lg px-3 py-1.5 border border-violet-200 shadow-sm">
            <User className="w-4 h-4 text-violet-600" />
            <span className="font-medium">Thông báo Manager</span>
          </div>
          <span className="text-muted-foreground">→</span>
          <div className="flex items-center gap-1.5 bg-white rounded-lg px-3 py-1.5 border border-green-200 shadow-sm">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <span className="font-medium text-green-700">JA → Xác nhận</span>
          </div>
          <span className="text-muted-foreground">/</span>
          <div className="flex items-center gap-1.5 bg-white rounded-lg px-3 py-1.5 border border-red-200 shadow-sm">
            <XCircle className="w-4 h-4 text-red-500" />
            <span className="font-medium text-red-700">NEIN → Từ chối</span>
          </div>
        </div>
      </div>

      <Tabs defaultValue="appointments">
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="appointments">
            <CalendarCheck className="w-4 h-4 mr-1.5" />
            Lịch hẹn
            {pendingCount > 0 && (
              <span className="ml-2 bg-amber-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {pendingCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="config">
            <Settings className="w-4 h-4 mr-1.5" />
            Cấu hình Bot
          </TabsTrigger>
        </TabsList>

        {/* ── APPOINTMENTS TAB ── */}
        <TabsContent value="appointments" className="mt-4 space-y-4">
          {/* Brand filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setApptFilter("all")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                apptFilter === "all"
                  ? "bg-primary text-white shadow-sm"
                  : "bg-secondary/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              Tất cả
            </button>
            {overview.map(o => (
              <button
                key={o.brand.id}
                onClick={() => setApptFilter(String(o.brand.id))}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  apptFilter === String(o.brand.id)
                    ? "bg-primary text-white shadow-sm"
                    : "bg-secondary/50 text-muted-foreground hover:text-foreground"
                }`}
              >
                {o.brand.brandName}
                {o.stats.pending > 0 && (
                  <span className="ml-1.5 text-xs bg-amber-500 text-white rounded-full px-1.5">
                    {o.stats.pending}
                  </span>
                )}
              </button>
            ))}
            <button
              onClick={() => refetchAppts()}
              className="ml-auto p-2 hover:bg-secondary/50 rounded-lg transition-colors"
              title="Làm mới"
            >
              <RefreshCw className={`w-4 h-4 text-muted-foreground ${apptLoading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {appointments.length === 0 ? (
            <div className="py-16 text-center">
              <CalendarCheck className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">Chưa có lịch hẹn nào</p>
              <p className="text-sm text-muted-foreground/70 mt-1">Lịch hẹn sẽ xuất hiện khi khách nhắn tin qua Messenger</p>
            </div>
          ) : (
            <div className="space-y-3">
              {appointments.map(appt => (
                <AppointmentCard
                  key={appt.id}
                  appt={appt}
                  onAction={() => {
                    qc.invalidateQueries({ queryKey: ["messenger-appointments"] });
                    qc.invalidateQueries({ queryKey: ["messenger-overview"] });
                  }}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── CONFIG TAB ── */}
        <TabsContent value="config" className="mt-4 space-y-4">
          {/* Brand selector */}
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-3">Chọn cửa hàng để cấu hình:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {overview.map(o => (
                <button
                  key={o.brand.id}
                  onClick={() => setSelectedBrandId(o.brand.id === selectedBrandId ? null : o.brand.id)}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    selectedBrandId === o.brand.id
                      ? "border-primary bg-primary/5 shadow-md"
                      : "border-border bg-card hover:border-primary/30 hover:shadow-sm"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-foreground text-sm">{o.brand.brandName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{o.brand.branchLocation}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {o.config?.isActive ? (
                        <Badge className="bg-green-100 text-green-700 border-green-200 border text-xs">Đang bật</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-muted-foreground">Chưa bật</Badge>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex gap-3 text-xs">
                    <span className="text-amber-600 font-medium">{o.stats.pending} chờ</span>
                    <span className="text-green-600 font-medium">{o.stats.confirmed} đã xác nhận</span>
                    <span className="text-muted-foreground">{o.stats.total} tổng</span>
                  </div>

                  <div className="mt-2 flex gap-1">
                    {o.config?.pageId ? (
                      <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Page ID</span>
                    ) : (
                      <span className="text-xs text-amber-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" />Chưa có Page ID</span>
                    )}
                    {o.config?.pageAccessToken ? (
                      <span className="text-xs text-green-600 flex items-center gap-1 ml-2"><CheckCircle2 className="w-3 h-3" />Token</span>
                    ) : (
                      <span className="text-xs text-amber-600 flex items-center gap-1 ml-2"><AlertCircle className="w-3 h-3" />Chưa có Token</span>
                    )}
                    {o.config?.managerPsid ? (
                      <span className="text-xs text-green-600 flex items-center gap-1 ml-2"><CheckCircle2 className="w-3 h-3" />Manager</span>
                    ) : (
                      <span className="text-xs text-amber-600 flex items-center gap-1 ml-2"><AlertCircle className="w-3 h-3" />Chưa có PSID</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {selectedOverview && (
            <div className="border border-border rounded-xl p-5 bg-card space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Settings className="w-4 h-4 text-primary" />
                  {selectedOverview.brand.brandName} — Cấu hình Messenger Bot
                </h3>
                <button
                  onClick={() => setSelectedBrandId(null)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Thu gọn
                </button>
              </div>

              <ConfigForm
                brandId={selectedOverview.brand.id}
                initialConfig={selectedOverview.config}
                onSaved={() => setSelectedBrandId(null)}
              />
            </div>
          )}

          {/* Setup guide */}
          <div className="p-5 bg-secondary/30 border border-border rounded-xl space-y-3">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <ExternalLink className="w-4 h-4 text-primary" />
              Hướng dẫn cài đặt Facebook Messenger Webhook
            </h4>
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li>Vào <strong>developers.facebook.com</strong> → My Apps → Tạo app mới (loại "Business")</li>
              <li>Thêm sản phẩm <strong>Messenger</strong> vào app</li>
              <li>Trong Messenger Settings → <strong>Webhooks</strong> → Add Callback URL: dán URL bên trên</li>
              <li>Điền Verify Token giống với token bạn nhập ở form. Bật subscribe: <code className="text-xs bg-white px-1.5 py-0.5 rounded border">messages</code>, <code className="text-xs bg-white px-1.5 py-0.5 rounded border">messaging_postbacks</code></li>
              <li>Trong <strong>Access Tokens</strong>: chọn Facebook Page → Generate Token → copy vào "Page Access Token"</li>
              <li>Để lấy <strong>Manager PSID</strong>: nhắn tin tới Page từ tài khoản quản lý, rồi xem trong Messenger API log hoặc webhook payload (<code className="text-xs bg-white px-1 rounded border">sender.id</code>)</li>
              <li>Lưu cấu hình và bật <strong>"Kích hoạt AI Booking"</strong></li>
            </ol>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
