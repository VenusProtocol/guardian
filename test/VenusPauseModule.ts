import { FakeContract, smock } from "@defi-wonderland/smock";
import "@nomicfoundation/hardhat-chai-matchers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import chai from "chai";
import { ethers } from "hardhat";

import {
  Comptroller,
  Comptroller__factory,
  IComptroller,
  Safe,
  VToken,
  VenusPauseModule,
  VenusPauseModule__factory,
} from "../typechain";
import { IComptroller__factory as LegacyPoolComptroller__factory } from "../typechain/factories/IComptroller__factory";
import { MultiSendCallOnly__factory } from "../typechain/factories/MultiSendCallOnly__factory";

chai.use(smock.matchers);

const OPERATION = {
  CALL: 0,
  DELEGATECALL: 1,
} as const;

const ACTION = {
  MINT: 0,
  BORROW: 2,
  ENTER_MARKET: 7,
} as const;

interface MultiSendDecodedTx {
  operation: number;
  to: string;
  value: string;
  data: string;
}

const decodeMultiSendData = (data: string): MultiSendDecodedTx[] => {
  const txs: MultiSendDecodedTx[] = [];
  let i = 2; // skip '0x'
  while (i < data.length) {
    const operation = parseInt(data.slice(i, i + 2), 16);
    i += 2;
    const to = "0x" + data.slice(i, i + 40);
    i += 40;
    const value = "0x" + data.slice(i, i + 64);
    i += 64;
    const dataLength = parseInt(data.slice(i, i + 64), 16) * 2;
    i += 64;
    const txData = "0x" + data.slice(i, i + dataLength);
    i += dataLength;
    txs.push({ operation, to, value, data: txData });
  }
  return txs;
};

const multiSendInterface = MultiSendCallOnly__factory.createInterface();

const decodeMultiSendTransaction = (data: string): MultiSendDecodedTx[] => {
  const decoded = multiSendInterface.decodeFunctionData("multiSend", data as string);
  const txs = decoded[0] as string;
  return decodeMultiSendData(txs);
};

