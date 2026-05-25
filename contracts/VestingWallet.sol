// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

error ZeroAddress();
error ZeroAmount();
error CliffNotReached();
error NothingToRelease();
error VestingAlreadyRevoked();
error DurationShorterThanCliff();

contract VestingWallet is Ownable {
    event TokensReleased(address indexed beneficiary, uint256 amount);
    event VestingRevoked(
        address indexed beneficiary,
        uint256 amountReturnedToOwner
    );

    IERC20 public immutable token;
    address public immutable beneficiary;
    uint256 public immutable start;
    uint256 public immutable cliff;
    uint256 public immutable duration;
    uint256 public immutable totalAmount;
    uint256 public released;
    bool public revoked;

    constructor(
        address _token,
        address _beneficiary,
        uint256 _totalAmount,
        uint256 _cliffDays,
        uint256 _durationDays
    ) Ownable(msg.sender) {
        if (_token == address(0)) revert ZeroAddress();
        if (_beneficiary == address(0)) revert ZeroAddress();
        if (_totalAmount == 0) revert ZeroAmount();
        if (_durationDays <= _cliffDays) revert DurationShorterThanCliff();

        token = IERC20(_token);
        beneficiary = _beneficiary;
        start = block.timestamp;
        cliff = block.timestamp + (_cliffDays * 1 days);
        duration = _durationDays * 1 days;
        totalAmount = _totalAmount;

        token.transferFrom(msg.sender, address(this), _totalAmount);
    }

    function vestedAmount() public view returns (uint256) {
        if (block.timestamp < cliff) return 0;
        if (revoked) return released;
        if (block.timestamp >= start + duration) return totalAmount;

        uint256 elapsed = block.timestamp - start;
        return (totalAmount * elapsed) / duration;
    }

    function release() external {
        if (msg.sender != beneficiary) revert ZeroAddress();
        if (block.timestamp < cliff) revert CliffNotReached();

        uint256 releasable = vestedAmount() - released;
        if (releasable == 0) revert NothingToRelease();

        released += releasable;
        token.transfer(beneficiary, releasable);

        emit TokensReleased(beneficiary, releasable);
    }

    function revoke() external onlyOwner {
        if (revoked) revert VestingAlreadyRevoked();

        uint256 vested = vestedAmount();
        uint256 releasable = vested - released;
        uint256 returnAmount = totalAmount - vested;

        revoked = true;

        if (releasable > 0) {
            released += releasable;
            token.transfer(beneficiary, releasable);
        }

        if (returnAmount > 0) {
            token.transfer(owner(), returnAmount);
        }

        emit VestingRevoked(beneficiary, returnAmount);
    }

    function releasableAmount() external view returns (uint256) {
        if (block.timestamp < cliff) return 0;
        return vestedAmount() - released;
    }

    function vestingEnd() external view returns (uint256) {
        return start + duration;
    }
}
