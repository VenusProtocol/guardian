import "@nomicfoundation/hardhat-chai-matchers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";

import {
  DrillComptroller,
  DrillComptroller__factory,
  DrillLegacyComptroller,
  DrillLegacyComptroller__factory,
  DrillVToken,
  DrillVToken__factory,
  SafeProxy__factory,
  VenusPauseModule,
  VenusPauseModule__factory,
} from "../typechain";
import { MultiSendCallOnly, Safe, SafeProxyFactory } from "../typechain";
import { MultiSendCallOnly__factory } from "../typechain/factories/MultiSendCallOnly__factory";
import { SafeProxyFactory__factory } from "../typechain/factories/SafeProxyFactory__factory";
import { Safe__factory } from "../typechain/factories/Safe__factory";

const ACTION = {
  MINT: 0,
  BORROW: 2,
  ENTER_MARKET: 7,
} as const;

interface TestFixture {
  venusPauseModule: VenusPauseModule;
  venusGuardian: Safe;
  drillComptroller: DrillComptroller;
  drillVToken: DrillVToken;
  drillLegacyComptroller: DrillLegacyComptroller;
  drillLegacyVToken: DrillVToken;
  owner: SignerWithAddress;
  keeper: SignerWithAddress;
  user1: SignerWithAddress;
  user2: SignerWithAddress;
}

const getApprovedHashSignature = (signer: SignerWithAddress): string => {
  const APPROVED_HASH_IDENTIFIER = "0x01";
  return ethers.utils.hexConcat([
    ethers.utils.hexZeroPad(signer.address, 32),
    ethers.utils.hexZeroPad("0x", 32),
    APPROVED_HASH_IDENTIFIER,
  ]);
};

const executeSafeTransaction = async (safe: Safe, to: string, data: string, signer: SignerWithAddress) => {
  const AddressZero = ethers.constants.AddressZero;
  const tx = [to, 0, data, 0, 0, 0, 0, AddressZero, AddressZero] as const;
  const txHash = await safe.getTransactionHash(...tx, await safe.nonce());
  await safe.connect(signer).approveHash(txHash);
  return safe.execTransaction(...tx, getApprovedHashSignature(signer));
};

const setup = async (): Promise<TestFixture> => {
  const [owner, keeper, user1, user2] = await ethers.getSigners();

  const safeFactory = new Safe__factory(owner);
  const safeSingleton = await safeFactory.deploy();

  const safeProxyFactory = new SafeProxy__factory(owner);
  const safeProxy = await safeProxyFactory.deploy(safeSingleton.address);

  console.log("Safe singleton deployed at:", safeSingleton.address);
  console.log("SafeProxy deployed at:", safeProxy.address);

  const venusGuardian = await safeFactory.attach(safeProxy.address);
  await venusGuardian.setup(
    [owner.address],
    1,
    ethers.constants.AddressZero,
    "0x00",
    ethers.constants.AddressZero,
    ethers.constants.AddressZero,
    "0",
    ethers.constants.AddressZero,
  );

  console.log("Venus Guardian Safe deployed at:", venusGuardian.address);

  const MultiSendCallOnlyFactory = new MultiSendCallOnly__factory(owner);
  const multiSendCallOnly = await MultiSendCallOnlyFactory.deploy();
  await multiSendCallOnly.deployed();

  console.log("MultiSendCallOnly deployed at:", multiSendCallOnly.address);

  // Deploy isolated pool contracts
  const DrillComptrollerFactory = new DrillComptroller__factory(owner);
  const drillComptroller = await DrillComptrollerFactory.deploy(owner.address);
  await drillComptroller.deployed();

  console.log("DrillComptroller deployed at:", drillComptroller.address);

  const DrillVTokenFactory = new DrillVToken__factory(owner);
  const drillVToken = await DrillVTokenFactory.deploy(
    drillComptroller.address,
    false,
    "Drill USDC",
    "drillUSDC",
    18,
    venusGuardian.address,
  );
  await drillVToken.deployed();

  console.log("DrillVToken deployed at:", drillVToken.address);

  const DrillLegacyComptrollerFactory = new DrillLegacyComptroller__factory(owner);
  const drillLegacyComptroller = await DrillLegacyComptrollerFactory.deploy(owner.address);
  await drillLegacyComptroller.deployed();

  console.log("DrillLegacyComptroller deployed at:", drillLegacyComptroller.address);

  const drillLegacyVToken = await DrillVTokenFactory.deploy(
    drillLegacyComptroller.address,
    true,
    "Drill Legacy USDC",
    "drillLegacyUSDC",
    18,
    venusGuardian.address,
  );
  await drillLegacyVToken.deployed();

  console.log("DrillLegacyVToken deployed at:", drillLegacyVToken.address);

  await drillComptroller.listMarket(
    drillVToken.address,
    ethers.utils.parseUnits("0.8", 18),
    ethers.utils.parseUnits("0.85", 18),
  );
  await drillLegacyComptroller.listMarket(drillLegacyVToken.address, ethers.utils.parseUnits("0.75", 18));

  await drillComptroller.transferOwnership(venusGuardian.address);
  await drillLegacyComptroller.transferOwnership(venusGuardian.address);

  const acceptOwnershipData = drillComptroller.interface.encodeFunctionData("acceptOwnership");
  await executeSafeTransaction(venusGuardian, drillComptroller.address, acceptOwnershipData, owner);

  const acceptLegacyOwnershipData = drillLegacyComptroller.interface.encodeFunctionData("acceptOwnership");
  await executeSafeTransaction(venusGuardian, drillLegacyComptroller.address, acceptLegacyOwnershipData, owner);

  const VenusPauseModuleFactory = new VenusPauseModule__factory(owner);
  const venusPauseModule = await VenusPauseModuleFactory.deploy(
    keeper.address,
    venusGuardian.address,
    multiSendCallOnly.address,
    drillLegacyComptroller.address,
  );
  await venusPauseModule.deployed();

  const enableModuleData = venusGuardian.interface.encodeFunctionData("enableModule", [venusPauseModule.address]);
  await executeSafeTransaction(venusGuardian, venusGuardian.address, enableModuleData, owner);

  return {
    venusPauseModule,
    venusGuardian,
    drillComptroller,
    drillVToken,
    drillLegacyComptroller,
    drillLegacyVToken,
    owner,
    keeper,
    user1,
    user2,
  };
};

