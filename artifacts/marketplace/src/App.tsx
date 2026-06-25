import { Switch, Route, Router as WouterRouter } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Marketplace from "@/pages/marketplace";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Marketplace} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <Router />
      <Toaster />
    </WouterRouter>
  );
}

export default App;
