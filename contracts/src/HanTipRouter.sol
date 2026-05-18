// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {HanErrors} from "./libraries/HanErrors.sol";

/// @notice Atomic native-AVAX tip splitter for Han broadcasters.
/// @dev EVM single-`to` constraint forces an on-chain router for atomicity.
///      Counterpart to Solana's two-`SystemProgram::transfer` pattern.
contract HanTipRouter is ReentrancyGuard {
    uint16 public constant MAX_FEE_BPS = 1000;
    uint16 public immutable feeBps;
    address public immutable feeReceiver;

    event Tipped(
        address indexed viewer,
        address indexed streamer,
        uint256 amount,
        uint256 feeAmount,
        uint256 streamerAmount
    );

    constructor(uint16 _feeBps, address _feeReceiver) {
        if (_feeBps > MAX_FEE_BPS) revert HanErrors.FeeBpsTooHigh();
        if (_feeReceiver == address(0)) revert HanErrors.ZeroAddress();
        feeBps = _feeBps;
        feeReceiver = _feeReceiver;
    }

    function tip(address streamer) external payable nonReentrant {
        if (streamer == address(0)) revert HanErrors.ZeroAddress();
        if (msg.value == 0) revert HanErrors.NoRefundAvailable();

        uint256 fee = (msg.value * feeBps) / 10_000;
        uint256 toStreamer = msg.value - fee;

        if (fee > 0) {
            (bool feeOk,) = payable(feeReceiver).call{value: fee}("");
            if (!feeOk) revert HanErrors.TransferFailed();
        }
        (bool streamerOk,) = payable(streamer).call{value: toStreamer}("");
        if (!streamerOk) revert HanErrors.TransferFailed();

        emit Tipped(msg.sender, streamer, msg.value, fee, toStreamer);
    }
}
