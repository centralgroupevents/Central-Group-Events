import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "./pages/Home";
import Terms from "@/pages/legal/Terms";
import Privacy from "@/pages/legal/Privacy";
import Admin from "@/pages/Admin";
import BookingConfirmation from "@/pages/BookingConfirmation";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/booking-confirmation" component={BookingConfirmation} />
      <Route path="/legal/terms" component={Terms} />
      <Route path="/legal/privacy" component={Privacy} />
      <Route path="/admin" component={Admin} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
