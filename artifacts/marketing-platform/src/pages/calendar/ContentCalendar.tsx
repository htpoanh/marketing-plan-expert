import { useState } from "react";
import { useListContentPlans, useListBrands } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { format } from "date-fns";
import { Calendar, Filter, MoreVertical, Facebook, Instagram, Send, Eye } from "lucide-react";
import { Link } from "wouter";

export default function ContentCalendar() {
  const [selectedBrand, setSelectedBrand] = useState<number | undefined>(undefined);
  const { data: brands } = useListBrands();
  const { data: plans, isLoading } = useListContentPlans({ brandId: selectedBrand });

  const getStatusColor = (status: string) => {
    switch(status.toLowerCase()) {
      case 'draft': return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
      case 'review': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'approved': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'scheduled': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'posted': return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      default: return 'bg-secondary text-muted-foreground border-border';
    }
  };

  const getStatusText = (status: string) => {
    switch(status.toLowerCase()) {
      case 'draft': return 'Bản nháp';
      case 'review': return 'Chờ duyệt';
      case 'approved': return 'Đã duyệt';
      case 'scheduled': return 'Đã lên lịch';
      case 'posted': return 'Đã đăng';
      default: return status;
    }
  };

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
              Lịch Nội dung
            </h1>
            <p className="mt-2 text-muted-foreground">Quản lý kế hoạch đăng bài trên tất cả nền tảng.</p>
          </div>
          
          <div className="flex items-center gap-3 bg-card p-2 rounded-xl border border-border">
            <Filter className="w-4 h-4 text-muted-foreground ml-2" />
            <select 
              value={selectedBrand || ""} 
              onChange={e => setSelectedBrand(e.target.value ? Number(e.target.value) : undefined)}
              className="px-2 py-1 bg-transparent border-none focus:ring-0 text-sm font-medium outline-none cursor-pointer"
            >
              <option value="">Tất cả cửa hàng</option>
              {brands?.map(b => (
                <option key={b.id} value={b.id}>{b.brandName}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-card border border-border/50 rounded-2xl shadow-xl overflow-hidden">
          <div className="p-4 border-b border-border/50 bg-secondary/20 flex items-center justify-between">
            <h2 className="font-bold flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" /> Kế hoạch sắp tới
            </h2>
            <Link href="/content/generator" className="text-sm text-primary hover:underline font-medium">
              + Tạo bài mới
            </Link>
          </div>

          {isLoading ? (
             <div className="p-12 flex justify-center"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div></div>
          ) : !plans || plans.length === 0 ? (
            <div className="p-16 text-center text-muted-foreground">
              Chưa có kế hoạch nội dung nào.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/50 text-muted-foreground text-xs uppercase tracking-wider bg-secondary/10">
                    <th className="p-4 font-semibold">Ngày đăng</th>
                    <th className="p-4 font-semibold">Nền tảng</th>
                    <th className="p-4 font-semibold w-1/3">Chủ đề</th>
                    <th className="p-4 font-semibold">Trạng thái</th>
                    <th className="p-4 font-semibold text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {plans.map(plan => (
                    <tr key={plan.id} className="hover:bg-secondary/20 transition-colors group">
                      <td className="p-4">
                        <div className="font-medium">{format(new Date(plan.publishDate), 'dd/MM/yyyy')}</div>
                        <div className="text-xs text-muted-foreground">{format(new Date(plan.publishDate), 'HH:mm')}</div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {plan.platform.toLowerCase() === 'facebook' && <Facebook className="w-4 h-4 text-blue-500" />}
                          {plan.platform.toLowerCase() === 'instagram' && <Instagram className="w-4 h-4 text-pink-500" />}
                          <span className="text-sm font-medium capitalize">{plan.platform}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <p className="text-sm font-medium line-clamp-1">{plan.topic}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{plan.hook}</p>
                      </td>
                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(plan.status)}`}>
                          {getStatusText(plan.status)}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                         <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="p-2 hover:bg-secondary rounded-lg text-muted-foreground" title="Xem chi tiết">
                              <Eye className="w-4 h-4" />
                            </button>
                            {plan.status === 'approved' && (
                              <button className="p-2 hover:bg-emerald-500/20 hover:text-emerald-500 rounded-lg text-muted-foreground transition-colors" title="Đăng ngay">
                                <Send className="w-4 h-4" />
                              </button>
                            )}
                         </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
