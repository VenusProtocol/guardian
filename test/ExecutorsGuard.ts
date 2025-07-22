// import { impersonateAccount, setBalance } from "@nomicfoundation/hardhat-network-helpers";
// import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
// import { expect } from "chai";
// import { parseEther } from "ethers/lib/utils";
// import { ethers } from "hardhat";

// import { ExecutorsGuard, ExecutorsGuard__factory } from "../typechain";

// const createFakeSafe = async (address: string): Promise<SignerWithAddress> => {
//   await impersonateAccount(address);
//   await setBalance(address, parseEther("2"));
//   await ethers.provider.send("hardhat_setCode", [address, "0x1234"]);
//   return await ethers.getSigner(address);
// };

// describe("ExecutorsGuard", function () {
//   const zeroAddress = ethers.constants.AddressZero;
//   const zeroBytes32 = ethers.constants.HashZero;
//   const zeroTx = [zeroAddress, 0, "0x", 0, 0, 0, 0, zeroAddress, zeroAddress, "0x"] as const;
//   let executorsGuard: ExecutorsGuard;
//   let owner: SignerWithAddress;
//   let executor1: SignerWithAddress;
//   let executor2: SignerWithAddress;
//   let executor3: SignerWithAddress;
//   let nonExecutor: SignerWithAddress;
//   let safeWallet: SignerWithAddress;

//   beforeEach(async function () {
//     [owner, executor1, executor2, executor3, nonExecutor] = await ethers.getSigners();
//     const executorsGuardFactory = new ExecutorsGuard__factory(owner);
//     executorsGuard = await executorsGuardFactory.deploy();
//     safeWallet = await createFakeSafe("0x1234567890123456789012345678901234567890");
//   });

//   describe("addExecutor", function () {
//     it("should add a single executor successfully", async function () {
//       await expect(executorsGuard.connect(safeWallet).addExecutor(executor1.address))
//         .to.emit(executorsGuard, "ExecutorAdded")
//         .withArgs(safeWallet.address, executor1.address);

//       const executors = await executorsGuard.executors(safeWallet.address);
//       expect(executors).to.include(executor1.address);
//       expect(executors.length).to.equal(1);
//     });

//     it("should revert when adding zero address", async function () {
//       await expect(executorsGuard.connect(safeWallet).addExecutor(zeroAddress)).to.be.revertedWithCustomError(
//         executorsGuard,
//         "ZeroAddressNotAllowed",
//       );
//     });

//     it("should revert when adding duplicate executor", async function () {
//       await executorsGuard.connect(safeWallet).addExecutor(executor1.address);

//       await expect(executorsGuard.connect(safeWallet).addExecutor(executor1.address))
//         .to.be.revertedWithCustomError(executorsGuard, "ExecutorExists")
//         .withArgs(executor1.address);
//     });

//     it("should revert when called by EOA", async function () {
//       await expect(executorsGuard.connect(owner).addExecutor(executor1.address)).to.be.revertedWithCustomError(
//         executorsGuard,
//         "ContractNotAllowed",
//       );
//     });

//     it("should add multiple executors correctly", async function () {
//       await executorsGuard.connect(safeWallet).addExecutor(executor1.address);
//       await executorsGuard.connect(safeWallet).addExecutor(executor2.address);
//       await executorsGuard.connect(safeWallet).addExecutor(executor3.address);

//       const executors = await executorsGuard.executors(safeWallet.address);
//       expect(executors).to.include(executor1.address);
//       expect(executors).to.include(executor2.address);
//       expect(executors).to.include(executor3.address);
//       expect(executors.length).to.equal(3);
//     });
//   });

//   describe("addExecutors", function () {
//     it("should add multiple executors successfully", async function () {
//       const executorsList = [executor1.address, executor2.address, executor3.address];

//       await expect(executorsGuard.connect(safeWallet).addExecutors(executorsList))
//         .to.emit(executorsGuard, "ExecutorAdded")
//         .withArgs(safeWallet.address, executor1.address)
//         .and.to.emit(executorsGuard, "ExecutorAdded")
//         .withArgs(safeWallet.address, executor2.address)
//         .and.to.emit(executorsGuard, "ExecutorAdded")
//         .withArgs(safeWallet.address, executor3.address);

//       const executors = await executorsGuard.executors(safeWallet.address);
//       expect(executors).to.include(executor1.address);
//       expect(executors).to.include(executor2.address);
//       expect(executors).to.include(executor3.address);
//       expect(executors.length).to.equal(3);
//     });

//     it("should revert when adding empty list", async function () {
//       await expect(executorsGuard.connect(safeWallet).addExecutors([])).to.be.revertedWithCustomError(
//         executorsGuard,
//         "EmptyList",
//       );
//     });

//     it("should revert when adding list with zero address", async function () {
//       const executorsList = [executor1.address, zeroAddress, executor2.address];