describe("VenusPauseModule Integration", function () {
  let fixture: TestFixture;

  beforeEach(async function () {
    fixture = await loadFixture(setup);
  });

  it("should pause market via Safe when called by keeper", async function () {
    const { venusPauseModule, drillComptroller, drillVToken, keeper } = fixture;

    // Verify initial state
    expect(await drillComptroller.actionPaused(drillVToken.address, ACTION.MINT)).to.be.false;
    expect(await drillComptroller.actionPaused(drillVToken.address, ACTION.BORROW)).to.be.false;
    expect(await drillComptroller.actionPaused(drillVToken.address, ACTION.ENTER_MARKET)).to.be.false;

    // Call pauseMarket as keeper
    await venusPauseModule.connect(keeper).pauseMarket(drillVToken.address);

    // Verify market is paused
    expect(await drillComptroller.actionPaused(drillVToken.address, ACTION.MINT)).to.be.true;
    expect(await drillComptroller.actionPaused(drillVToken.address, ACTION.BORROW)).to.be.true;
    expect(await drillComptroller.actionPaused(drillVToken.address, ACTION.ENTER_MARKET)).to.be.true;

    // Verify collateral factor is set to 0 (isolated pool sets collateral factor to 0)
    const [isListed, collateralFactor, liquidationThreshold] = await drillComptroller.markets(drillVToken.address);
    expect(isListed).to.be.true;
    expect(collateralFactor).to.equal(0);
    expect(liquidationThreshold).to.equal(ethers.utils.parseUnits("0.85", 18));
  });

  // it("should pause legacy pool market via Safe when called by keeper", async function () {
  //   const { venusPauseModule, drillLegacyComptroller, drillLegacyVToken, keeper } = fixture;

  //   // Verify initial state
  //   expect(await drillLegacyComptroller.actionPaused(drillLegacyVToken.address, ACTION.MINT)).to.be.false;
  //   expect(await drillLegacyComptroller.actionPaused(drillLegacyVToken.address, ACTION.BORROW)).to.be.false;
  //   expect(await drillLegacyComptroller.actionPaused(drillLegacyVToken.address, ACTION.ENTER_MARKET)).to.be.false;

  //   // Call pauseMarket as keeper
  //   await venusPauseModule.connect(keeper).pauseMarket(drillLegacyVToken.address);

  //   // Verify market is paused (legacy pool only pauses actions, doesn't set collateral factor to 0)
  //   expect(await drillLegacyComptroller.actionPaused(drillLegacyVToken.address, ACTION.MINT)).to.be.true;
  //   expect(await drillLegacyComptroller.actionPaused(drillLegacyVToken.address, ACTION.BORROW)).to.be.true;
  //   expect(await drillLegacyComptroller.actionPaused(drillLegacyVToken.address, ACTION.ENTER_MARKET)).to.be.true;

  //   // Verify collateral factor is unchanged (legacy pool doesn't modify collateral factor)
  //   const [isListed, collateralFactor] = await drillLegacyComptroller.markets(drillLegacyVToken.address);
  //   expect(isListed).to.be.true;
  //   expect(collateralFactor).to.equal(ethers.utils.parseUnits("0.75", 18)); // Should remain unchanged
  // });

  // it("should revert when called by non-keeper", async function () {
  //   const { venusPauseModule, drillVToken, user1 } = fixture;

  //   await expect(venusPauseModule.connect(user1).pauseMarket(drillVToken.address)).to.be.revertedWithCustomError(
  //     venusPauseModule,
  //     "Unauthorized",
  //   );
  // });
});
