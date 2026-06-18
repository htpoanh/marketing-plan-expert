import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Store, 
  MessageSquareText, 
  BarChart2,
  Sparkles, 
  CalendarDays, 
  CheckSquare,
  ChevronRight,
  Bot,
  Zap,
  MessagesSquare,
  Inbox,
  Lightbulb,
  TrendingUp,
  Globe,
  FileBarChart,
  Users,
  LogOut,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

const navigation = [
  { name: "Tổng quan", href: "/", icon: LayoutDashboard },
  { name: "Báo cáo tuần", href: "/weekly-report", icon: FileBarChart },
  { name: "Quản lý cửa hàng", href: "/brands", icon: Store },
  { 
    name: "Đánh giá Google", 
    icon: MessageSquareText,
    children: [
      { name: "Tất cả đánh giá", href: "/reviews" },
      { name: "Báo cáo thống kê", href: "/reviews/reports" },
    ]
  },
  {
    name: "Pipeline AI",
    icon: Bot,
    children: [
      { name: "Chạy Pipeline", href: "/pipeline" },
      { name: "Tạo nhanh", href: "/pipeline?mode=quick" },
      { name: "Mô hình Marketing", href: "/pipeline/models" },
      { name: "Cấu hình AI Agents", href: "/agents" },
    ]
  },
  { 
    name: "Nội dung AI", 
    icon: Sparkles,
    children: [
      { name: "Tạo nội dung", href: "/content/generator" },
      { name: "Chiến lược AI", href: "/content/strategy" },
    ]
  },
  { name: "Lịch nội dung", href: "/calendar", icon: CalendarDays },
  { name: "Phê duyệt", href: "/approvals", icon: CheckSquare },
  { name: "Automation", href: "/automation", icon: Zap },
  { name: "Ads Strategy AI", href: "/strategy/ads", icon: BarChart2 },
  { name: "Hiệu quả quảng cáo", href: "/ads-performance", icon: BarChart2 },
  { name: "Hộp thư chiến lược", href: "/strategy-inbox", icon: Lightbulb },
  { name: "Trend Intelligence", href: "/trends", icon: TrendingUp },
  { name: "Nghiên cứu thị trường", href: "/market-research", icon: Globe },
  { name: "Virtual KOL", href: "/kol", icon: Users },
  { name: "Hộp thư Auto-Reply", href: "/inbox", icon: Inbox },
  { name: "AI Đặt lịch Messenger", href: "/messenger", icon: MessagesSquare },
];

export function Sidebar() {
  const [location] = useLocation();
  const { username, logout } = useAuth();
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({
    "Đánh giá Google": true,
    "Nội dung AI": true,
  });

  const toggleExpand = (name: string) => {
    setExpandedItems(prev => ({ ...prev, [name]: !prev[name] }));
  };

  return (
    <div className="flex flex-col w-64 h-screen bg-card border-r border-border/50 sticky top-0">
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/25">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <h1 className="font-display font-bold text-lg text-foreground tracking-wide">
          AI Marketer
        </h1>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-2 space-y-1">
        {navigation.map((item) => {
          const isActive = location === item.href || 
            (item.children && item.children.some(c => location === c.href));
            
          if (item.children) {
            const isExpanded = expandedItems[item.name];
            return (
              <div key={item.name} className="py-1">
                <button
                  onClick={() => toggleExpand(item.name)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                    isActive ? "text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <item.icon className="w-5 h-5" />
                    {item.name}
                  </div>
                  <ChevronRight className={cn(
                    "w-4 h-4 transition-transform duration-200",
                    isExpanded ? "rotate-90" : ""
                  )} />
                </button>
                
                <div className={cn(
                  "overflow-hidden transition-all duration-200",
                  isExpanded ? "max-h-40 opacity-100 mt-1" : "max-h-0 opacity-0"
                )}>
                  {item.children.map((child) => (
                    <Link 
                      key={child.name} 
                      href={child.href}
                      className={cn(
                        "block pl-11 pr-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 mb-1",
                        location === child.href 
                          ? "bg-primary/10 text-primary" 
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary/30"
                      )}
                    >
                      {child.name}
                    </Link>
                  ))}
                </div>
              </div>
            );
          }

          return (
            <Link 
              key={item.name} 
              href={item.href!}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                location === item.href 
                  ? "bg-primary/10 text-primary shadow-sm" 
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>
      
      {/* User info + Logout */}
      <div className="p-4 border-t border-border/50 space-y-3">
        <div className="flex items-center gap-2 px-1">
          <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground truncate">{username ?? "Admin"}</p>
            <p className="text-xs text-muted-foreground">Quản trị viên</p>
          </div>
          <LanguageSwitcher compact />
        </div>

        <button
          onClick={logout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-200"
        >
          <LogOut className="w-4 h-4" />
          Đăng xuất
        </button>
      </div>
    </div>
  );
}
