import { Switch, Route, Router as WouterRouter } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Marketplace from "@/pages/marketplace";
import Reviews from "@/pages/reviews";
import P2P from "@/pages/p2p";
import TopUp from "@/pages/top-up";

function Router() {
  return (
    <Switch>
      <Route path="/">{() => <Marketplace />}</Route>
      <Route path="/airtime/:slug">
        {(params) => <Marketplace productSlug={params.slug} />}
      </Route>
      <Route path="/top-up" component={TopUp} />
      <Route path="/reviews" component={Reviews} />
      <Route path="/p2p" component={P2P} />
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
