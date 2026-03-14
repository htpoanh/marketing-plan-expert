import { useState } from "react";
import { 
  useListBrands, 
  useCreateBrand, 
  useUpdateBrand, 
  useDeleteBrand,
  getListBrandsQueryKey
} from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Store, Plus, MapPin, Target, Megaphone, Trash2, Edit3, X, Bot, Copy, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type AiProfile = { id: number; profileName: string; industry: string | null; isDefault: boolean };

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

export default function BrandManager() {
  const { data: brands, isLoading } = useListBrands();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [cloningId, setCloningId] = useState<number | null>(null);

  const handleClone = async (brandId: number, brandName: string) => {
    if (!confirm(`Nhân bản cửa hàng "${brandName}"?`)) return;
    setCloningId(brandId);
    try {
      const r = await fetch(`${BASE}/api/brands/${brandId}/clone`, { method: "POST" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      queryClient.invalidateQueries({ queryKey: getListBrandsQueryKey() });
      toast({ title: "✅ Nhân bản thành công", description: `Đã tạo "${data.brandName}" — hãy chỉnh sửa thông tin.` });
    } catch (e: any) {
      toast({ title: "❌ Lỗi nhân bản", description: e.message, variant: "destructive" });
    } finally {
      setCloningId(null);
    }
  };

  const { data: profiles = [] } = useQuery<AiProfile[]>({
    queryKey: ["/api/ai-profiles"],
    queryFn: async () => {
      const r = await fetch("/api/ai-profiles");
      if (!r.ok) throw new Error();
      return r.json();
    },
  });
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  const [formData, setFormData] = useState({
    brandName: "",
    industry: "",
    branchLocation: "",
    address: "",
    phone: "",
    businessHours: "",
    aiProfileId: "" as string,
    googlePlaceId: "",
    targetAudience: "",
    brandVoice: "",
  });

  const createMutation = useCreateBrand({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListBrandsQueryKey() });
        setIsDialogOpen(false);
        resetForm();
        toast({ title: "Thành công", description: "Đã thêm cửa hàng mới" });
      }
    }
  });

  const updateMutation = useUpdateBrand({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListBrandsQueryKey() });
        setIsDialogOpen(false);
        resetForm();
        toast({ title: "Thành công", description: "Đã cập nhật cửa hàng" });
      }
    }
  });

  const deleteMutation = useDeleteBrand({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListBrandsQueryKey() });
        toast({ title: "Thành công", description: "Đã xóa cửa hàng" });
      }
    }
  });

  const resetForm = () => {
    setEditingId(null);
    setFormData({ brandName: "", industry: "", branchLocation: "", address: "", phone: "", businessHours: "", aiProfileId: "", googlePlaceId: "", targetAudience: "", brandVoice: "" });
  };

  const handleEdit = (brand: any) => {
    setEditingId(brand.id);
    setFormData({
      brandName: brand.brandName,
      industry: brand.industry,
      branchLocation: brand.branchLocation,
      address: brand.address ?? "",
      phone: brand.phone ?? "",
      businessHours: brand.businessHours ?? "",
      aiProfileId: brand.aiProfileId ? String(brand.aiProfileId) : "",
      googlePlaceId: brand.googlePlaceId ?? "",
      targetAudience: brand.targetAudience,
      brandVoice: brand.brandVoice,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...formData, aiProfileId: formData.aiProfileId ? Number(formData.aiProfileId) : undefined };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload as any });
    } else {
      createMutation.mutate({ data: payload as any });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
              Quản lý Cửa hàng
            </h1>
            <p className="mt-2 text-muted-foreground">Thiết lập hồ sơ thương hiệu để AI tạo nội dung chuẩn xác.</p>
          </div>
          <button 
            onClick={() => { resetForm(); setIsDialogOpen(true); }}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold bg-gradient-to-r from-primary to-primary/80 text-white shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200"
          >
            <Plus className="w-5 h-5" />
            Thêm cửa hàng
          </button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
            {[1, 2, 3].map(i => <div key={i} className="h-64 bg-card rounded-2xl border border-border/50"></div>)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {brands?.map(brand => (
              <div key={brand.id} className="bg-card rounded-2xl p-6 border border-border/50 shadow-lg hover:shadow-xl hover:border-primary/30 transition-all duration-300 flex flex-col h-full group">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                      <Store className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg leading-tight">{brand.brandName}</h3>
                      <p className="text-xs text-muted-foreground">{brand.industry}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleEdit(brand)} title="Chỉnh sửa" className="p-2 hover:bg-secondary rounded-lg text-muted-foreground hover:text-foreground">
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleClone(brand.id, brand.brandName)}
                      disabled={cloningId === brand.id}
                      title="Nhân bản cửa hàng"
                      className="p-2 hover:bg-blue-500/20 rounded-lg text-muted-foreground hover:text-blue-400 disabled:opacity-50"
                    >
                      {cloningId === brand.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
                    </button>
                    <button 
                      onClick={() => {
                        if (confirm('Bạn có chắc muốn xóa cửa hàng này?')) {
                          deleteMutation.mutate({ id: brand.id });
                        }
                      }} 
                      className="p-2 hover:bg-destructive/20 rounded-lg text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                <div className="space-y-3 flex-1">
                  {(brand as any).aiProfileId && (
                    <div className="flex items-center gap-1.5">
                      <Bot className="w-3.5 h-3.5 text-primary" />
                      <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                        {profiles.find(p => p.id === (brand as any).aiProfileId)?.profileName ?? "AI Profile"}
                      </span>
                    </div>
                  )}
                  <div className="flex gap-2 text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4 shrink-0 text-primary/70 mt-0.5" />
                    <span className="line-clamp-1">{brand.branchLocation}</span>
                  </div>
                  <div className="flex gap-2 text-sm text-muted-foreground">
                    <Target className="w-4 h-4 shrink-0 text-emerald-500/70 mt-0.5" />
                    <span className="line-clamp-2">KH: {brand.targetAudience}</span>
                  </div>
                  <div className="flex gap-2 text-sm text-muted-foreground">
                    <Megaphone className="w-4 h-4 shrink-0 text-amber-500/70 mt-0.5" />
                    <span className="line-clamp-2">Giọng điệu: {brand.brandVoice}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Custom Dialog to avoid complex nested shadcn dependencies if not present perfectly */}
        {isDialogOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-border/50 flex justify-between items-center">
                <h2 className="text-xl font-bold font-display">
                  {editingId ? 'Cập nhật cửa hàng' : 'Thêm cửa hàng mới'}
                </h2>
                <button onClick={() => setIsDialogOpen(false)} className="p-2 hover:bg-secondary rounded-lg text-muted-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Tên thương hiệu / Cửa hàng</label>
                  <input required value={formData.brandName} onChange={e => setFormData({...formData, brandName: e.target.value})} className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all" placeholder="Vd: The Coffee House - Quận 1" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Ngành nghề</label>
                  <input required value={formData.industry} onChange={e => setFormData({...formData, industry: e.target.value})} className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all" placeholder="Vd: F&B, Thời trang..." />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Vị trí / Đặc điểm</label>
                  <input required value={formData.branchLocation} onChange={e => setFormData({...formData, branchLocation: e.target.value})} className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all" placeholder="Vd: Mặt tiền đường lớn, gần trường đại học..." />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground flex items-center gap-1">
                      Số điện thoại <span className="text-xs text-muted-foreground font-normal">(AI tự điền)</span>
                    </label>
                    <input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all" placeholder="Vd: 0901 234 567" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground flex items-center gap-1">
                      Giờ mở cửa <span className="text-xs text-muted-foreground font-normal">(AI tự điền)</span>
                    </label>
                    <input value={formData.businessHours} onChange={e => setFormData({...formData, businessHours: e.target.value})} className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all" placeholder="Vd: 8h-22h T2-CN" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground flex items-center gap-1">
                    Địa chỉ đầy đủ <span className="text-xs text-muted-foreground font-normal">(AI tự điền vào caption)</span>
                  </label>
                  <input value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all" placeholder="Vd: 123 Nguyễn Huệ, Quận 1, TP.HCM" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Bot className="w-4 h-4 text-primary" />
                    Profile AI cho cửa hàng này
                  </label>
                  <select
                    value={formData.aiProfileId}
                    onChange={e => setFormData({...formData, aiProfileId: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                  >
                    <option value="">Dùng Profile Mặc định</option>
                    {profiles.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.isDefault ? "⭐ " : ""}{p.profileName}{p.industry ? ` — ${p.industry}` : ""}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">AI sẽ viết content theo đúng phong cách ngành của cửa hàng này.</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground flex items-center gap-2">
                    Google Place ID
                    <span className="text-xs text-muted-foreground font-normal">(để đồng bộ đánh giá Google)</span>
                  </label>
                  <input value={formData.googlePlaceId} onChange={e => setFormData({...formData, googlePlaceId: e.target.value})} className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-mono text-sm" placeholder="Vd: ChIJD7fiBh9u5kcRYJSMaMOCCwQ" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Khách hàng mục tiêu</label>
                  <textarea required value={formData.targetAudience} onChange={e => setFormData({...formData, targetAudience: e.target.value})} className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all min-h-[100px]" placeholder="Vd: Sinh viên 18-24 tuổi, thích không gian yên tĩnh..." />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Giọng điệu thương hiệu (Brand Voice)</label>
                  <textarea required value={formData.brandVoice} onChange={e => setFormData({...formData, brandVoice: e.target.value})} className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all min-h-[100px]" placeholder="Vd: Thân thiện, năng động, dùng xưng hô 'Mình - Bạn'..." />
                </div>
              </form>
              
              <div className="p-6 border-t border-border/50 bg-secondary/20 flex justify-end gap-3">
                <button type="button" onClick={() => setIsDialogOpen(false)} className="px-5 py-2.5 rounded-xl font-medium hover:bg-secondary transition-colors">
                  Hủy
                </button>
                <button 
                  onClick={handleSubmit}
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="px-6 py-2.5 rounded-xl font-medium bg-primary text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {(createMutation.isPending || updateMutation.isPending) ? "Đang lưu..." : "Lưu thông tin"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