//       await expect(executorsGuard.connect(safeWallet).addExecutors(executorsList)).to.be.revertedWithCustomError(
//         executorsGuard,
//         "ZeroAddressNotAllowed",
//       );
//     });

//     it("should revert when adding list with duplicate", async function () {
//       const executorsList = [executor1.address, executor1.address, executor2.address];

//       await expect(executorsGuard.connect(safeWallet).addExecutors(executorsList))
//         .to.be.revertedWithCustomError(executorsGuard, "ExecutorExists")
//         .withArgs(executor1.address);
//     });

//     it("should revert when called by EOA", async function () {
//       const executorsList = [executor1.address, executor2.address];

//       await expect(executorsGuard.connect(owner).addExecutors(executorsList)).to.be.revertedWithCustomError(
//         executorsGuard,
//         "ContractNotAllowed",
//       );
//     });
//   });

//   describe("removeExecutor", function () {
//     beforeEach(async function () {
//       await executorsGuard.connect(safeWallet).addExecutor(executor1.address);
//       await executorsGuard.connect(safeWallet).addExecutor(executor2.address);
//     });

//     it("should remove executor successfully", async function () {
//       await expect(executorsGuard.connect(safeWallet).removeExecutor(executor1.address))
//         .to.emit(executorsGuard, "ExecutorRemoved")
//         .withArgs(safeWallet.address, executor1.address);

//       const executors = await executorsGuard.executors(safeWallet.address);
//       expect(executors).to.not.include(executor1.address);
//       expect(executors).to.include(executor2.address);
//       expect(executors.length).to.equal(1);
//     });

//     it("should revert when removing zero address", async function () {
//       await expect(executorsGuard.connect(safeWallet).removeExecutor(zeroAddress)).to.be.revertedWithCustomError(
//         executorsGuard,
//         "ZeroAddressNotAllowed",
//       );
//     });

//     it("should revert when removing non-existent executor", async function () {
//       await expect(executorsGuard.connect(safeWallet).removeExecutor(executor3.address))
//         .to.be.revertedWithCustomError(executorsGuard, "ExecutorDoesNotExist")
//         .withArgs(executor3.address);
//     });

//     it("should revert when called by EOA", async function () {
//       await expect(executorsGuard.connect(owner).removeExecutor(executor1.address)).to.be.revertedWithCustomError(
//         executorsGuard,
//         "ContractNotAllowed",
//       );
//     });

//     it("should remove all executors correctly", async function () {
//       await executorsGuard.connect(safeWallet).removeExecutor(executor1.address);
//       await executorsGuard.connect(safeWallet).removeExecutor(executor2.address);

//       const executors = await executorsGuard.executors(safeWallet.address);
//       expect(executors.length).to.equal(0);
//     });
//   });

//   describe("executors", function () {
//     it("should return empty array for non-existent account", async function () {
//       const executors = await executorsGuard.executors(owner.address);
//       expect(executors).to.deep.equal([]);
//     });

//     it("should return correct executors list", async function () {
//       await executorsGuard.connect(safeWallet).addExecutor(executor1.address);
//       await executorsGuard.connect(safeWallet).addExecutor(executor2.address);

//       const executors = await executorsGuard.executors(safeWallet.address);
//       expect(executors).to.include(executor1.address);
//       expect(executors).to.include(executor2.address);
//       expect(executors.length).to.equal(2);
//     });

//     it("should maintain order of executors", async function () {
//       await executorsGuard.connect(safeWallet).addExecutor(executor1.address);
//       await executorsGuard.connect(safeWallet).addExecutor(executor2.address);
//       await executorsGuard.connect(safeWallet).addExecutor(executor3.address);

//       const executors = await executorsGuard.executors(safeWallet.address);
//       expect(executors[0]).to.equal(executor1.address);
//       expect(executors[1]).to.equal(executor2.address);
//       expect(executors[2]).to.equal(executor3.address);
//     });
//   });

//   describe("checkTransaction", function () {
//     beforeEach(async function () {
//       await executorsGuard.connect(safeWallet).addExecutor(executor1.address);
//       await executorsGuard.connect(safeWallet).addExecutor(executor2.address);
//     });

//     it("should pass when msgSender is in executors list", async function () {
//       await executorsGuard.connect(safeWallet).checkTransaction(...zeroTx, executor1.address);
//     });

//     it("should pass when msgSender is another executor in the list", async function () {
//       await executorsGuard.connect(safeWallet).checkTransaction(...zeroTx, executor2.address);
//     });

//     it("should revert when msgSender is not in executors list", async function () {
//       await expect(
//         executorsGuard.connect(safeWallet).checkTransaction(
//           ...zeroTx,
//           nonExecutor.address, // msgSender
//         ),
//       )
//         .to.be.revertedWithCustomError(executorsGuard, "NotExecutor")
//         .withArgs(nonExecutor.address);
//     });

