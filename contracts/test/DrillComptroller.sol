// SPDX-License-Identifier: BSD-3-Clause

pragma solidity 0.8.25;

import { Ownable2Step } from "@openzeppelin/contracts/access/Ownable2Step.sol";
import { VToken } from "@venusprotocol/isolated-pools/contracts/VToken.sol";
import { Action } from "@venusprotocol/isolated-pools/contracts/ComptrollerInterface.sol";

/// @title DrillComptroller
/// @notice Custom Comptroller for drills that mimics the isolated pool Comptroller interface
/// @dev This contract does not behave as a normal Comptroller but provides the same interface
///      for pause/unpause functionality and market management.
contract DrillComptroller is Ownable2Step {
    struct Market {
        bool isListed;
        uint256 collateralFactorMantissa;
        uint256 liquidationThresholdMantissa;
    }
    mapping(address => Market) public markets;
    mapping(address => mapping(uint8 => bool)) public actionPausedState;

    event NewCollateralFactor(address vToken, uint256 oldCollateralFactorMantissa, uint256 newCollateralFactorMantissa);
    event NewLiquidationThreshold(
        address vToken,
        uint256 oldLiquidationThresholdMantissa,
        uint256 newLiquidationThresholdMantissa
    );
    event ActionPausedMarket(address vToken, uint8 action, bool pauseState);
    event MarketSupported(address vToken);

    error MarketNotListed(address vToken);
    error InvalidCollateralFactor(uint256 factor);
    error InvalidLiquidationThreshold(uint256 threshold);

    /// @notice Constructor
    /// @param _owner Owner address with admin privileges
    constructor(address _owner) Ownable2Step() {
        _transferOwnership(_owner);
    }

    /// @notice List a market
    /// @param vToken Address of the vToken to list
    /// @param collateralFactor Initial collateral factor (in basis points)
    /// @param liquidationThreshold Initial liquidation threshold (in basis points)
    function listMarket(address vToken, uint256 collateralFactor, uint256 liquidationThreshold) external onlyOwner {
        if (collateralFactor > 1e18) {
            revert InvalidCollateralFactor(collateralFactor);
        }
        if (liquidationThreshold > 1e18) {
            revert InvalidLiquidationThreshold(liquidationThreshold);
        }

        markets[vToken].isListed = true;
        markets[vToken].collateralFactorMantissa = collateralFactor;
        markets[vToken].liquidationThresholdMantissa = liquidationThreshold;

        emit MarketSupported(vToken);
        emit NewCollateralFactor(vToken, 0, collateralFactor);
        emit NewLiquidationThreshold(vToken, 0, liquidationThreshold);
    }

    /// @notice Set collateral factor for a market (matches isolated pool interface)
    /// @param vToken Address of the vToken
    /// @param newCollateralFactorMantissa New collateral factor (in basis points)
    /// @param newLiquidationThresholdMantissa New liquidation threshold (in basis points)
    function setCollateralFactor(
        VToken vToken,
        uint256 newCollateralFactorMantissa,
        uint256 newLiquidationThresholdMantissa
    ) external onlyOwner {
        address vTokenAddr = address(vToken);
        if (!markets[vTokenAddr].isListed) {
            revert MarketNotListed(vTokenAddr);
        }
        if (newCollateralFactorMantissa > 1e18) {
            revert InvalidCollateralFactor(newCollateralFactorMantissa);
        }
        if (newLiquidationThresholdMantissa > 1e18) {
            revert InvalidLiquidationThreshold(newLiquidationThresholdMantissa);
        }

        uint256 oldCollateralFactor = markets[vTokenAddr].collateralFactorMantissa;
        uint256 oldLiquidationThreshold = markets[vTokenAddr].liquidationThresholdMantissa;

        markets[vTokenAddr].collateralFactorMantissa = newCollateralFactorMantissa;
        markets[vTokenAddr].liquidationThresholdMantissa = newLiquidationThresholdMantissa;

        emit NewCollateralFactor(vTokenAddr, oldCollateralFactor, newCollateralFactorMantissa);
        emit NewLiquidationThreshold(vTokenAddr, oldLiquidationThreshold, newLiquidationThresholdMantissa);
    }

    /// @notice Set actions paused for markets (matches isolated pool interface)
    /// @param marketsList Array of VToken addresses
    /// @param actionsList Array of action types to pause/unpause
    /// @param paused Whether to pause (true) or unpause (false) the actions
    function setActionsPaused(
        VToken[] calldata marketsList,
        Action[] calldata actionsList,
        bool paused
    ) external onlyOwner {
        uint256 marketsCount = marketsList.length;
        uint256 actionsCount = actionsList.length;

        for (uint256 marketIdx; marketIdx < marketsCount; ++marketIdx) {
            for (uint256 actionIdx; actionIdx < actionsCount; ++actionIdx) {
                _setActionPaused(address(marketsList[marketIdx]), actionsList[actionIdx], paused);
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
    function _setActionPaused(address market, Action action, bool paused) internal {
        if (!markets[market].isListed) {
            revert MarketNotListed(market);
        }
        actionPausedState[market][uint8(action)] = paused;
        emit ActionPausedMarket(market, uint8(action), paused);
    }
}
