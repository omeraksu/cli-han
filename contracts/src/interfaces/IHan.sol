// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

interface IHan {
    event GameRoomCreated(
        uint256 indexed roomId,
        address indexed host,
        bytes32 gameType,
        uint128 entryFee,
        uint8 maxPlayers
    );
    event PlayerJoined(uint256 indexed roomId, address indexed player, uint8 playerIndex);
    event GameSettled(uint256 indexed roomId, address indexed winner, uint256 payout);
    event GameCancelled(uint256 indexed roomId);
    event RefundClaimed(uint256 indexed roomId, address indexed player, uint256 amount);
    event TimeoutRefundClaimed(uint256 indexed roomId, address indexed player, uint256 amount);
    event ConfigUpdated(uint16 feeBps, address feeReceiver, address authority);

    function createGameRoom(
        uint256 roomId,
        bytes32 gameType,
        uint128 entryFee,
        uint8 maxPlayers
    ) external payable;

    function joinGame(uint256 roomId) external payable;
    function settleGame(uint256 roomId, address winner) external;
    function cancelGame(uint256 roomId) external;
    function claimRefund(uint256 roomId) external;
    function timeoutRefund(uint256 roomId) external;
}