describe("VenusPauseModule", function () {
  let VenusPauseModule: VenusPauseModule;
  let keeper: string;
  let keeperSigner: SignerWithAddress;
  let otherSigner: SignerWithAddress;
  let safe: FakeContract<Safe>;
  let multisend: string;
  let vToken: FakeContract<VToken>;
  let legacyPoolComptroller: FakeContract<IComptroller>;
  let comptroller: FakeContract<Comptroller>;

  beforeEach(async () => {
    const [_, _keeperSigner, _otherSigner] = await ethers.getSigners();
    keeperSigner = _keeperSigner;
    otherSigner = _otherSigner;
    keeper = keeperSigner.address;

    safe = await smock.fake<Safe>("Safe");
    vToken = await smock.fake<VToken>("VToken");
    legacyPoolComptroller = await smock.fake<IComptroller>("IComptroller");
    comptroller = await smock.fake<Comptroller>("Comptroller");
    multisend = ethers.Wallet.createRandom().address;

    const VenusPauseModuleFactory = (await ethers.getContractFactory("VenusPauseModule")) as VenusPauseModule__factory;
    VenusPauseModule = await VenusPauseModuleFactory.deploy(
      keeper,
      safe.address,
      multisend,
      legacyPoolComptroller.address,
    );
  });

  it("constructor sets state and reverts on zero addresses", async () => {
    const VenusPauseModuleFactory = (await ethers.getContractFactory("VenusPauseModule")) as VenusPauseModule__factory;
    await expect(
      VenusPauseModuleFactory.deploy(
        ethers.constants.AddressZero,
        safe.address,
        multisend,
        legacyPoolComptroller.address,
      ),
    ).to.be.reverted;
    await expect(
      VenusPauseModuleFactory.deploy(keeper, ethers.constants.AddressZero, multisend, legacyPoolComptroller.address),
    ).to.be.reverted;
    await expect(
      VenusPauseModuleFactory.deploy(keeper, safe.address, ethers.constants.AddressZero, legacyPoolComptroller.address),
    ).to.be.reverted;
  });

  it("only keeper can call pauseMarket", async () => {
    await expect(VenusPauseModule.connect(otherSigner).pauseMarket(vToken.address)).to.be.revertedWithCustomError(
      VenusPauseModule,
      "Unauthorized",
    );
  });

  it("pauseMarket (legacy): calls legacy pool pause actions via Safe", async () => {
    vToken.comptroller.returns(legacyPoolComptroller.address);
    safe.execTransactionFromModule.returns(true);
    await expect(VenusPauseModule.connect(keeperSigner).pauseMarket(vToken.address)).to.not.be.reverted;
    expect(safe.execTransactionFromModule).to.have.been.called;
  });

  it("pauseMarket (isolated): calls pause and setCollateralFactor via Safe", async () => {
    vToken.comptroller.returns(comptroller.address);
    comptroller.markets.returns([false, 0, 42]);
    safe.execTransactionFromModule.returns(true);
    await expect(VenusPauseModule.connect(keeperSigner).pauseMarket(vToken.address)).to.not.be.reverted;
    expect(safe.execTransactionFromModule).to.have.been.called;
  });

  it("reverts if Safe tx fails", async () => {
    vToken.comptroller.returns(legacyPoolComptroller.address);
    safe.execTransactionFromModule.returns(false);
    await expect(VenusPauseModule.connect(keeperSigner).pauseMarket(vToken.address)).to.be.revertedWithCustomError(
      VenusPauseModule,
      "SafeTxFailed",
    );
  });

  it("pauseMarket (isolated): calldata to execTransactionFromModule is correct", async () => {
    vToken.comptroller.returns(comptroller.address);
    comptroller.markets.returns([false, 0, 42]);
    safe.execTransactionFromModule.returns(true);

    await VenusPauseModule.connect(keeperSigner).pauseMarket(vToken.address);

    // Get the call args
    const call = safe.execTransactionFromModule.getCall(0);
    expect(call).to.exist;
    const [to, value, data, operation] = call.args;
    expect(to).to.equal(multisend);
    expect(value).to.equal(0);
    expect(operation).to.equal(OPERATION.DELEGATECALL);

    // Parse the multiSend transactions (should be two calls)
    const calls = decodeMultiSendTransaction(data as string);
    expect(calls.length).to.equal(2);

    // First call: setActionsPaused
    const comptrollerInterface = Comptroller__factory.createInterface();
    const [vTokens, actions, paused] = comptrollerInterface.decodeFunctionData("setActionsPaused", calls[0].data);
    expect(calls[0].to.toLowerCase()).to.equal(comptroller.address.toLowerCase());
    expect(vTokens).to.have.lengthOf(1);
    expect(vTokens[0]).to.equal(vToken.address);
    expect(actions).to.have.lengthOf(3);
    expect(actions[0]).to.equal(ACTION.MINT);
    expect(actions[1]).to.equal(ACTION.BORROW);
    expect(actions[2]).to.equal(ACTION.ENTER_MARKET);
    expect(paused).to.equal(true);

    // Second call: setCollateralFactor
    const decoded2 = comptrollerInterface.decodeFunctionData("setCollateralFactor", calls[1].data);
    expect(calls[1].to.toLowerCase()).to.equal(comptroller.address.toLowerCase());
    expect(decoded2[0]).to.equal(vToken.address);
    expect(decoded2[1].toString()).to.equal("0");
    expect(decoded2[2].toString()).to.equal("42");
  });

  it("pauseMarket (legacy): calldata to execTransactionFromModule is correct", async () => {
    vToken.comptroller.returns(legacyPoolComptroller.address);
    safe.execTransactionFromModule.returns(true);
    await VenusPauseModule.connect(keeperSigner).pauseMarket(vToken.address);
    const call = safe.execTransactionFromModule.getCall(0);
    expect(call).to.exist;
    const [to, value, data, operation] = call.args;
    expect(to).to.equal(multisend);
    expect(value).to.equal(0);
    expect(operation).to.equal(OPERATION.DELEGATECALL);

    // Decode MultiSendCallOnly.multiSend calldata
    const calls = decodeMultiSendTransaction(data as string);
    expect(calls.length).to.equal(1);

    // Decode _setActionsPaused
    const comptrollerInterface = LegacyPoolComptroller__factory.createInterface();
    const [vTokens, actions, paused] = comptrollerInterface.decodeFunctionData("_setActionsPaused", calls[0].data);
    expect(calls[0].to.toLowerCase()).to.equal(legacyPoolComptroller.address.toLowerCase());
    expect(vTokens).to.have.lengthOf(1);
    expect(vTokens[0]).to.equal(vToken.address);
    expect(actions).to.have.lengthOf(3);
    expect(actions[0]).to.equal(ACTION.MINT);
    expect(actions[1]).to.equal(ACTION.BORROW);
    expect(actions[2]).to.equal(ACTION.ENTER_MARKET);
    expect(paused).to.equal(true);
  });

  it("should emit MarketPausedByMonitoring event for the legacy pool", async () => {
    vToken.comptroller.returns(legacyPoolComptroller.address);
    safe.execTransactionFromModule.returns(true);

    await expect(VenusPauseModule.connect(keeperSigner).pauseMarket(vToken.address))
      .to.emit(VenusPauseModule, "MarketPausedByMonitoring")
      .withArgs(vToken.address, legacyPoolComptroller.address);
  });

  it("should emit MarketPausedByMonitoring event for isolated pools", async () => {
    vToken.comptroller.returns(comptroller.address);
    comptroller.markets.returns([false, 0, 42]);
    safe.execTransactionFromModule.returns(true);

    await expect(VenusPauseModule.connect(keeperSigner).pauseMarket(vToken.address))
      .to.emit(VenusPauseModule, "MarketPausedByMonitoring")
      .withArgs(vToken.address, comptroller.address);
  });
});
