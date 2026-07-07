import { useAccount, useConnect, useDisconnect, useConnectors } from "wagmi";
import { injected } from "wagmi/connectors";

export function useWallet() {
  const { address, chainId, isConnected, isConnecting } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const connectors = useConnectors();

  // Reuse the connectors already registered in the wagmi config so that
  // WalletConnect keeps the same Cloud relay session (required for iOS deep links).
  const wcConnector = connectors.find((c) => c.id === "walletConnect");
  const injectedConnector = connectors.find((c) => c.id === "injected");

  return {
    address,
    chainId,
    isConnected,
    isConnecting,
    connect: () => connect({ connector: injectedConnector ?? injected() }),
    connectWC: () => {
      if (wcConnector) connect({ connector: wcConnector });
    },
    disconnect,
  };
}
