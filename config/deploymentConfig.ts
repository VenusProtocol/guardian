import { VenusChainName, getChainName } from "./chains";

export type PreconfiguredAddresses = {
  [chain in VenusChainName]: {
    [contract: string]: string;
  };
};

const TENDERLY_KEEPER = "0x55A9f5374Af30E3045FB491f1da3C2E8a74d168D";
const MULTI_SEND_CALL_ONLY_CANONICAL = "0x9641d764fc13c8B624c04430C7356C1C7C8102e2";
const MULTI_SEND_CALL_ONLY_ZKSYNC = "0x0408EF011960d02349d50286D20531229BCef773";

export const PRECONFIGURED_ADDRESSES: PreconfiguredAddresses = {
  hardhat: {},
  bsctestnet: {
    tenderlyKeeper: TENDERLY_KEEPER,
    guardian: "0x70B9120deF94F377fD98AB28CbBCe477a355202A",
    multiSendCallOnly: MULTI_SEND_CALL_ONLY_CANONICAL,
  },
  bscmainnet: {
    tenderlyKeeper: TENDERLY_KEEPER,
    guardian: "0x1C2CAc6ec528c20800B2fe734820D87b581eAA6B",
    multiSendCallOnly: MULTI_SEND_CALL_ONLY_CANONICAL,
  },
  sepolia: {
    tenderlyKeeper: TENDERLY_KEEPER,
    guardian: "0x94fa6078b6b8a26f0b6edffbe6501b22a10470fb",
    multiSendCallOnly: MULTI_SEND_CALL_ONLY_CANONICAL,
  },
  ethereum: {
    tenderlyKeeper: TENDERLY_KEEPER,
    guardian: "0x285960C5B22fD66A736C7136967A3eB15e93CC67",
    multiSendCallOnly: MULTI_SEND_CALL_ONLY_CANONICAL,
  },
  opbnbtestnet: {
    tenderlyKeeper: TENDERLY_KEEPER,
    guardian: "0xb15f6EfEbC276A3b9805df81b5FB3D50C2A62BDf",
    multiSendCallOnly: MULTI_SEND_CALL_ONLY_CANONICAL,
  },
  opbnbmainnet: {
    tenderlyKeeper: TENDERLY_KEEPER,
    guardian: "0xC46796a21a3A9FAB6546aF3434F2eBfFd0604207",
    multiSendCallOnly: MULTI_SEND_CALL_ONLY_CANONICAL,
  },
  arbitrumsepolia: {
    tenderlyKeeper: TENDERLY_KEEPER,
    guardian: "0x1426A5Ae009c4443188DA8793751024E358A61C2",
    multiSendCallOnly: MULTI_SEND_CALL_ONLY_CANONICAL,
  },
  arbitrumone: {
    tenderlyKeeper: TENDERLY_KEEPER,
    guardian: "0x14e0E151b33f9802b3e75b621c1457afc44DcAA0",
    multiSendCallOnly: MULTI_SEND_CALL_ONLY_CANONICAL,
  },
  opsepolia: {
    tenderlyKeeper: TENDERLY_KEEPER,
    guardian: "0xd57365EE4E850e881229e2F8Aa405822f289e78d",
    multiSendCallOnly: MULTI_SEND_CALL_ONLY_CANONICAL,
  },
  opmainnet: {
    tenderlyKeeper: TENDERLY_KEEPER,
    guardian: "0x2e94dd14E81999CdBF5deDE31938beD7308354b3",
    multiSendCallOnly: MULTI_SEND_CALL_ONLY_CANONICAL,
  },
  basesepolia: {
    tenderlyKeeper: TENDERLY_KEEPER,
    guardian: "0xdf3b635d2b535f906BB02abb22AED71346E36a00",
    multiSendCallOnly: MULTI_SEND_CALL_ONLY_CANONICAL,
  },
  basemainnet: {
    tenderlyKeeper: TENDERLY_KEEPER,
    guardian: "0x1803Cf1D3495b43cC628aa1d8638A981F8CD341C",
    multiSendCallOnly: MULTI_SEND_CALL_ONLY_CANONICAL,
  },
  unichainsepolia: {
    tenderlyKeeper: TENDERLY_KEEPER,
    guardian: "0x9831D3A641E8c7F082EEA75b8249c99be9D09a34",
    multiSendCallOnly: MULTI_SEND_CALL_ONLY_CANONICAL,
  },
  unichainmainnet: {
    tenderlyKeeper: TENDERLY_KEEPER,
    guardian: "0x1803Cf1D3495b43cC628aa1d8638A981F8CD341C",
    multiSendCallOnly: MULTI_SEND_CALL_ONLY_CANONICAL,
  },
  berachainbepolia: {},
  zksyncsepolia: {
    tenderlyKeeper: TENDERLY_KEEPER,
    guardian: "0xa2f83de95E9F28eD443132C331B6a9C9B7a9F866",
    multiSendCallOnly: MULTI_SEND_CALL_ONLY_ZKSYNC,
  },
  zksyncmainnet: {
    tenderlyKeeper: TENDERLY_KEEPER,
    guardian: "0x751Aa759cfBB6CE71A43b48e40e1cCcFC66Ba4aa",
    multiSendCallOnly: MULTI_SEND_CALL_ONLY_ZKSYNC,
  },
};

export const getChainAddresses = (networkName: string): PreconfiguredAddresses[VenusChainName] => {
  return PRECONFIGURED_ADDRESSES[getChainName(networkName)];
};
