import { useState, type FormEvent } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Sparkles, Lock, User, LogIn, Loader2 } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    const result = await login(username, password);

    setIsLoading(false);
    if (!result.success) {
      setError(result.error ?? "Đăng nhập thất bại");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo + Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent shadow-2xl shadow-primary/30 mb-4">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">AI Marketer</h1>
          <p className="text-muted-foreground mt-1 text-sm">Nền tảng Marketing AI cho Happy Wok & Paradise Nails</p>
        </div>

        {/* Login card */}
        <div className="bg-card border border-border/60 rounded-2xl shadow-2xl shadow-black/10 p-8">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary" />
              Đăng nhập
            </h2>
            <p className="text-sm text-muted-foreground mt-1">Dành riêng cho quản trị viên</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Tên đăng nhập</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  required
                  autoComplete="username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  disabled={isLoading}
                  placeholder="admin"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-secondary/50 border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm disabled:opacity-60"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Mật khẩu</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  disabled={isLoading}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-secondary/50 border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm disabled:opacity-60"
                />
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive font-medium animate-in fade-in slide-in-from-top-1 duration-200">
                ⚠ {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading || !username || !password}
              className="w-full py-3 px-4 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-semibold text-sm transition-all shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Đang đăng nhập...
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  Đăng nhập
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          Happy Wok F&B · Paradise Nails · Kempten, Germany
        </p>
      </div>
    </div>
  );
}
