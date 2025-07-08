// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import { BaseGuard } from "@safe-global/safe-contracts/contracts/base/GuardManager.sol";
import { Enum } from "@safe-global/safe-contracts/contracts/common/Enum.sol";
import { ensureNonzeroAddress } from "@venusprotocol/solidity-utilities/contracts/validators.sol";

/**
 * @title ExecutorsGuard
 * @notice A Safe Guard contract that restricts transaction execution to a whitelisted set of executors
 */
contract ExecutorsGuard is BaseGuard {
    using EnumerableSet for EnumerableSet.AddressSet;

    /// @notice Mapping from Safe wallet address to its set of authorized executors
    mapping(address => EnumerableSet.AddressSet) private _executors;

    /// @notice Emitted when an executor is added to a Safe's executor list
    /// @param account The Safe wallet address that added the executor
    /// @param executor The address of the executor being added
    event ExecutorAdded(address indexed account, address indexed executor);

    /// @notice Emitted when an executor is removed from a Safe's executor list
    /// @param account The Safe wallet address that removed the executor
    /// @param executor The address of the executor being removed
    event ExecutorRemoved(address indexed account, address indexed executor);

    /// @notice Error thrown when attempting to add an empty list of executors
    error EmptyList();

    /// @notice Error thrown when attempting to add an executor that already exists
    /// @param executor The address of the executor that already exists
    error ExecutorExists(address executor);

    /// @notice Error thrown when attempting to remove an executor that doesn't exist
    /// @param executor The address of the executor that doesn't exist
    error ExecutorDoesNotExist(address executor);

    /// @notice Error thrown when a transaction is executed by an unauthorized account
    /// @param msgSender The address of the unauthorized executor
    error NotExecutor(address msgSender);

    /// @notice Error thrown when a function is called by an EOA instead of a contract
    error ContractNotAllowed();

    /// @notice Modifier that ensures only contracts can call the function
    /// @dev This prevents EOAs from directly managing executor lists, ensuring only Safe wallets
    ///      can add/remove their executors
    modifier onlyContract() {
        if (!_isContract(msg.sender)) {
            revert ContractNotAllowed();
        }
        _;
    }

    /// @notice Fallback function that accepts any call without reverting
    // solhint-disable-next-line payable-fallback
    fallback() external {
        // We don't revert on fallback to avoid issues in case of a Safe upgrade
        // E.g. The expected check method might change and then the Safe would be locked.
    }

    /// @notice Adds multiple executors to the calling Safe's executor list
    /// @param executorsList Array of executor addresses to add
    /// @dev This function can only be called by contracts (Safe wallets)
    function addExecutors(address[] calldata executorsList) external onlyContract {
        if (executorsList.length == 0) {
            revert EmptyList();
        }
        address account = msg.sender;
        EnumerableSet.AddressSet storage exe = _executors[account];
        for (uint256 i; i < executorsList.length; i++) {
            ensureNonzeroAddress(executorsList[i]);
            if (!exe.add(executorsList[i])) {
                revert ExecutorExists(executorsList[i]);
            }
            emit ExecutorAdded(account, executorsList[i]);
        }
    }

    /// @notice Adds a single executor to the calling Safe's executor list
    /// @param executor The address of the executor to add
    /// @dev This function can only be called by contracts (Safe wallets)
    function addExecutor(address executor) external onlyContract {
        ensureNonzeroAddress(executor);
        address account = msg.sender;
        EnumerableSet.AddressSet storage exe = _executors[account];
        if (!exe.add(executor)) {
            revert ExecutorExists(executor);
        }
        emit ExecutorAdded(account, executor);
    }

    /// @notice Removes a single executor from the calling Safe's executor list
    /// @param executor The address of the executor to remove
    /// @dev This function can only be called by contracts (Safe wallets)
    function removeExecutor(address executor) external onlyContract {
        ensureNonzeroAddress(executor);
        address account = msg.sender;
        EnumerableSet.AddressSet storage exe = _executors[account];
        if (!exe.remove(executor)) {
            revert ExecutorDoesNotExist(executor);
        }
        emit ExecutorRemoved(account, executor);
    }

    /// @notice Returns the list of executors for a given Safe wallet
    /// @param vault The address of the Safe wallet
    /// @return executorsArray Array of executor addresses for the specified Safe
    function executors(address vault) external view returns (address[] memory executorsArray) {
        return _executors[vault].values();
    }

    /// @notice Called by the Safe contract before a transaction is executed
    /// @dev This function validates that the msgSender (the account executing the transaction)
    ///      is authorized to execute transactions for the calling Safe. The validation logic:
    ///      - If the Safe has no executors configured (empty list), any transaction is allowed
    ///      - If the Safe has executors configured, only those executors can execute transactions
    ///      - Reverts with NotExecutor error if the msgSender is not in the executors list
    /// @param msgSender The address of the account executing the transaction
    function checkTransaction(
        address,
        uint256,
        bytes memory,
        Enum.Operation,
        uint256,
        uint256,
        uint256,
        address,
        address payable,
        bytes memory,
        address msgSender
    ) external view override {
        uint256 executorsLength = _executors[msg.sender].length();
        if (executorsLength != 0) {
            if (!_executors[msg.sender].contains(msgSender)) {
                revert NotExecutor(msgSender);
            }
        }
    }

    /**
     * @notice Called by the Safe contract after a transaction is executed.
     * @dev No-op.
     */
    // solhint-disable-next-line no-empty-blocks
    function checkAfterExecution(bytes32, bool) external view override {}

    /// @dev Internal function to check if an address has bytecode
    /// @param addr The address to check
    /// @return True if the address is a contract (has bytecode), false otherwise
    function _isContract(address addr) internal view returns (bool) {
        uint256 size;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            size := extcodesize(addr)
        }
        return size > 0;
    }
}
