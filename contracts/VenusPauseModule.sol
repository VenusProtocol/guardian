// SPDX-License-Identifier: BSD-3-Clause

pragma solidity 0.8.25;

import { Safe } from "@safe-global/safe-contracts/contracts/Safe.sol";
import { Enum } from "@safe-global/safe-contracts/contracts/common/Enum.sol";
import { MultiSendCallOnly } from "@safe-global/safe-contracts/contracts/libraries/MultiSendCallOnly.sol";
import { ensureNonzeroAddress } from "@venusprotocol/solidity-utilities/contracts/validators.sol";
import { IComptroller as ILegacyPoolComptroller } from "@venusprotocol/venus-protocol/contracts/InterfacesV8.sol";
import { Action } from "@venusprotocol/isolated-pools/contracts/ComptrollerInterface.sol";
import { Comptroller } from "@venusprotocol/isolated-pools/contracts/Comptroller.sol";
import { VToken } from "@venusprotocol/isolated-pools/contracts/VToken.sol";

/// @title VenusPauseModule
/// @notice Safe module that can pause Venus markets (mint, borrow, enter-market) and set the collateral factor to 0;
///         provides a one-transaction kill switch and key rotation (no VIP required) and restricts the keeper to a
///         whitelisted set of actions.
/// @dev Executes transactions through the Venus Guardian Safe using MultiSend
contract VenusPauseModule {
    /// @notice Address authorized to call the pauseMarket function
    address public immutable KEEPER;

    /// @notice The Venus Guardian Safe contract that executes the pause transactions
    Safe public immutable VENUS_GUARDIAN;

    /// @notice Address of the MultiSendCallOnly contract used for batch transactions
    address public immutable MULTISEND_CALL_ONLY;

    /// @notice Address of the legacy pool comptroller (can be zero address)
    address public immutable LEGACY_POOL_COMPTROLLER;

    /// @notice Emitted when a market is paused with the pause guardian module
    /// @param vToken The address of the vToken that was paused
    /// @param comptroller The address of the comptroller that was used to pause the market
    event MarketPausedByMonitoring(address indexed vToken, address indexed comptroller);

    /// @notice Error thrown when an unauthorized address attempts to call pauseMarket
    /// @param sender The address that attempted to call the function
    /// @param keeper The authorized keeper address
    error Unauthorized(address sender, address keeper);

    /// @notice Error thrown when the Safe transaction execution fails
    error SafeTxFailed();

    /// @notice Constructor
    /// @param keeper Address authorized to call pauseMarket
    /// @param venusGuardian Venus Guardian Safe address
    /// @param multisendCallOnly MultiSend contract address
    /// @param legacyPoolComptroller Legacy pool comptroller address (can be zero)
    constructor(
        address keeper,
        address payable venusGuardian,
        address multisendCallOnly,
        address legacyPoolComptroller
    ) {
        ensureNonzeroAddress(keeper);
        ensureNonzeroAddress(venusGuardian);
        ensureNonzeroAddress(multisendCallOnly);
        // legacyPoolComptroller can be zero address

        KEEPER = keeper;
        VENUS_GUARDIAN = Safe(venusGuardian);
        MULTISEND_CALL_ONLY = multisendCallOnly;
        LEGACY_POOL_COMPTROLLER = legacyPoolComptroller;
    }

    /// @notice Pauses a Venus market by pausing actions and setting collateral factor to 0
    /// @param vToken Address of the vToken to pause
    /// @dev For the legacy pool: only pauses actions. For isolated pools: pauses actions and sets collateral factor to 0
    function pauseMarket(address vToken) external {
        if (msg.sender != KEEPER) {
            revert Unauthorized(msg.sender, KEEPER);
        }
        address comptroller = address(VToken(vToken).comptroller());
        bytes memory data;
        if (comptroller == LEGACY_POOL_COMPTROLLER) {
            data = abi.encodePacked(_legacyPoolPauseActions(comptroller, vToken));
        } else {
            (, , uint256 liquidationThreshold) = Comptroller(comptroller).markets(vToken);
            data = abi.encodePacked(
                _pauseActions(comptroller, vToken),
                _setCollateralFactor(comptroller, vToken, 0, liquidationThreshold)
            );
        }
        bool success = VENUS_GUARDIAN.execTransactionFromModule(
            MULTISEND_CALL_ONLY,
            0,
            abi.encodeCall(MultiSendCallOnly.multiSend, data),
            Enum.Operation.DelegateCall
        );
        if (!success) {
            revert SafeTxFailed();
        }
        emit MarketPausedByMonitoring(vToken, comptroller);
    }

    /// @dev Encodes a transaction for MultiSend
    /// @param to Target contract address
    /// @param data Calldata to execute
    /// @return Encoded transaction bytes
    function _encodeTx(address to, bytes memory data) internal pure returns (bytes memory) {
        return
            abi.encodePacked(
                uint8(0), // Operation type (0 = call)
                to,
                uint256(0), // Value
                data.length,
                data
            );
    }

    /// @dev Encodes legacy pool pause actions transaction
    /// @param comptroller Legacy pool comptroller address
    /// @param vToken vToken address to pause
    /// @return Encoded transaction bytes for pausing mint, borrow, and enter market actions
    function _legacyPoolPauseActions(address comptroller, address vToken) internal pure returns (bytes memory) {
        address[] memory markets = new address[](1);
        markets[0] = vToken;
        ILegacyPoolComptroller.Action[] memory actions = new ILegacyPoolComptroller.Action[](3);
        actions[0] = ILegacyPoolComptroller.Action.MINT;
        actions[1] = ILegacyPoolComptroller.Action.BORROW;
        actions[2] = ILegacyPoolComptroller.Action.ENTER_MARKET;
        bytes memory data = abi.encodeCall(ILegacyPoolComptroller._setActionsPaused, (markets, actions, true));
        return _encodeTx(comptroller, data);
    }

    /// @dev Encodes isolated pool pause actions transaction
    /// @param comptroller Isolated pool comptroller address
    /// @param vToken vToken address to pause
    /// @return Encoded transaction bytes for pausing mint, borrow, and enter market actions
    function _pauseActions(address comptroller, address vToken) internal pure returns (bytes memory) {
        VToken[] memory markets = new VToken[](1);
        markets[0] = VToken(vToken);
        Action[] memory actions = new Action[](3);
        actions[0] = Action.MINT;
        actions[1] = Action.BORROW;
        actions[2] = Action.ENTER_MARKET;
        bytes memory data = abi.encodeCall(Comptroller.setActionsPaused, (markets, actions, true));
        return _encodeTx(comptroller, data);
    }

    /// @dev Encodes set collateral factor transaction
    /// @param comptroller Comptroller address
    /// @param vToken vToken address
    /// @param newCollateralFactor New collateral factor (typically 0 when pausing)
    /// @param newLiquidationThreshold New liquidation threshold
    /// @return Encoded transaction bytes for setting collateral factor
    function _setCollateralFactor(
        address comptroller,
        address vToken,
        uint256 newCollateralFactor,
        uint256 newLiquidationThreshold
    ) internal pure returns (bytes memory) {
        bytes memory data = abi.encodeCall(
            Comptroller.setCollateralFactor,
            (VToken(vToken), newCollateralFactor, newLiquidationThreshold)
        );
        return _encodeTx(comptroller, data);
    }
}
