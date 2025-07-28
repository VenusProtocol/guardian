import "@nomicfoundation/hardhat-chai-matchers";
import { impersonateAccount, loadFixture, setBalance } from "@nomicfoundation/hardhat-network-helpers";
import { NumberLike } from "@nomicfoundation/hardhat-network-helpers/dist/src/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumberish } from "ethers";
import { parseEther } from "ethers/lib/utils";
import { ethers } from "hardhat";

import { SafeGuard, SafeGuard__factory } from "../typechain";
import { MultiSendCallOnly, Safe, SafeProxyFactory } from "../typechain";
import { MultiSendCallOnly__factory } from "../typechain/factories/MultiSendCallOnly__factory";
import { SafeProxyFactory__factory } from "../typechain/factories/SafeProxyFactory__factory";
import { Safe__factory } from "../typechain/factories/Safe__factory";

interface TestFixture {
  safeGuard: SafeGuard;
  venusGuardian: Safe;
  owner: SignerWithAddress;
  executor: SignerWithAddress;
  auditor: SignerWithAddress;
}

export const initMainnetUser = async (user: string, balance?: NumberLike) => {
  await impersonateAccount(user);
  if (balance !== undefined) {
    await setBalance(user, balance);
  }
  return ethers.getSigner(user);
};

const getApprovedHashSignature = (signer: SignerWithAddress): string => {
  const APPROVED_HASH_IDENTIFIER = "0x01";
  return ethers.utils.hexConcat([
    ethers.utils.hexZeroPad(signer.address, 32),
    ethers.utils.hexZeroPad("0x", 32),
    APPROVED_HASH_IDENTIFIER,
  ]);
};

const executeSafeTransaction = async (
  safe: Safe,
  amount: BigNumberish,
  to: string,
  data: string,
  signer: SignerWithAddress,
  executor: SignerWithAddress,
) => {
  const AddressZero = ethers.constants.AddressZero;
  const tx = [to, amount, data, 0, 0, 0, 0, AddressZero, AddressZero] as const;
  const txHash = await safe.getTransactionHash(...tx, await safe.nonce());
  await safe.connect(signer).approveHash(txHash);
  return safe.connect(executor).execTransaction(...tx, getApprovedHashSignature(signer));
};

const approveHash = async (
  safeGuard: SafeGuard,
  safe: Safe,
  amount: BigNumberish,
  to: string,
  data: string,
  nonce: BigNumberish,
  auditor: SignerWithAddress,
) => {
  const AddressZero = ethers.constants.AddressZero;
  const tx = [to, amount, data, 0, 0, 0, 0, AddressZero, AddressZero, nonce] as const;
  const txHash = await safeGuard.encodeTransactionData(...tx);
  await safeGuard.connect(auditor).addMessageHash(safe.address, nonce, txHash);
};

const deploySafeSingletons = (() => {
  let safeSingleton: Safe;
  let safeProxyFactory: SafeProxyFactory;
  let multiSendCallOnly: MultiSendCallOnly;

  return async (
    owner: SignerWithAddress,
  ): Promise<{
    safeSingleton: Safe;
    safeProxyFactory: SafeProxyFactory;
    multiSendCallOnly: MultiSendCallOnly;
  }> => {
    if (!safeSingleton) {
      const SafeFactory = new Safe__factory(owner);
      safeSingleton = await SafeFactory.deploy();
      await safeSingleton.deployed();
    }
    if (!safeProxyFactory) {
      const SafeProxyFactoryFactory = new SafeProxyFactory__factory(owner);
      safeProxyFactory = await SafeProxyFactoryFactory.deploy();
      await safeProxyFactory.deployed();
    }
    if (!multiSendCallOnly) {
      const MultiSendCallOnlyFactory = new MultiSendCallOnly__factory(owner);
      multiSendCallOnly = await MultiSendCallOnlyFactory.deploy();
      await multiSendCallOnly.deployed();
    }
    return { safeSingleton, safeProxyFactory, multiSendCallOnly };
  };
})();

const deploySafe = async (
  safeSingleton: Safe,
  safeProxyFactory: SafeProxyFactory,
  owner: SignerWithAddress,
  nonce: number,
) => {
  const setupData = safeSingleton.interface.encodeFunctionData("setup", [
    [owner.address], // owners
    1, // threshold
    ethers.constants.AddressZero, // to
    "0x", // data
    ethers.constants.AddressZero, // fallbackHandler
    ethers.constants.AddressZero, // paymentToken
    0, // payment
    ethers.constants.AddressZero, // paymentReceiver
  ]);

  const saltNonce = ethers.utils.hexZeroPad(ethers.utils.hexlify(nonce), 32);
  const createProxyTx = await safeProxyFactory.createProxyWithNonce(safeSingleton.address, setupData, saltNonce);
  const receipt = await createProxyTx.wait();
  const proxyCreatedEvent = receipt.events?.find(e => e.event === "ProxyCreation");
  const proxyAddress = proxyCreatedEvent?.args?.proxy;
  if (!proxyAddress) {
    throw new Error("Failed to get proxy address from event");
  }

  const SafeFactory = new Safe__factory(owner);
  const safe = SafeFactory.attach(proxyAddress);
  return safe;
};

const setup = async (): Promise<TestFixture> => {
  const [owner, executor, auditor] = await ethers.getSigners();

  const { safeSingleton, safeProxyFactory } = await deploySafeSingletons(owner);
  const venusGuardian = await deploySafe(safeSingleton, safeProxyFactory, owner, 1);

  console.log("VenusGuardian deployed at:", venusGuardian.address);

  const safeGuardFactory = new SafeGuard__factory(owner);
  const safeGuard = await safeGuardFactory.deploy();

  console.log("SafeGuard deployed at:", safeGuard.address);
  const guardianSigner = await initMainnetUser(venusGuardian.address, parseEther("2"));

  await venusGuardian.connect(guardianSigner).setGuard(safeGuard.address);
  await safeGuard.connect(guardianSigner).addExecutor(executor.address);
  await safeGuard.connect(guardianSigner).addAuditor(auditor.address);

  return {
    safeGuard,
    venusGuardian,
    owner,
    executor,
    auditor,
  };
};

describe("VenusPauseModule Integration", function () {
  let fixture: TestFixture;

  beforeEach(async function () {
    fixture = await loadFixture(setup);
  });

  it("should check transaction", async function () {
    const user = "0x6666666666666666666666666666666666666667";

    expect(await ethers.provider.getBalance(user)).to.equal(0);

    await expect(
      executeSafeTransaction(fixture.venusGuardian, parseEther("1"), user, "0x", fixture.owner, fixture.owner),
    ).to.be.revertedWithCustomError(fixture.safeGuard, "NotExecutor");

    await expect(
      executeSafeTransaction(fixture.venusGuardian, parseEther("1"), user, "0x", fixture.owner, fixture.executor),
    ).to.be.revertedWithCustomError(fixture.safeGuard, "InvalidHash");

    await approveHash(
      fixture.safeGuard,
      fixture.venusGuardian,
      parseEther("1"),
      user,
      "0x",
      await fixture.venusGuardian.nonce(), // nonce
      fixture.auditor,
    );

    await expect(
      executeSafeTransaction(fixture.venusGuardian, parseEther("1"), user, "0x", fixture.owner, fixture.executor),
    ).to.be.not.be.reverted;

    expect(await ethers.provider.getBalance(user)).to.equal(parseEther("1"));
  });
});
