// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

library HanErrors {
    error GameNotFilling();
    error RoomFull();
    error DuplicatePlayer();
    error GameNotFinished();
    error UnauthorizedSettler();
    error UnauthorizedHost();
    error InvalidWinner();
    error AlreadyResolved();
    error TimeoutNotReached();
    error AlreadyRefunded();
    error NotAPlayer();
    error EntryFeeTooLow();
    error EntryFeeTooHigh();
    error RefundAlreadyClaimed();
    error CannotCancel();
    error NoRefundAvailable();
    error RoomNotCancelled();
    error InvalidMaxPlayers();
    error WrongEntryFee();
    error RoomAlreadyExists();
    error TransferFailed();
    error ZeroAddress();
    error FeeBpsTooHigh();
}
