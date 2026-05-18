// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IHan} from "./interfaces/IHan.sol";
import {HanErrors} from "./libraries/HanErrors.sol";

contract Han is IHan, Ownable, ReentrancyGuard {
    uint8 public constant STATUS_FILLING = 1;
    uint8 public constant STATUS_READY = 2;
    uint8 public constant STATUS_FINISHED = 4;
    uint8 public constant STATUS_SETTLED = 5;
    uint8 public constant STATUS_CANCELLED = 6;
    uint8 public constant STATUS_TIMED_OUT = 7;

    uint8 public constant MAX_PLAYERS = 8;
    uint128 public constant MIN_ENTRY_FEE = 1e15;
    uint128 public constant MAX_ENTRY_FEE = 10 ether;
    uint64 public constant ROOM_TIMEOUT = 24 hours;
    uint16 public constant MAX_FEE_BPS = 1000;

    struct GameRoom {
        address host;
        bytes32 gameType;
        uint128 entryFee;
        uint8 maxPlayers;
        uint8 playerCount;
        uint8 status;
        uint8 refundClaimedBitmap;
        uint64 createdAt;
        address winner;
        address[MAX_PLAYERS] players;
    }

    address public authority;
    address public feeReceiver;
    uint16 public feeBps;

    mapping(uint256 => GameRoom) private _rooms;
    mapping(uint256 => bool) public roomExists;

    modifier onlyAuthority() {
        if (msg.sender != authority) revert HanErrors.UnauthorizedSettler();
        _;
    }

    constructor(uint16 _feeBps, address _feeReceiver, address _authority, address _owner)
        Ownable(_owner)
    {
        if (_feeBps > MAX_FEE_BPS) revert HanErrors.FeeBpsTooHigh();
        if (_feeReceiver == address(0) || _authority == address(0)) {
            revert HanErrors.ZeroAddress();
        }
        feeBps = _feeBps;
        feeReceiver = _feeReceiver;
        authority = _authority;
        emit ConfigUpdated(_feeBps, _feeReceiver, _authority);
    }

    function updateConfig(uint16 newFeeBps, address newFeeReceiver, address newAuthority)
        external
        onlyOwner
    {
        if (newFeeBps > MAX_FEE_BPS) revert HanErrors.FeeBpsTooHigh();
        if (newFeeReceiver == address(0) || newAuthority == address(0)) {
            revert HanErrors.ZeroAddress();
        }
        feeBps = newFeeBps;
        feeReceiver = newFeeReceiver;
        authority = newAuthority;
        emit ConfigUpdated(newFeeBps, newFeeReceiver, newAuthority);
    }

    function createGameRoom(
        uint256 roomId,
        bytes32 gameType,
        uint128 entryFee,
        uint8 maxPlayers
    ) external payable nonReentrant {
        if (roomExists[roomId]) revert HanErrors.RoomAlreadyExists();
        if (entryFee < MIN_ENTRY_FEE) revert HanErrors.EntryFeeTooLow();
        if (entryFee > MAX_ENTRY_FEE) revert HanErrors.EntryFeeTooHigh();
        if (maxPlayers < 2 || maxPlayers > MAX_PLAYERS) revert HanErrors.InvalidMaxPlayers();
        if (msg.value != entryFee) revert HanErrors.WrongEntryFee();

        GameRoom storage room = _rooms[roomId];
        room.host = msg.sender;
        room.gameType = gameType;
        room.entryFee = entryFee;
        room.maxPlayers = maxPlayers;
        room.playerCount = 1;
        room.status = STATUS_FILLING;
        room.createdAt = uint64(block.timestamp);
        room.players[0] = msg.sender;
        roomExists[roomId] = true;

        emit GameRoomCreated(roomId, msg.sender, gameType, entryFee, maxPlayers);
        emit PlayerJoined(roomId, msg.sender, 0);
    }

    function joinGame(uint256 roomId) external payable nonReentrant {
        if (!roomExists[roomId]) revert HanErrors.NoRefundAvailable();
        GameRoom storage room = _rooms[roomId];

        if (room.status != STATUS_FILLING) revert HanErrors.GameNotFilling();
        if (room.playerCount >= room.maxPlayers) revert HanErrors.RoomFull();
        if (msg.value != room.entryFee) revert HanErrors.WrongEntryFee();

        for (uint8 i = 0; i < room.playerCount; i++) {
            if (room.players[i] == msg.sender) revert HanErrors.DuplicatePlayer();
        }

        uint8 idx = room.playerCount;
        room.players[idx] = msg.sender;
        room.playerCount = idx + 1;

        if (room.playerCount == room.maxPlayers) {
            room.status = STATUS_READY;
        }

        emit PlayerJoined(roomId, msg.sender, idx);
    }

    function settleGame(uint256 roomId, address winner) external onlyAuthority nonReentrant {
        if (!roomExists[roomId]) revert HanErrors.NoRefundAvailable();
        GameRoom storage room = _rooms[roomId];

        if (room.status != STATUS_READY && room.status != STATUS_FINISHED) {
            revert HanErrors.GameNotFinished();
        }
        if (room.refundClaimedBitmap != 0) revert HanErrors.RefundAlreadyClaimed();

        bool isPlayer = false;
        for (uint8 i = 0; i < room.playerCount; i++) {
            if (room.players[i] == winner) {
                isPlayer = true;
                break;
            }
        }
        if (!isPlayer) revert HanErrors.InvalidWinner();

        uint256 totalPot = uint256(room.entryFee) * room.playerCount;
        uint256 fee = (totalPot * feeBps) / 10_000;
        uint256 payout = totalPot - fee;

        room.winner = winner;
        room.status = STATUS_SETTLED;

        if (fee > 0) {
            (bool feeOk,) = payable(feeReceiver).call{value: fee}("");
            if (!feeOk) revert HanErrors.TransferFailed();
        }
        if (payout > 0) {
            (bool winnerOk,) = payable(winner).call{value: payout}("");
            if (!winnerOk) revert HanErrors.TransferFailed();
        }

        emit GameSettled(roomId, winner, payout);
    }

    function cancelGame(uint256 roomId) external nonReentrant {
        if (!roomExists[roomId]) revert HanErrors.NoRefundAvailable();
        GameRoom storage room = _rooms[roomId];

        if (msg.sender != room.host) revert HanErrors.UnauthorizedHost();
        if (room.status != STATUS_FILLING) revert HanErrors.CannotCancel();

        room.status = STATUS_CANCELLED;

        emit GameCancelled(roomId);
    }

    function claimRefund(uint256 roomId) external nonReentrant {
        if (!roomExists[roomId]) revert HanErrors.NoRefundAvailable();
        GameRoom storage room = _rooms[roomId];

        if (room.status != STATUS_CANCELLED) revert HanErrors.RoomNotCancelled();

        uint8 playerIndex = type(uint8).max;
        for (uint8 i = 0; i < room.playerCount; i++) {
            if (room.players[i] == msg.sender) {
                playerIndex = i;
                break;
            }
        }
        if (playerIndex == type(uint8).max) revert HanErrors.NotAPlayer();

        uint8 bit = uint8(1 << playerIndex);
        if (room.refundClaimedBitmap & bit != 0) revert HanErrors.AlreadyRefunded();

        room.refundClaimedBitmap |= bit;
        uint256 amount = room.entryFee;

        if (amount > 0) {
            (bool ok,) = payable(msg.sender).call{value: amount}("");
            if (!ok) revert HanErrors.TransferFailed();
        }

        emit RefundClaimed(roomId, msg.sender, amount);
    }

    function timeoutRefund(uint256 roomId) external nonReentrant {
        if (!roomExists[roomId]) revert HanErrors.NoRefundAvailable();
        GameRoom storage room = _rooms[roomId];

        if (block.timestamp < uint256(room.createdAt) + ROOM_TIMEOUT) {
            revert HanErrors.TimeoutNotReached();
        }
        if (room.status == STATUS_SETTLED || room.status == STATUS_TIMED_OUT) {
            revert HanErrors.AlreadyResolved();
        }

        uint8 playerIndex = type(uint8).max;
        for (uint8 i = 0; i < room.playerCount; i++) {
            if (room.players[i] == msg.sender) {
                playerIndex = i;
                break;
            }
        }
        if (playerIndex == type(uint8).max) revert HanErrors.NotAPlayer();

        uint8 bit = uint8(1 << playerIndex);
        if (room.refundClaimedBitmap & bit != 0) revert HanErrors.AlreadyRefunded();

        room.refundClaimedBitmap |= bit;

        uint8 fullMask = uint8((1 << room.playerCount) - 1);
        if (room.refundClaimedBitmap == fullMask) {
            room.status = STATUS_TIMED_OUT;
        }

        uint256 amount = room.entryFee;
        if (amount > 0) {
            (bool ok,) = payable(msg.sender).call{value: amount}("");
            if (!ok) revert HanErrors.TransferFailed();
        }

        emit TimeoutRefundClaimed(roomId, msg.sender, amount);
    }

    function getRoom(uint256 roomId)
        external
        view
        returns (
            address host,
            bytes32 gameType,
            uint128 entryFee,
            uint8 maxPlayers,
            uint8 playerCount,
            uint8 status,
            uint8 refundClaimedBitmap,
            uint64 createdAt,
            address winner
        )
    {
        GameRoom storage room = _rooms[roomId];
        return (
            room.host,
            room.gameType,
            room.entryFee,
            room.maxPlayers,
            room.playerCount,
            room.status,
            room.refundClaimedBitmap,
            room.createdAt,
            room.winner
        );
    }

    function getPlayers(uint256 roomId) external view returns (address[] memory) {
        GameRoom storage room = _rooms[roomId];
        address[] memory players = new address[](room.playerCount);
        for (uint8 i = 0; i < room.playerCount; i++) {
            players[i] = room.players[i];
        }
        return players;
    }
}
