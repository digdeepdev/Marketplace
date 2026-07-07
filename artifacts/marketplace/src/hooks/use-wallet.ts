import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected, walletConnect } from "wagmi/connectors";

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string;

export function useWallet() {
  const { address, chainId, isConnected, isConnecting } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();

  return {
    address,
    chainId,
    isConnected,
    isConnecting,
    connect: () => connect({ connector: injected() }),
    connectWC: () => connect({ connector: walletConnect({ projectId }) }),
    disconnect,
  };
}
