// Fixed broadcast geometry. Both streamer PTY and viewer terminal
// emulator pin to this grid so cursor-positioning escape sequences
// from full-screen TUIs (claude code, vim, htop) line up 1:1 on the
// viewer side.
//
// The streamer's host terminal can be larger; the PTY is letterboxed.
export const BROADCAST_COLS = 120;
export const BROADCAST_ROWS = 30;
