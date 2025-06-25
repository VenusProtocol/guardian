const knownChains = [
  "hardhat",
  "bsctestnet",
  "bscmainnet",
  "sepolia",
  "ethereum",
  "opbnbtestnet",
  "opbnbmainnet",
  "arbitrumsepolia",
  "arbitrumone",
  "opsepolia",
  "opmainnet",
  "basesepolia",
  "basemainnet",
  "unichainsepolia",
  "unichainmainnet",
  "berachainbepolia",
  "zksyncsepolia",
  "zksyncmainnet",
] as const;

export type VenusChainName = { [k in keyof typeof knownChains]: typeof knownChains[k] }[number];

export const isKnownChain = (networkName: string): networkName is VenusChainName => {
  return (knownChains as readonly string[]).includes(networkName);
};

export const getChainName = (networkName: string): VenusChainName => {
  if (isKnownChain(networkName)) {
    return networkName;
  }

  throw new Error(`Unknown chain: ${networkName}`);
};
