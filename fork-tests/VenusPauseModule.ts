import "@nomicfoundation/hardhat-chai-matchers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import accessControlManagerArtifact from "@venusprotocol/governance-contracts/artifacts/contracts/Governance/IAccessControlManagerV8.sol/IAccessControlManagerV8.json";
import governanceAddresses from "@venusprotocol/governance-contracts/deployments/bscmainnet_addresses.json";
import isolatedPoolAddresses from "@venusprotocol/isolated-pools/deployments/bscmainnet_addresses.json";
import protocolAddresses from "@venusprotocol/venus-protocol/deployments/bscmainnet_addresses.json";
import { expect } from "chai";
import { parseEther } from "ethers/lib/utils";
import { ethers } from "hardhat";

import { getChainAddresses } from "../config/deploymentConfig";
import { VenusPauseModule, VenusPauseModule__factory } from "../typechain";
import { forking, initMainnetUser } from "./utils";

const ACTION = {
  MINT: 0,
  BORROW: 2,
  ENTER_MARKET: 7,
} as const;

forking(52073000, () => {
  let venusPauseModule: VenusPauseModule;
  let keeperSigner: SignerWithAddress;

  const addresses = getChainAddresses("bscmainnet");
  const keeper = addresses.tenderlyKeeper;
  const NORMAL_TIMELOCK = governanceAddresses.addresses.NormalTimelock;
  const ACCESS_CONTROL_MANAGER = governanceAddresses.addresses.AccessControlManager;
  const LEGACY_POOL_COMPTROLLER = protocolAddresses.addresses.Unitroller;
  const VUSDC_LEGACY = protocolAddresses.addresses.vUSDC;
  const VFLOKI_ISOLATED = isolatedPoolAddresses.addresses.VToken_vFLOKI_GameFi;

  if (process.env.FORK !== "true" || process.env.FORKED_NETWORK !== "bscmainnet") {
    return;
  }

  beforeEach(async () => {
    keeperSigner = await initMainnetUser(keeper, parseEther("2"));
    const timelockSigner = await initMainnetUser(NORMAL_TIMELOCK, parseEther("2"));

    const accessControlManager = new ethers.Contract(
      ACCESS_CONTROL_MANAGER,
      accessControlManagerArtifact.abi,
      timelockSigner,
    );

    await accessControlManager.giveCallPermission(
      ethers.constants.AddressZero,
      "setCollateralFactor(address,uint256,uint256)",
      addresses.guardian,
    );

    const VenusPauseModuleFactory = (await ethers.getContractFactory("VenusPauseModule")) as VenusPauseModule__factory;
    venusPauseModule = await VenusPauseModuleFactory.deploy(
      keeper,
      addresses.guardian,
      addresses.multiSendCallOnly,
      LEGACY_POOL_COMPTROLLER,
    );

    const guardianSafe = await ethers.getContractAt("Safe", addresses.guardian);
    const guardianSigner = await initMainnetUser(addresses.guardian, parseEther("2"));
    await guardianSafe.connect(guardianSigner).enableModule(venusPauseModule.address);
  });

  it("should pause an isolated pool market (vFLOKI)", async () => {
    const vFLOKI = await ethers.getContractAt("VToken", VFLOKI_ISOLATED);
    const comptroller = await ethers.getContractAt("Comptroller", await vFLOKI.comptroller());

    const [isListed, collateralFactor, liquidationThreshold] = await comptroller.markets(VFLOKI_ISOLATED);
    expect(isListed).to.be.true;
    expect(collateralFactor).to.be.gt(0);
    expect(await comptroller.actionPaused(VFLOKI_ISOLATED, ACTION.MINT)).to.be.false;
    expect(await comptroller.actionPaused(VFLOKI_ISOLATED, ACTION.BORROW)).to.be.false;
    expect(await comptroller.actionPaused(VFLOKI_ISOLATED, ACTION.ENTER_MARKET)).to.be.false;

    await expect(venusPauseModule.connect(keeperSigner).pauseMarket(VFLOKI_ISOLATED)).to.not.be.reverted;

    const [isListedAfter, collateralFactorAfter, liquidationThresholdAfter] = await comptroller.markets(
      VFLOKI_ISOLATED,
    );
    expect(isListedAfter).to.be.true;
    expect(collateralFactorAfter).to.equal(0);
    expect(liquidationThresholdAfter).to.equal(liquidationThreshold);

    expect(await comptroller.actionPaused(VFLOKI_ISOLATED, ACTION.MINT)).to.be.true;
    expect(await comptroller.actionPaused(VFLOKI_ISOLATED, ACTION.BORROW)).to.be.true;
    expect(await comptroller.actionPaused(VFLOKI_ISOLATED, ACTION.ENTER_MARKET)).to.be.true;
  });

  it("should pause a legacy pool market (vUSDC)", async () => {
    const legacyComptroller = await ethers.getContractAt("IComptroller", LEGACY_POOL_COMPTROLLER);

    expect(await legacyComptroller.actionPaused(VUSDC_LEGACY, ACTION.MINT)).to.be.false;
    expect(await legacyComptroller.actionPaused(VUSDC_LEGACY, ACTION.BORROW)).to.be.false;
    expect(await legacyComptroller.actionPaused(VUSDC_LEGACY, ACTION.ENTER_MARKET)).to.be.false;

    await expect(venusPauseModule.connect(keeperSigner).pauseMarket(VUSDC_LEGACY)).to.not.be.reverted;

    expect(await legacyComptroller.actionPaused(VUSDC_LEGACY, ACTION.MINT)).to.be.true;
    expect(await legacyComptroller.actionPaused(VUSDC_LEGACY, ACTION.BORROW)).to.be.true;
    expect(await legacyComptroller.actionPaused(VUSDC_LEGACY, ACTION.ENTER_MARKET)).to.be.true;
  });

  it("should revert when non-keeper tries to pause market", async () => {
    const [_, nonKeeper] = await ethers.getSigners();

    await expect(venusPauseModule.connect(nonKeeper).pauseMarket(VFLOKI_ISOLATED)).to.be.revertedWithCustomError(
      venusPauseModule,
      "Unauthorized",
    );
  });
});
