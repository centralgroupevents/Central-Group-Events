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
import Blog from "@/pages/Blog";
import BlogPost from "@/pages/BlogPost";
import FAQ from "@/pages/FAQ";
import Welcome from "@/pages/Welcome";
import AcceptInvite from "@/pages/AcceptInvite";
import Book from "@/pages/Book";
import ThingsToDo from "@/pages/ThingsToDo";
import TopicLanding from "@/pages/TopicLanding";
import Guides from "@/pages/Guides";
import SubmitWatchParty from "@/pages/SubmitWatchParty";
import WatchParties from "@/pages/WatchParties";
import SubmitNbaFinalsWatchParty from "@/pages/SubmitNbaFinalsWatchParty";
import NbaFinalsWatchParties from "@/pages/NbaFinalsWatchParties";
import Unsubscribe from "@/pages/Unsubscribe";
import Invoice from "@/pages/Invoice";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/book" component={Book} />
      <Route path="/booking-confirmation" component={BookingConfirmation} />
      <Route path="/legal/terms" component={Terms} />
      <Route path="/legal/privacy" component={Privacy} />
      <Route path="/admin" component={Admin} />
      <Route path="/blog" component={Blog} />
      <Route path="/blog/:slug" component={BlogPost} />
      <Route path="/things-to-do-in-nj" component={ThingsToDo} />
      <Route path="/guides" component={Guides} />
      <Route path="/faq" component={FAQ} />
      <Route path="/welcome" component={Welcome} />
      <Route path="/unsubscribe" component={Unsubscribe} />
      <Route path="/invoice/:number" component={Invoice} />
      <Route path="/admin/accept-invite" component={AcceptInvite} />
      <Route path="/submit-world-cup-watch-party" component={SubmitWatchParty} />
      <Route path="/world-cup-2026-nj-watch-parties" component={WatchParties} />
      <Route path="/submit-nba-finals-watch-party" component={SubmitNbaFinalsWatchParty} />
      <Route path="/nba-finals-2026-nj-watch-parties" component={NbaFinalsWatchParties} />
      {/* Programmatic topic landing pages (city, type, time, combos, tentpole).
          TopicLanding looks up the slug in shared/seo-topics; falls back to NotFound
          if the slug isn't a known topic. */}
      <Route path="/:slug" component={TopicLanding} />
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
