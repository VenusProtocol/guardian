// SPDX-License-Identifier: LGPL-3.0-only
/* solhint-disable one-contract-per-file */
pragma solidity 0.8.25;

import { BaseGuard } from "@safe-global/safe-contracts/contracts/base/GuardManager.sol";
import { ISafe } from "./interfaces/ISafe.sol";
import { Enum } from "@safe-global/safe-contracts/contracts/common/Enum.sol";
import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

/**
 * @title SafeGuard - Allow message hash submission and executor whitelist.
 * @author Venus
 */
contract SafeGuard is BaseGuard {
    using EnumerableSet for EnumerableSet.AddressSet;

    // keccak256(
    //     "SafeTx(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address refundReceiver,uint256 nonce)"
    // );
    bytes32 private constant SAFE_TX_TYPEHASH = 0xbb8310d486368db6bd6f849402fdd73ad53d316b5a4b2644ad6efe0f941286d8;

    /// @notice Mapping from Safe wallet address to its set of authorized executors
    mapping(address => EnumerableSet.AddressSet) private _executors;

    /// @notice Mapping from Safe wallet address to its set of authorized auditors
    mapping(address => EnumerableSet.AddressSet) private _auditors;

    /// @notice Mapping from Safe wallet address and nonce to the message hash
    mapping(address => mapping(uint256 => bytes32)) public messagehash;

    /// @notice Emitted when an executor is added to a Safe's executor list
    event ExecutorAdded(address indexed account, address indexed executor);

    /// @notice Emitted when an executor is removed from a Safe's executor list
    event ExecutorRemoved(address indexed account, address indexed executor);

    /// @notice Emitted when an auditor is added to a Safe's auditor list
    event AuditorAdded(address indexed account, address indexed auditor);

    /// @notice Emitted when an auditor is removed from a Safe's auditor list
    event AuditorRemoved(address indexed account, address indexed auditor);

    /// @notice Emitted when a message hash is added for a Safe wallet and nonce
    event MessageHashAdded(address indexed account, uint256 nonce, bytes32 hash);

    /// @notice Emitted when a Safe transaction is executed
    event SafeTxData(
        address to,
        uint256 value,
        bytes data,
        uint8 operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address refundReceiver,
        uint256 nonce,
        bytes32 messagehash
    );

    /// @notice Error thrown when an address is zero
    error ZeroAddress();

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

    /// @notice Error thrown when a function is called by an EOA instead of an auditor
    error AuditorNotAllowed();

    /// @notice Error thrown when input array length is zero or two array lengths are not equal
    error InvalidLength();

    /// @notice Error thrown when an auditor already exists
    error AuditorExists(address auditor);

    /// @notice Error thrown when an auditor does not exist
    error AuditorDoesNotExist(address auditor);

    /// @notice Error thrown when a message hash is invalid
    error InvalidHash();

    /// @notice Error thrown when a message hash is zero
    error ZeroHash();

    /// @notice Error thrown when a nonce is invalid
    error InvalidNonce();

    /**
     * @notice Modifier that ensures only contracts can call the function
     */
    modifier onlyContract() {
        if (!_isContract(msg.sender)) {
            revert ContractNotAllowed();
        }
        _;
    }

    /**
     * @notice Modifier that ensures only auditors can call the function
     * @param _vault The address of the Safe wallet
     */
    modifier onlyAuditor(address _vault) {
        if (!_auditors[_vault].contains(msg.sender)) {
            revert AuditorNotAllowed();
        }
        _;
    }

    // solhint-disable-next-line payable-fallback
    fallback() external {
        // We don't revert on fallback to avoid issues in case of a Safe upgrade
        // E.g. The expected check method might change and then the Safe would be locked.
    }

    /**
     * @notice Adds a message hash for a specific Safe wallet and nonce
     * @param _vault The address of the Safe wallet
     * @param _nonce The nonce for the transaction
     * @param _hash The message hash to add
     */
    function addMessageHash(address _vault, uint256 _nonce, bytes32 _hash) external onlyAuditor(_vault) {
        _addMessageHash(_vault, _nonce, _hash);
    }

    /**
     * @notice Adds multiple message hashes for a specific Safe wallet
     * @param _vault The address of the Safe wallet
     * @param _nonce_list Array of nonces for the transactions
     * @param _hash_list Array of message hashes to add
     */
    function addMessageHashes(
        address _vault,
        uint256[] memory _nonce_list,
        bytes32[] memory _hash_list
    ) external onlyAuditor(_vault) {
        if (_nonce_list.length == 0 || _hash_list.length == 0) {
            revert InvalidLength();
        }
        for (uint256 i = 0; i < _nonce_list.length; ++i) {
            _addMessageHash(_vault, _nonce_list[i], _hash_list[i]);
        }
    }

    /**
     * @notice Adds multiple executors to the calling Safe's executor list
     * @param _executorsList Array of executor addresses to add
     * @dev This function can only be called by contracts (Safe wallets)
     */
    function addExecutors(address[] calldata _executorsList) external onlyContract {
        if (_executorsList.length == 0) {
            revert InvalidLength();
        }
        address _account = msg.sender;
        EnumerableSet.AddressSet storage exe = _executors[_account];
        for (uint256 i; i < _executorsList.length; i++) {
            if (_executorsList[i] == address(0)) {
                revert ZeroAddress();
            }
            if (!exe.add(_executorsList[i])) {
                revert ExecutorExists(_executorsList[i]);
            }
            emit ExecutorAdded(_account, _executorsList[i]);
        }
    }

    /**
     * @notice Adds multiple auditors to the calling Safe's auditor list
     * @param _auditorsList Array of auditor addresses to add
     * @dev This function can only be called by contracts (Safe wallets)
     */
    function addAuditors(address[] calldata _auditorsList) external onlyContract {
        if (_auditorsList.length == 0) {
            revert InvalidLength();
        }
        address _account = msg.sender;
        EnumerableSet.AddressSet storage axe = _auditors[_account];
        for (uint256 i; i < _auditorsList.length; i++) {
            if (_auditorsList[i] == address(0)) {
                revert ZeroAddress();
            }
            if (!axe.add(_auditorsList[i])) {
                revert AuditorExists(_auditorsList[i]);
            }
            emit AuditorAdded(_account, _auditorsList[i]);
        }
    }

    /**
     * @notice Adds a single executor to the calling Safe's executor list
     * @param _executor The address of the executor to add
     * @dev This function can only be called by contracts (Safe wallets)
     */
    function addExecutor(address _executor) external onlyContract {
        if (_executor == address(0)) {
            revert ZeroAddress();
        }
        address _account = msg.sender;
        EnumerableSet.AddressSet storage exe = _executors[_account];
        if (!exe.add(_executor)) {
            revert ExecutorExists(_executor);
        }
        emit ExecutorAdded(_account, _executor);
    }

    /**
     * @notice Adds a single auditor to the calling Safe's auditor list
     * @param _auditor The address of the auditor to add
     * @dev This function can only be called by contracts (Safe wallets)
     */
    function addAuditor(address _auditor) external onlyContract {
        if (_auditor == address(0)) {
            revert ZeroAddress();
        }
        address _account = msg.sender;
        EnumerableSet.AddressSet storage axe = _auditors[_account];
        if (!axe.add(_auditor)) {
            revert AuditorExists(_auditor);
        }
        emit AuditorAdded(_account, _auditor);
    }

    /**
     * @notice Removes a single executor from the calling Safe's executor list
     * @param _executor The address of the executor to remove
     * @dev This function can only be called by contracts (Safe wallets)
     */
    function removeExecutor(address _executor) external onlyContract {
        if (_executor == address(0)) {
            revert ZeroAddress();
        }
        address _account = msg.sender;
        EnumerableSet.AddressSet storage exe = _executors[_account];
        if (!exe.remove(_executor)) {
            revert ExecutorDoesNotExist(_executor);
        }
        emit ExecutorRemoved(_account, _executor);
    }

    /**
     * @notice Removes a single auditor from the calling Safe's auditor list
     * @param _auditor The address of the auditor to remove
     * @dev This function can only be called by contracts (Safe wallets)
     */
    function removeAuditor(address _auditor) external onlyContract {
        if (_auditor == address(0)) {
            revert ZeroAddress();
        }
        address _account = msg.sender;
        EnumerableSet.AddressSet storage axe = _auditors[_account];
        if (!axe.remove(_auditor)) {
            revert AuditorDoesNotExist(_auditor);
        }
        emit AuditorRemoved(_account, _auditor);
    }

    /**
     * @notice Called by the Safe contract before a transaction is executed.
     */
    function checkTransaction(
        address to,
        uint256 value,
        bytes memory data,
        Enum.Operation operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        // solhint-disable-next-line no-unused-vars
        address payable refundReceiver,
        bytes memory,
        address msgSender
    ) external override {
        uint256 executerLength = _executors[msg.sender].length();
        uint256 auditorLength = _auditors[msg.sender].length();
        if (executerLength != 0 && !_executors[msg.sender].contains(msgSender)) {
            revert NotExecutor(msgSender);
        }

        if (auditorLength != 0) {
            if (to != address(msg.sender) || data.length != 0) {
                //Check hash
                bytes32 hash = encodeTransactionData(
                    to,
                    value,
                    data,
                    operation,
                    safeTxGas,
                    baseGas,
                    gasPrice,
                    gasToken,
                    refundReceiver,
                    (ISafe(msg.sender).nonce()) - 1
                );
                if (messagehash[msg.sender][ISafe(msg.sender).nonce() - 1] != hash) {
                    revert InvalidHash();
                }
                emit SafeTxData(
                    to,
                    value,
                    data,
                    uint8(operation),
                    safeTxGas,
                    baseGas,
                    gasPrice,
                    gasToken,
                    refundReceiver,
                    (ISafe(msg.sender).nonce() - 1),
                    hash
                );
            }
        }
    }

    /**
     * @notice Returns the list of executors for a given Safe wallet
     * @param _vault The address of the Safe wallet
     * @return _executorsArray Array of executor addresses for the specified Safe
     */
    function executors(address _vault) external view returns (address[] memory _executorsArray) {
        return _executors[_vault].values();
    }

    /**
     * @notice Returns the list of auditors for a given Safe wallet
     * @param _vault The address of the Safe wallet
     * @return _auditorsArray Array of auditor addresses for the specified Safe
     */
    function auditors(address _vault) external view returns (address[] memory _auditorsArray) {
        return _auditors[_vault].values();
    }

    /**
     * @notice Called by the Safe contract after a transaction is executed.
     * @dev No-op.
     */
    function checkAfterExecution(bytes32, bool) external view override {}

    /// @dev Returns the bytes that are hashed to be signed by owners.
    /// @param to Destination address.
    /// @param value Ether value.
    /// @param data Data payload.
    /// @param operation Operation type.
    /// @param safeTxGas Gas that should be used for the safe transaction.
    /// @param baseGas Gas costs for that are independent of the transaction execution(e.g. base transaction fee, signature check, payment of the refund)
    /// @param gasPrice Maximum gas price that should be used for this transaction.
    /// @param gasToken Token address (or 0 if ETH) that is used for the payment.
    /// @param refundReceiver Address of receiver of gas payment (or 0 if tx.origin).
    /// @param _nonce Transaction nonce.
    /// @return Message hash bytes.
    function encodeTransactionData(
        address to,
        uint256 value,
        bytes memory data,
        Enum.Operation operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address refundReceiver,
        uint256 _nonce
    ) public pure returns (bytes32) {
        bytes32 safeTxHash =
            keccak256(
                abi.encode(
                    SAFE_TX_TYPEHASH,
                    to,
                    value,
                    keccak256(data),
                    operation,
                    safeTxGas,
                    baseGas,
                    gasPrice,
                    gasToken,
                    refundReceiver,
                    _nonce
                )
            );
        return safeTxHash;
    }

    /**
     * @notice Internal function to add a message hash for a specific Safe wallet and nonce
     * @param _vault The address of the Safe wallet
     * @param _nonce The nonce for the transaction
     * @param _hash The message hash to add
     */
    function _addMessageHash(address _vault, uint256 _nonce, bytes32 _hash) internal {
        if (_hash == bytes32(0)) {
            revert ZeroHash();
        }
        if (_nonce < ISafe(_vault).nonce()) {
            revert InvalidNonce();
        }
        messagehash[_vault][_nonce] = _hash;
        emit MessageHashAdded(_vault, _nonce, _hash);
    }

    /**
     * @notice Internal function to check if an address is a contract
     * @param addr The address to check
     * @return True if the address is a contract, false otherwise
     */
    function _isContract(address addr) internal view returns (bool) {
        uint size;
        assembly {
            size := extcodesize(addr)
        }
        return size > 0;
    }
}
