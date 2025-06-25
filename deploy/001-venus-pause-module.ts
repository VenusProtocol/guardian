import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { getChainAddresses } from "../config/deploymentConfig";

type ExpectedAddresses = {
  guardian: string;
  multiSendCallOnly: string;
  tenderlyKeeper: string;
};

const hasExpectedAddresses = (addresses: Record<string, string>): addresses is ExpectedAddresses => {
  return !!addresses.guardian && !!addresses.multiSendCallOnly && !!addresses.tenderlyKeeper;
};

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const addresses = getChainAddresses(hre.network.name);

  if (!hasExpectedAddresses(addresses)) {
    throw new Error("Some of the expected addresses are not configured");
  }

  const legacyPoolComptroller = await deployments.get("Unitroller");

  await deploy("VenusPauseModule", {
    from: deployer,
    args: [addresses.tenderlyKeeper, addresses.guardian, addresses.multiSendCallOnly, legacyPoolComptroller.address],
    log: true,
  });
};

func.tags = ["VenusPauseModule"];
func.skip = async (hre: HardhatRuntimeEnvironment) => {
  const addresses = getChainAddresses(hre.network.name);
  return !hasExpectedAddresses(addresses);
};

export default func;
