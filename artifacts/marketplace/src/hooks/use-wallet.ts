import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";

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
    disconnect,
  };
}
