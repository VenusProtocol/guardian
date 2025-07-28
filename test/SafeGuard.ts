import { FakeContract, smock } from "@defi-wonderland/smock";
import { impersonateAccount, setBalance } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { parseEther } from "ethers/lib/utils";
import { ethers } from "hardhat";

import { ISafe, SafeGuard, SafeGuard__factory } from "../typechain";

const createFakeSafe = async (address: string): Promise<SignerWithAddress> => {
  await impersonateAccount(address);
  await setBalance(address, parseEther("2"));
  await ethers.provider.send("hardhat_setCode", [address, "0x1234"]);
  return await ethers.getSigner(address);
};

describe("SafeGuard", function () {
  const zeroAddress = ethers.constants.AddressZero;
  const zeroBytes32 = ethers.constants.HashZero;
  const zeroTx = [zeroAddress, 0, "0x", 0, 0, 0, 0, zeroAddress, zeroAddress, "0x"] as const;
  let safeGuard: SafeGuard;
  let owner: SignerWithAddress;
  let executor1: SignerWithAddress;
  let executor2: SignerWithAddress;
  let executor3: SignerWithAddress;
  let auditor1: SignerWithAddress;
  let auditor2: SignerWithAddress;
  let auditor3: SignerWithAddress;
  let nonExecutor: SignerWithAddress;
  let safeWallet: SignerWithAddress;
  let safeWalletFake: FakeContract<ISafe>;

  beforeEach(async function () {
    [owner, executor1, executor2, executor3, nonExecutor, auditor1, auditor2, auditor3] = await ethers.getSigners();
    const safeGuardFactory = new SafeGuard__factory(owner);
    safeGuard = await safeGuardFactory.deploy();
    safeWalletFake = await smock.fake<ISafe>("ISafe");
    safeWallet = await createFakeSafe("0x1234567890123456789012345678901234567890");
  });

  describe("addExecutor", function () {
    it("should add a single executor successfully", async function () {
      await expect(safeGuard.connect(safeWallet).addExecutor(executor1.address))
        .to.emit(safeGuard, "ExecutorAdded")
        .withArgs(safeWallet.address, executor1.address);

      const executors = await safeGuard.executors(safeWallet.address);
      expect(executors).to.include(executor1.address);
      expect(executors.length).to.equal(1);
    });

    it("should revert when adding zero address", async function () {
      await expect(safeGuard.connect(safeWallet).addExecutor(zeroAddress)).to.be.revertedWithCustomError(
        safeGuard,
        "ZeroAddress",
      );
    });

    it("should revert when adding duplicate executor", async function () {
      await safeGuard.connect(safeWallet).addExecutor(executor1.address);

      await expect(safeGuard.connect(safeWallet).addExecutor(executor1.address))
        .to.be.revertedWithCustomError(safeGuard, "ExecutorExists")
        .withArgs(executor1.address);
    });

    it("should revert when called by EOA", async function () {
      await expect(safeGuard.connect(owner).addExecutor(executor1.address)).to.be.revertedWithCustomError(
        safeGuard,
        "ContractNotAllowed",
      );
    });

    it("should add multiple executors correctly", async function () {
      await safeGuard.connect(safeWallet).addExecutor(executor1.address);
      await safeGuard.connect(safeWallet).addExecutor(executor2.address);
      await safeGuard.connect(safeWallet).addExecutor(executor3.address);

      const executors = await safeGuard.executors(safeWallet.address);
      expect(executors).to.include(executor1.address);
      expect(executors).to.include(executor2.address);
      expect(executors).to.include(executor3.address);
      expect(executors.length).to.equal(3);
    });
  });

  describe("addExecutors", function () {
    it("should add multiple executors successfully", async function () {
      const executorsList = [executor1.address, executor2.address, executor3.address];

      await expect(safeGuard.connect(safeWallet).addExecutors(executorsList))
        .to.emit(safeGuard, "ExecutorAdded")
        .withArgs(safeWallet.address, executor1.address)
        .and.to.emit(safeGuard, "ExecutorAdded")
        .withArgs(safeWallet.address, executor2.address)
        .and.to.emit(safeGuard, "ExecutorAdded")
        .withArgs(safeWallet.address, executor3.address);

      const executors = await safeGuard.executors(safeWallet.address);
      expect(executors).to.include(executor1.address);
      expect(executors).to.include(executor2.address);
      expect(executors).to.include(executor3.address);
      expect(executors.length).to.equal(3);
    });

    it("should revert when adding empty list", async function () {
      await expect(safeGuard.connect(safeWallet).addExecutors([])).to.be.revertedWithCustomError(
        safeGuard,
        "InvalidLength",
      );
    });

    it("should revert when adding list with zero address", async function () {
      const executorsList = [executor1.address, zeroAddress, executor2.address];

      await expect(safeGuard.connect(safeWallet).addExecutors(executorsList)).to.be.revertedWithCustomError(
        safeGuard,
        "ZeroAddress",
      );
    });

    it("should revert when adding list with duplicate", async function () {
      const executorsList = [executor1.address, executor1.address, executor2.address];

      await expect(safeGuard.connect(safeWallet).addExecutors(executorsList))
        .to.be.revertedWithCustomError(safeGuard, "ExecutorExists")
        .withArgs(executor1.address);
    });

    it("should revert when called by EOA", async function () {
      const executorsList = [executor1.address, executor2.address];

      await expect(safeGuard.connect(owner).addExecutors(executorsList)).to.be.revertedWithCustomError(
        safeGuard,
        "ContractNotAllowed",
      );
    });
  });

  describe("removeExecutor", function () {
    beforeEach(async function () {
      await safeGuard.connect(safeWallet).addExecutor(executor1.address);
      await safeGuard.connect(safeWallet).addExecutor(executor2.address);
    });

    it("should remove executor successfully", async function () {
      await expect(safeGuard.connect(safeWallet).removeExecutor(executor1.address))
        .to.emit(safeGuard, "ExecutorRemoved")
        .withArgs(safeWallet.address, executor1.address);

      const executors = await safeGuard.executors(safeWallet.address);
      expect(executors).to.not.include(executor1.address);
      expect(executors).to.include(executor2.address);
      expect(executors.length).to.equal(1);
    });

    it("should revert when removing zero address", async function () {
      await expect(safeGuard.connect(safeWallet).removeExecutor(zeroAddress)).to.be.revertedWithCustomError(
        safeGuard,
        "ZeroAddress",
      );
    });

    it("should revert when removing non-existent executor", async function () {
      await expect(safeGuard.connect(safeWallet).removeExecutor(executor3.address))
        .to.be.revertedWithCustomError(safeGuard, "ExecutorDoesNotExist")
        .withArgs(executor3.address);
    });

    it("should revert when called by EOA", async function () {
      await expect(safeGuard.connect(owner).removeExecutor(executor1.address)).to.be.revertedWithCustomError(
        safeGuard,
        "ContractNotAllowed",
      );
    });

    it("should remove all executors correctly", async function () {
      await safeGuard.connect(safeWallet).removeExecutor(executor1.address);
      await safeGuard.connect(safeWallet).removeExecutor(executor2.address);

      const executors = await safeGuard.executors(safeWallet.address);
      expect(executors.length).to.equal(0);
    });
  });

  describe("executors", function () {
    it("should return empty array for non-existent account", async function () {
      const executors = await safeGuard.executors(owner.address);
      expect(executors).to.deep.equal([]);
    });

    it("should return correct executors list", async function () {
      await safeGuard.connect(safeWallet).addExecutor(executor1.address);
      await safeGuard.connect(safeWallet).addExecutor(executor2.address);

      const executors = await safeGuard.executors(safeWallet.address);
      expect(executors).to.include(executor1.address);
      expect(executors).to.include(executor2.address);
      expect(executors.length).to.equal(2);
    });

    it("should maintain order of executors", async function () {
      await safeGuard.connect(safeWallet).addExecutor(executor1.address);
      await safeGuard.connect(safeWallet).addExecutor(executor2.address);
      await safeGuard.connect(safeWallet).addExecutor(executor3.address);

      const executors = await safeGuard.executors(safeWallet.address);
      expect(executors[0]).to.equal(executor1.address);
      expect(executors[1]).to.equal(executor2.address);
      expect(executors[2]).to.equal(executor3.address);
    });
  });

  describe("checkTransaction", function () {
    beforeEach(async function () {
      await safeGuard.connect(safeWallet).addExecutor(executor1.address);
      await safeGuard.connect(safeWallet).addExecutor(executor2.address);
    });

    it("should pass when msgSender is in executors list", async function () {
      await safeGuard.connect(safeWallet).checkTransaction(...zeroTx, executor1.address);
    });

    it("should pass when msgSender is another executor in the list", async function () {
      await safeGuard.connect(safeWallet).checkTransaction(...zeroTx, executor2.address);
    });

    it("should revert when msgSender is not in executors list", async function () {
      await expect(
        safeGuard.connect(safeWallet).checkTransaction(
          ...zeroTx,
          nonExecutor.address, // msgSender
        ),
      )
        .to.be.revertedWithCustomError(safeGuard, "NotExecutor")
        .withArgs(nonExecutor.address);
    });

    it("should pass when account has no executors (empty list)", async function () {
      const newSafe = await createFakeSafe("0x9876543210987654321098765432109876543210");
      await safeGuard.connect(newSafe).checkTransaction(...zeroTx, executor1.address);
    });

    it("should revert when msgSender is zero address and not in list", async function () {
      await expect(safeGuard.connect(safeWallet).checkTransaction(...zeroTx, zeroAddress))
        .to.be.revertedWithCustomError(safeGuard, "NotExecutor")
        .withArgs(zeroAddress);
    });

    it("should work correctly after removing an executor", async function () {
      await safeGuard.connect(safeWallet).removeExecutor(executor1.address);

      await expect(safeGuard.connect(safeWallet).checkTransaction(...zeroTx, executor1.address))
        .to.be.revertedWithCustomError(safeGuard, "NotExecutor")
        .withArgs(executor1.address);

      await safeGuard.connect(safeWallet).checkTransaction(...zeroTx, executor2.address);
    });
  });

  describe("addAuditors", async function () {
    it("should add auditors successfully", async function () {
      const auditorsList = [auditor1.address, auditor2.address, auditor3.address];

      await expect(safeGuard.connect(safeWallet).addAuditors(auditorsList))
        .to.emit(safeGuard, "AuditorAdded")
        .withArgs(safeWallet.address, auditor1.address)
        .and.to.emit(safeGuard, "AuditorAdded")
        .withArgs(safeWallet.address, auditor2.address)
        .and.to.emit(safeGuard, "AuditorAdded")
        .withArgs(safeWallet.address, auditor3.address);

      const executors = await safeGuard.auditors(safeWallet.address);
      expect(executors).to.include(auditor1.address);
      expect(executors).to.include(auditor2.address);
      expect(executors).to.include(auditor3.address);
      expect(executors.length).to.equal(3);
    });

    it("should revert when adding empty auditors list", async function () {
      await expect(safeGuard.connect(safeWallet).addAuditors([])).to.be.revertedWithCustomError(
        safeGuard,
        "InvalidLength",
      );
    });

    it("should revert when adding auditors with zero address", async function () {
      const auditorsList = [auditor1.address, zeroAddress, auditor2.address];

      await expect(safeGuard.connect(safeWallet).addAuditors(auditorsList)).to.be.revertedWithCustomError(
        safeGuard,
        "ZeroAddress",
      );
    });

    it("should revert when adding auditors with duplicate", async function () {
      const auditorsList = [auditor1.address, auditor1.address, auditor2.address];

      await expect(safeGuard.connect(safeWallet).addAuditors(auditorsList))
        .to.be.revertedWithCustomError(safeGuard, "AuditorExists")
        .withArgs(auditor1.address);
    });
  });

  describe("addAuditor", async function () {
    it("should add a single auditor successfully", async function () {
      await expect(safeGuard.connect(safeWallet).addAuditor(auditor1.address))
        .to.emit(safeGuard, "AuditorAdded")
        .withArgs(safeWallet.address, auditor1.address);

      const auditors = await safeGuard.auditors(safeWallet.address);
      expect(auditors).to.include(auditor1.address);
      expect(auditors.length).to.equal(1);
    });

    it("should revert when adding zero address as auditor", async function () {
      await expect(safeGuard.connect(safeWallet).addAuditor(zeroAddress)).to.be.revertedWithCustomError(
        safeGuard,
        "ZeroAddress",
      );
    });

    it("should revert when adding duplicate auditor", async function () {
      await safeGuard.connect(safeWallet).addAuditor(auditor1.address);

      await expect(safeGuard.connect(safeWallet).addAuditor(auditor1.address))
        .to.be.revertedWithCustomError(safeGuard, "AuditorExists")
        .withArgs(auditor1.address);
    });

    it("should revert when called by EOA", async function () {
      await expect(safeGuard.connect(owner).addAuditor(auditor1.address)).to.be.revertedWithCustomError(
        safeGuard,
        "ContractNotAllowed",
      );
    });
  });

  describe("removeAuditor", async function () {
    beforeEach(async function () {
      await safeGuard.connect(safeWallet).addAuditor(auditor1.address);
      await safeGuard.connect(safeWallet).addAuditor(auditor2.address);
    });

    it("should remove auditor successfully", async function () {
      await expect(safeGuard.connect(safeWallet).removeAuditor(auditor1.address))
        .to.emit(safeGuard, "AuditorRemoved")
        .withArgs(safeWallet.address, auditor1.address);

      const auditors = await safeGuard.auditors(safeWallet.address);
      expect(auditors).to.not.include(auditor1.address);
      expect(auditors).to.include(auditor2.address);
      expect(auditors.length).to.equal(1);
    });

    it("should revert when removing zero address as auditor", async function () {
      await expect(safeGuard.connect(safeWallet).removeAuditor(zeroAddress)).to.be.revertedWithCustomError(
        safeGuard,
        "ZeroAddress",
      );
    });

    it("should revert when removing non-existent auditor", async function () {
      await expect(safeGuard.connect(safeWallet).removeAuditor(auditor3.address))
        .to.be.revertedWithCustomError(safeGuard, "AuditorDoesNotExist")
        .withArgs(auditor3.address);
    });

    it("should revert when called by EOA", async function () {
      await expect(safeGuard.connect(owner).removeAuditor(auditor1.address)).to.be.revertedWithCustomError(
        safeGuard,
        "ContractNotAllowed",
      );
    });

    it("should remove all auditors correctly", async function () {
      await safeGuard.connect(safeWallet).removeAuditor(auditor1.address);
      await safeGuard.connect(safeWallet).removeAuditor(auditor2.address);

      const auditors = await safeGuard.auditors(safeWallet.address);
      expect(auditors.length).to.equal(0);
    });
  });

  describe("addMessageHash", async function () {
    beforeEach(async function () {
      await impersonateAccount(safeWalletFake.address);
      await setBalance(safeWalletFake.address, parseEther("2"));
      const signer = await ethers.getSigner(safeWalletFake.address);
      await safeGuard.connect(signer).addAuditor(auditor1.address);
    });

    it("should add message hash successfully", async function () {
      const messageHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test message"));
      await expect(safeGuard.connect(auditor1).addMessageHash(safeWalletFake.address, 1, messageHash))
        .to.emit(safeGuard, "MessageHashAdded")
        .withArgs(safeWalletFake.address, 1, messageHash);
    });

    it("should revert when adding message hash by non-auditor", async function () {
      const messageHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test message"));
      await expect(
        safeGuard.connect(executor1).addMessageHash(safeWalletFake.address, 1, messageHash),
      ).to.be.revertedWithCustomError(safeGuard, "AuditorNotAllowed");
    });
  });

  describe("addMessageHashs", async function () {
    beforeEach(async function () {
      await impersonateAccount(safeWalletFake.address);
      await setBalance(safeWalletFake.address, parseEther("2"));
      const signer = await ethers.getSigner(safeWalletFake.address);
      await safeGuard.connect(signer).addAuditor(auditor1.address);
    });

    it("should add multiple message hashes successfully", async function () {
      const messageHashes = [
        ethers.utils.keccak256(ethers.utils.toUtf8Bytes("message 1")),
        ethers.utils.keccak256(ethers.utils.toUtf8Bytes("message 2")),
      ];
      const nonces = [1, 2];

      await expect(safeGuard.connect(auditor1).addMessageHashes(safeWalletFake.address, nonces, messageHashes))
        .to.emit(safeGuard, "MessageHashAdded")
        .withArgs(safeWalletFake.address, 1, messageHashes[0])
        .and.to.emit(safeGuard, "MessageHashAdded")
        .withArgs(safeWalletFake.address, 2, messageHashes[1]);
    });

    it("should revert when adding multiple message hashes by non-auditor", async function () {
      const messageHashes = [
        ethers.utils.keccak256(ethers.utils.toUtf8Bytes("message 1")),
        ethers.utils.keccak256(ethers.utils.toUtf8Bytes("message 2")),
      ];
      const nonces = [1, 2];

      await expect(
        safeGuard.connect(executor1).addMessageHashes(safeWalletFake.address, nonces, messageHashes),
      ).to.be.revertedWithCustomError(safeGuard, "AuditorNotAllowed");
    });
  });

  describe("checkAfterExecution", function () {
    it("should not revert (no-op function)", async function () {
      // This should not revert
      await safeGuard.checkAfterExecution(zeroBytes32, true);
      await safeGuard.checkAfterExecution(zeroBytes32, false);
    });
  });

  describe("fallback", function () {
    it("should not revert on fallback call", async function () {
      await owner.sendTransaction({
        to: safeGuard.address,
        data: "0x12345678",
      });
    });
  });

  describe("Edge cases and integration", function () {
    it("should handle large number of executors", async function () {
      const signers = await ethers.getSigners();
      const executorAddresses = signers.slice(0, 10).map(signer => signer.address);

      await safeGuard.connect(safeWallet).addExecutors(executorAddresses);

      const executors = await safeGuard.executors(safeWallet.address);
      expect(executors.length).to.equal(10);

      for (const address of executorAddresses) {
        expect(executors).to.include(address);
      }
    });

    it("should handle adding and removing executors in sequence", async function () {
      await safeGuard.connect(safeWallet).addExecutor(executor1.address);
      await safeGuard.connect(safeWallet).addExecutor(executor2.address);
      await safeGuard.connect(safeWallet).removeExecutor(executor1.address);
      await safeGuard.connect(safeWallet).addExecutor(executor3.address);
      await safeGuard.connect(safeWallet).removeExecutor(executor2.address);
      await safeGuard.connect(safeWallet).addExecutor(executor1.address);

      const executors = await safeGuard.executors(safeWallet.address);
      expect(executors).to.include(executor1.address);
      expect(executors).to.include(executor3.address);
      expect(executors).to.not.include(executor2.address);
      expect(executors.length).to.equal(2);
    });

    it("should maintain separate executor lists for different accounts", async function () {
      const safeWallet2Address = "0x5555555555555555555555555555555555555555";
      await ethers.provider.send("hardhat_impersonateAccount", [safeWallet2Address]);
      await ethers.provider.send("hardhat_setCode", [safeWallet2Address, "0x1234"]);
      await setBalance(safeWallet2Address, parseEther("2"));
      const safeWallet2 = await ethers.getSigner(safeWallet2Address);

      await safeGuard.connect(safeWallet).addExecutor(executor1.address);
      await safeGuard.connect(safeWallet2).addExecutor(executor2.address);

      const executors1 = await safeGuard.executors(safeWallet.address);
      const executors2 = await safeGuard.executors(safeWallet2.address);

      expect(executors1).to.include(executor1.address);
      expect(executors1).to.not.include(executor2.address);
      expect(executors2).to.include(executor2.address);
      expect(executors2).to.not.include(executor1.address);
    });

    it("should handle checkTransaction for different accounts correctly", async function () {
      const safeWallet2Address = "0x6666666666666666666666666666666666666666";
      await ethers.provider.send("hardhat_impersonateAccount", [safeWallet2Address]);
      await ethers.provider.send("hardhat_setCode", [safeWallet2Address, "0x1234"]);
      await setBalance(safeWallet2Address, parseEther("2"));
      const safeWallet2 = await ethers.getSigner(safeWallet2Address);

      await safeGuard.connect(safeWallet).addExecutor(executor1.address);
      await safeGuard.connect(safeWallet2).addExecutor(executor2.address);

      await safeGuard.connect(safeWallet).checkTransaction(...zeroTx, executor1.address);

      await safeGuard.connect(safeWallet2).checkTransaction(...zeroTx, executor2.address);
    });
  });
});
