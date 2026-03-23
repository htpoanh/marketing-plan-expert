import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import LoginPage from "@/pages/auth/LoginPage";
import NotFound from "@/pages/not-found";
import { useEffect } from "react";

// Pages
import Dashboard from "@/pages/Dashboard";
import BrandManager from "@/pages/brands/BrandManager";
import GoogleReviews from "@/pages/reviews/GoogleReviews";
import ReviewReports from "@/pages/reviews/ReviewReports";
import ContentGenerator from "@/pages/content/ContentGenerator";
import StrategyGenerator from "@/pages/content/StrategyGenerator";
import ContentCalendar from "@/pages/calendar/ContentCalendar";
import ApprovalDashboard from "@/pages/approvals/ApprovalDashboard";
import AIPipeline from "@/pages/pipeline/AIPipeline";
import MarketingModels from "@/pages/pipeline/MarketingModels";
import AIAgentsPage from "@/pages/agents/AIAgentsPage";
import AutomationPage from "@/pages/automation/AutomationPage";
import AdAnalysis from "@/pages/analysis/AdAnalysis";
import MessengerBot from "@/pages/messenger/MessengerBot";
import { Loader2, Sparkles } from "lucide-react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function ProtectedRoutes() {
  const { isAuthenticated, isLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/login");
    }
  }, [isAuthenticated, isLoading, navigate]);

  if (isLoading) return null;
  if (!isAuthenticated) return null;

  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/brands" component={BrandManager} />
      <Route path="/reviews" component={GoogleReviews} />
      <Route path="/reviews/reports" component={ReviewReports} />
      <Route path="/content/generator" component={ContentGenerator} />
      <Route path="/content/strategy" component={StrategyGenerator} />
      <Route path="/pipeline" component={AIPipeline} />
      <Route path="/pipeline/models" component={MarketingModels} />
      <Route path="/agents" component={AIAgentsPage} />
      <Route path="/calendar" component={ContentCalendar} />
      <Route path="/approvals" component={ApprovalDashboard} />
      <Route path="/automation" component={AutomationPage} />
      <Route path="/analysis" component={AdAnalysis} />
      <Route path="/messenger" component={MessengerBot} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppRouter() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading && isAuthenticated && location === "/login") {
      navigate("/");
    }
  }, [isAuthenticated, isLoading, location, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/25">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route>
        <ProtectedRoutes />
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <AppRouter />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
