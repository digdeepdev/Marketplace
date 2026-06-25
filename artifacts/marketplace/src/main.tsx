import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { polygon } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import App from "./App";
import "./index.css";

const wagmiConfig = createConfig({
  chains: [polygon],
  connectors: [injected()],
  transports: { [polygon.id]: http() },
});

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
);
