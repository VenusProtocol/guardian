// SPDX-License-Identifier: BSD-3-Clause

pragma solidity 0.8.25;

import { Ownable2Step } from "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @title DrillVToken
/// @notice Custom VToken for drills that mimics the VToken interface for monitoring purposes
/// @dev This contract does not behave as a normal vToken but provides the same interface
///      for market invariant checks. It allows setting market data values for testing.
contract DrillVToken is Ownable2Step {
    // solhint-disable-next-line immutable-vars-naming
    address public immutable comptroller;
    bool public immutable IS_LEGACY_POOL;
    string public name;
    string public symbol;
    uint8 public decimals;
    uint256 public exchangeRateStored;
    uint256 public totalSupply;
    uint256 public cash;
    uint256 public totalBorrows;
    uint256 public totalReserves;
    uint256 private _badDebt;

    event AccrueInterest(uint256 cashPrior, uint256 interestAccumulated, uint256 borrowIndex, uint256 totalBorrows);

    error NotSupported();

    /// @notice Constructor
    /// @param _comptroller Comptroller address
    /// @param _name Token name
    /// @param _symbol Token symbol
    /// @param _decimals Token decimals
    /// @param _owner Owner address with admin privileges
    constructor(
        address _comptroller,
        bool _isLegacyPool,
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        address _owner
    ) Ownable2Step() {
        comptroller = _comptroller;
        IS_LEGACY_POOL = _isLegacyPool;
        name = _name;
        symbol = _symbol;
        decimals = _decimals;

        exchangeRateStored = 1e18;
        totalSupply = 1000000e18;
        cash = 800000e18;
        totalBorrows = 300000e18;
        _badDebt = 0;
        totalReserves = 100000e18;

        _transferOwnership(_owner);
    }

    /// @notice Update market data values
    /// @param exchangeRate_ New exchange rate
    /// @param totalSupply_ New total supply
    /// @param cash_ New cash balance
    /// @param totalBorrows_ New total borrows
    /// @param badDebt_ New bad debt (only for isolated pools)
    /// @param totalReserves_ New total reserves
    function updateMarketData(
        uint256 exchangeRate_,
        uint256 totalSupply_,
        uint256 cash_,
        uint256 totalBorrows_,
        uint256 badDebt_,
        uint256 totalReserves_
    ) external onlyOwner {
        exchangeRateStored = exchangeRate_;
        totalSupply = totalSupply_;
        cash = cash_;
        totalBorrows = totalBorrows_;
        _badDebt = badDebt_;
        totalReserves = totalReserves_;

        // Emit AccrueInterest event to simulate market activity
        emit AccrueInterest(cash_, 0, 0, totalBorrows_);
    }

    /// @notice Get cash balance
    /// @return Cash balance
    function getCash() external view returns (uint256) {
        return cash;
    }

    /// @notice Get bad debt
    /// @return Bad debt
    function badDebt() external view returns (uint256) {
        if (IS_LEGACY_POOL) {
            revert NotSupported();
        }
        return _badDebt;
    }
}
