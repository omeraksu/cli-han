use anchor_lang::prelude::*;

#[error_code]
pub enum HanError {
    #[msg("Game room is not in filling state")]
    GameNotFilling,
    #[msg("Game room is full")]
    RoomFull,
    #[msg("Player already in room")]
    DuplicatePlayer,
    #[msg("Game is not finished")]
    GameNotFinished,
    #[msg("Unauthorized settler")]
    UnauthorizedSettler,
    #[msg("Invalid winner")]
    InvalidWinner,
    #[msg("Already resolved")]
    AlreadyResolved,
    #[msg("Timeout not yet reached")]
    TimeoutNotReached,
    #[msg("Already refunded")]
    AlreadyRefunded,
    #[msg("Not a player in this room")]
    NotAPlayer,
    #[msg("Entry fee too low")]
    EntryFeeTooLow,
    #[msg("Entry fee too high")]
    EntryFeeTooHigh,
    #[msg("Active refunds exist, cannot settle")]
    RefundAlreadyClaimed,
    #[msg("Room not in filling state for cancellation")]
    CannotCancel,
    #[msg("No refund available")]
    NoRefundAvailable,
    #[msg("Game room is not cancelled")]
    RoomNotCancelled,
    #[msg("Max players must be between 2 and 8")]
    InvalidMaxPlayers,
}
