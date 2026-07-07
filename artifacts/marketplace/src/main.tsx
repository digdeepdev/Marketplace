import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { polygon, bsc } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";
import App from "./App";
import "./index.css";

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string;

const wagmiConfig = createConfig({
  chains: [polygon, bsc],
  connectors: [
    injected(),
    walletConnect({ projectId }),
  ],
  transports: { [polygon.id]: http(), [bsc.id]: http() },
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
