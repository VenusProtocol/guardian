// SPDX-License-Identifier: BSD-3-Clause

pragma solidity 0.8.25;

import { Ownable2Step } from "@openzeppelin/contracts/access/Ownable2Step.sol";
import { IComptroller as ILegacyPoolComptroller } from "@venusprotocol/venus-protocol/contracts/InterfacesV8.sol";

/// @title DrillLegacyComptroller
/// @notice Custom legacy pool Comptroller for drills that mimics the legacy pool Comptroller interface
/// @dev This contract does not behave as a normal legacy Comptroller but provides the same interface
///      for pause/unpause functionality and market management.
contract DrillLegacyComptroller is Ownable2Step {
    struct Market {
        bool isListed;
        uint256 collateralFactorMantissa;
    }

    mapping(address => Market) public markets;
    mapping(address => mapping(uint8 => bool)) public actionPausedState;

    event NewCollateralFactor(address vToken, uint256 oldCollateralFactorMantissa, uint256 newCollateralFactorMantissa);
    event ActionPausedMarket(address vToken, uint8 action, bool pauseState);
    event MarketListed(address vToken);

    error MarketNotListed(address vToken);
    error InvalidCollateralFactor(uint256 factor);

    /// @notice Constructor
    /// @param _owner Owner address with admin privileges
    constructor(address _owner) Ownable2Step() {
        _transferOwnership(_owner);
    }

    /// @notice List a market
    /// @param vToken Address of the vToken to list
    /// @param collateralFactor Initial collateral factor (in basis points)
    function listMarket(address vToken, uint256 collateralFactor) external onlyOwner {
        if (collateralFactor > 1e18) {
            revert InvalidCollateralFactor(collateralFactor);
        }

        markets[vToken].isListed = true;
        markets[vToken].collateralFactorMantissa = collateralFactor;
        emit MarketListed(vToken);
        emit NewCollateralFactor(vToken, 0, collateralFactor);
    }

    /// @notice Set collateral factor for a market (legacy pool interface)
    /// @param vToken Address of the vToken
    /// @param newCollateralFactor New collateral factor (in basis points)
    function _setCollateralFactor(address vToken, uint256 newCollateralFactor) external onlyOwner {
        if (!markets[vToken].isListed) {
            revert MarketNotListed(vToken);
        }
        if (newCollateralFactor > 1e18) {
            revert InvalidCollateralFactor(newCollateralFactor);
        }

        uint256 oldCollateralFactor = markets[vToken].collateralFactorMantissa;
        markets[vToken].collateralFactorMantissa = newCollateralFactor;

        emit NewCollateralFactor(vToken, oldCollateralFactor, newCollateralFactor);
    }

    /// @notice Set actions paused for markets (legacy pool interface)
    /// @param markets_ Array of vToken addresses
    /// @param actions_ Array of action types to pause/unpause
    /// @param paused_ Whether to pause (true) or unpause (false) the actions
    function _setActionsPaused(
        address[] calldata markets_,
        ILegacyPoolComptroller.Action[] calldata actions_,
        bool paused_
    ) external onlyOwner {
        uint256 marketsCount = markets_.length;
        uint256 actionsCount = actions_.length;

        for (uint256 marketIdx; marketIdx < marketsCount; ++marketIdx) {
            for (uint256 actionIdx; actionIdx < actionsCount; ++actionIdx) {
                _setActionPaused(markets_[marketIdx], actions_[actionIdx], paused_);
            }
        }
    }

    /// @notice Check if an action is paused for a market
    /// @param vToken Address of the vToken
    /// @param action Action type to check
    /// @return Whether the action is paused
    function actionPaused(address vToken, uint8 action) external view returns (bool) {
        return actionPausedState[vToken][action];
    }

    /// @dev Internal function to set action paused state (matches Venus implementation)
    /// @param market Address of the market
    /// @param action Action type to pause/unpause
    /// @param paused Whether to pause (true) or unpause (false) the action
    function _setActionPaused(address market, ILegacyPoolComptroller.Action action, bool paused) internal {
        if (!markets[market].isListed) {
            revert MarketNotListed(market);
        }
        actionPausedState[market][uint8(action)] = paused;
        emit ActionPausedMarket(market, uint8(action), paused);
    }
}
