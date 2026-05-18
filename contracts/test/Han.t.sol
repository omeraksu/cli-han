// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";

import {Han} from "../src/Han.sol";
import {HanErrors} from "../src/libraries/HanErrors.sol";

contract HanTest is Test {
    Han internal han;

    address internal owner = makeAddr("owner");
    address internal authority = makeAddr("authority");
    address internal feeReceiver = makeAddr("feeReceiver");

    address internal host = makeAddr("host");
    address internal player2 = makeAddr("player2");
    address internal player3 = makeAddr("player3");

    uint128 internal constant ENTRY_FEE = 0.05 ether;
    uint16 internal constant FEE_BPS = 300;
    bytes32 internal constant GAME_TYPE = bytes32("pong");

    function setUp() public {
        vm.prank(owner);
        han = new Han(FEE_BPS, feeReceiver, authority, owner);
        vm.deal(host, 100 ether);
        vm.deal(player2, 100 ether);
        vm.deal(player3, 100 ether);
    }

    function _createRoom(uint256 roomId, uint8 maxPlayers) internal {
        vm.prank(host);
        han.createGameRoom{value: ENTRY_FEE}(roomId, GAME_TYPE, ENTRY_FEE, maxPlayers);
    }

    function test_constructor_setsState() public view {
        assertEq(han.feeBps(), FEE_BPS);
        assertEq(han.feeReceiver(), feeReceiver);
        assertEq(han.authority(), authority);
        assertEq(han.owner(), owner);
    }

    function test_constructor_rejectsHighFee() public {
        vm.expectRevert(HanErrors.FeeBpsTooHigh.selector);
        new Han(1001, feeReceiver, authority, owner);
    }

    function test_updateConfig_onlyOwner() public {
        vm.expectRevert();
        han.updateConfig(500, feeReceiver, authority);

        vm.prank(owner);
        han.updateConfig(500, feeReceiver, authority);
        assertEq(han.feeBps(), 500);
    }

    function test_createGameRoom_happy() public {
        _createRoom(1, 2);
        (address h,, uint128 entry, uint8 max, uint8 count, uint8 status,,, address winner) =
            han.getRoom(1);
        assertEq(h, host);
        assertEq(entry, ENTRY_FEE);
        assertEq(max, 2);
        assertEq(count, 1);
        assertEq(status, han.STATUS_FILLING());
        assertEq(winner, address(0));
        assertEq(address(han).balance, ENTRY_FEE);
    }

    function test_createGameRoom_rejectsDuplicateId() public {
        _createRoom(1, 2);
        vm.deal(host, 100 ether);
        vm.prank(host);
        vm.expectRevert(HanErrors.RoomAlreadyExists.selector);
        han.createGameRoom{value: ENTRY_FEE}(1, GAME_TYPE, ENTRY_FEE, 2);
    }

    function test_createGameRoom_rejectsWrongFee() public {
        vm.prank(host);
        vm.expectRevert(HanErrors.WrongEntryFee.selector);
        han.createGameRoom{value: ENTRY_FEE + 1}(1, GAME_TYPE, ENTRY_FEE, 2);
    }

    function test_createGameRoom_rejectsInvalidMaxPlayers() public {
        vm.prank(host);
        vm.expectRevert(HanErrors.InvalidMaxPlayers.selector);
        han.createGameRoom{value: ENTRY_FEE}(1, GAME_TYPE, ENTRY_FEE, 1);

        vm.prank(host);
        vm.expectRevert(HanErrors.InvalidMaxPlayers.selector);
        han.createGameRoom{value: ENTRY_FEE}(2, GAME_TYPE, ENTRY_FEE, 9);
    }

    function test_createGameRoom_rejectsFeeRange() public {
        vm.prank(host);
        vm.expectRevert(HanErrors.EntryFeeTooLow.selector);
        han.createGameRoom{value: 1e14}(1, GAME_TYPE, 1e14, 2);

        vm.prank(host);
        vm.expectRevert(HanErrors.EntryFeeTooHigh.selector);
        han.createGameRoom{value: 11 ether}(2, GAME_TYPE, 11 ether, 2);
    }

    function test_joinGame_fillsRoom() public {
        _createRoom(1, 2);
        vm.prank(player2);
        han.joinGame{value: ENTRY_FEE}(1);
        (,,, uint8 max, uint8 count, uint8 status,,,) = han.getRoom(1);
        assertEq(count, max);
        assertEq(status, han.STATUS_READY());
    }

    function test_joinGame_rejectsDuplicate() public {
        _createRoom(1, 3);
        vm.prank(host);
        vm.expectRevert(HanErrors.DuplicatePlayer.selector);
        han.joinGame{value: ENTRY_FEE}(1);
    }

    function test_joinGame_rejectsWhenFull() public {
        _createRoom(1, 2);
        vm.prank(player2);
        han.joinGame{value: ENTRY_FEE}(1);
        vm.prank(player3);
        vm.expectRevert(HanErrors.GameNotFilling.selector);
        han.joinGame{value: ENTRY_FEE}(1);
    }

    function test_settleGame_paysWinnerAndFee() public {
        _createRoom(1, 2);
        vm.prank(player2);
        han.joinGame{value: ENTRY_FEE}(1);

        uint256 winnerBefore = host.balance;
        uint256 feeBefore = feeReceiver.balance;

        vm.prank(authority);
        han.settleGame(1, host);

        uint256 pot = uint256(ENTRY_FEE) * 2;
        uint256 fee = (pot * FEE_BPS) / 10_000;
        uint256 payout = pot - fee;

        assertEq(host.balance, winnerBefore + payout);
        assertEq(feeReceiver.balance, feeBefore + fee);

        (,,,,, uint8 status,,, address winner) = han.getRoom(1);
        assertEq(status, han.STATUS_SETTLED());
        assertEq(winner, host);
    }

    function test_settleGame_rejectsNonAuthority() public {
        _createRoom(1, 2);
        vm.prank(player2);
        han.joinGame{value: ENTRY_FEE}(1);

        vm.prank(player2);
        vm.expectRevert(HanErrors.UnauthorizedSettler.selector);
        han.settleGame(1, host);
    }

    function test_settleGame_rejectsInvalidWinner() public {
        _createRoom(1, 2);
        vm.prank(player2);
        han.joinGame{value: ENTRY_FEE}(1);

        vm.prank(authority);
        vm.expectRevert(HanErrors.InvalidWinner.selector);
        han.settleGame(1, player3);
    }

    function test_cancelGame_byHost() public {
        _createRoom(1, 3);
        vm.prank(host);
        han.cancelGame(1);
        (,,,,, uint8 status,,,) = han.getRoom(1);
        assertEq(status, han.STATUS_CANCELLED());
    }

    function test_cancelGame_rejectsNonHost() public {
        _createRoom(1, 3);
        vm.prank(player2);
        vm.expectRevert(HanErrors.UnauthorizedHost.selector);
        han.cancelGame(1);
    }

    function test_claimRefund_afterCancel() public {
        _createRoom(1, 3);
        vm.prank(player2);
        han.joinGame{value: ENTRY_FEE}(1);
        vm.prank(host);
        han.cancelGame(1);

        uint256 p2Before = player2.balance;
        vm.prank(player2);
        han.claimRefund(1);
        assertEq(player2.balance, p2Before + ENTRY_FEE);

        vm.prank(player2);
        vm.expectRevert(HanErrors.AlreadyRefunded.selector);
        han.claimRefund(1);
    }

    function test_claimRefund_rejectsNonPlayer() public {
        _createRoom(1, 2);
        vm.prank(host);
        han.cancelGame(1);
        vm.prank(player3);
        vm.expectRevert(HanErrors.NotAPlayer.selector);
        han.claimRefund(1);
    }

    function test_timeoutRefund_afterTimeout() public {
        _createRoom(1, 2);
        vm.prank(player2);
        han.joinGame{value: ENTRY_FEE}(1);

        vm.warp(block.timestamp + 25 hours);

        uint256 p2Before = player2.balance;
        vm.prank(player2);
        han.timeoutRefund(1);
        assertEq(player2.balance, p2Before + ENTRY_FEE);
    }

    function test_timeoutRefund_rejectsBeforeTimeout() public {
        _createRoom(1, 2);
        vm.prank(player2);
        han.joinGame{value: ENTRY_FEE}(1);

        vm.prank(player2);
        vm.expectRevert(HanErrors.TimeoutNotReached.selector);
        han.timeoutRefund(1);
    }

    function test_timeoutRefund_marksTimedOutWhenAllClaim() public {
        _createRoom(1, 2);
        vm.prank(player2);
        han.joinGame{value: ENTRY_FEE}(1);

        vm.warp(block.timestamp + 25 hours);
        vm.prank(host);
        han.timeoutRefund(1);
        vm.prank(player2);
        han.timeoutRefund(1);

        (,,,,, uint8 status,,,) = han.getRoom(1);
        assertEq(status, han.STATUS_TIMED_OUT());
    }

    function test_settleGame_rejectsAfterPartialRefund() public {
        _createRoom(1, 2);
        vm.prank(player2);
        han.joinGame{value: ENTRY_FEE}(1);

        vm.warp(block.timestamp + 25 hours);
        vm.prank(host);
        han.timeoutRefund(1);

        vm.prank(authority);
        vm.expectRevert(HanErrors.RefundAlreadyClaimed.selector);
        han.settleGame(1, host);
    }
}