//     it("should pass when account has no executors (empty list)", async function () {
//       const newSafe = await createFakeSafe("0x9876543210987654321098765432109876543210");
//       await executorsGuard.connect(newSafe).checkTransaction(...zeroTx, executor1.address);
//     });

//     it("should revert when msgSender is zero address and not in list", async function () {
//       await expect(executorsGuard.connect(safeWallet).checkTransaction(...zeroTx, zeroAddress))
//         .to.be.revertedWithCustomError(executorsGuard, "NotExecutor")
//         .withArgs(zeroAddress);
//     });

//     it("should work correctly after removing an executor", async function () {
//       await executorsGuard.connect(safeWallet).removeExecutor(executor1.address);

//       await expect(executorsGuard.connect(safeWallet).checkTransaction(...zeroTx, executor1.address))
//         .to.be.revertedWithCustomError(executorsGuard, "NotExecutor")
//         .withArgs(executor1.address);

//       await executorsGuard.connect(safeWallet).checkTransaction(...zeroTx, executor2.address);
//     });
//   });

//   describe("checkAfterExecution", function () {
//     it("should not revert (no-op function)", async function () {
//       // This should not revert
//       await executorsGuard.checkAfterExecution(zeroBytes32, true);
//       await executorsGuard.checkAfterExecution(zeroBytes32, false);
//     });
//   });

//   describe("fallback", function () {
//     it("should not revert on fallback call", async function () {
//       await owner.sendTransaction({
//         to: executorsGuard.address,
//         data: "0x12345678",
//       });
//     });
//   });

//   describe("Edge cases and integration", function () {
//     it("should handle large number of executors", async function () {
//       const signers = await ethers.getSigners();
//       const executorAddresses = signers.slice(0, 10).map(signer => signer.address);

//       await executorsGuard.connect(safeWallet).addExecutors(executorAddresses);

//       const executors = await executorsGuard.executors(safeWallet.address);
//       expect(executors.length).to.equal(10);

//       for (const address of executorAddresses) {
//         expect(executors).to.include(address);
//       }
//     });

//     it("should handle adding and removing executors in sequence", async function () {
//       await executorsGuard.connect(safeWallet).addExecutor(executor1.address);
//       await executorsGuard.connect(safeWallet).addExecutor(executor2.address);
//       await executorsGuard.connect(safeWallet).removeExecutor(executor1.address);
//       await executorsGuard.connect(safeWallet).addExecutor(executor3.address);
//       await executorsGuard.connect(safeWallet).removeExecutor(executor2.address);
//       await executorsGuard.connect(safeWallet).addExecutor(executor1.address);

//       const executors = await executorsGuard.executors(safeWallet.address);
//       expect(executors).to.include(executor1.address);
//       expect(executors).to.include(executor3.address);
//       expect(executors).to.not.include(executor2.address);
//       expect(executors.length).to.equal(2);
//     });

//     it("should maintain separate executor lists for different accounts", async function () {
//       const safeWallet2Address = "0x5555555555555555555555555555555555555555";
//       await ethers.provider.send("hardhat_impersonateAccount", [safeWallet2Address]);
//       await ethers.provider.send("hardhat_setCode", [safeWallet2Address, "0x1234"]);
//       await setBalance(safeWallet2Address, parseEther("2"));
//       const safeWallet2 = await ethers.getSigner(safeWallet2Address);

//       await executorsGuard.connect(safeWallet).addExecutor(executor1.address);
//       await executorsGuard.connect(safeWallet2).addExecutor(executor2.address);

//       const executors1 = await executorsGuard.executors(safeWallet.address);
//       const executors2 = await executorsGuard.executors(safeWallet2.address);

//       expect(executors1).to.include(executor1.address);
//       expect(executors1).to.not.include(executor2.address);
//       expect(executors2).to.include(executor2.address);
//       expect(executors2).to.not.include(executor1.address);
//     });

//     it("should handle checkTransaction for different accounts correctly", async function () {
//       const safeWallet2Address = "0x6666666666666666666666666666666666666666";
//       await ethers.provider.send("hardhat_impersonateAccount", [safeWallet2Address]);
//       await ethers.provider.send("hardhat_setCode", [safeWallet2Address, "0x1234"]);
//       await setBalance(safeWallet2Address, parseEther("2"));
//       const safeWallet2 = await ethers.getSigner(safeWallet2Address);

//       await executorsGuard.connect(safeWallet).addExecutor(executor1.address);
//       await executorsGuard.connect(safeWallet2).addExecutor(executor2.address);

//       await executorsGuard.connect(safeWallet).checkTransaction(...zeroTx, executor1.address);

//       await executorsGuard.connect(safeWallet2).checkTransaction(...zeroTx, executor2.address);
//     });
//   });
// });
