import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function Router() {
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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
