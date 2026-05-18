// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";

import {Han} from "../src/Han.sol";

contract HanFuzzTest is Test {
    Han internal han;

    address internal owner = makeAddr("owner");
    address internal authority = makeAddr("authority");
    address internal feeReceiver = makeAddr("feeReceiver");

    function setUp() public {
        vm.prank(owner);
        han = new Han(300, feeReceiver, authority, owner);
    }

    function testFuzz_createGameRoom_validInputs(
        uint256 roomId,
        uint128 entryFee,
        uint8 maxPlayers
    ) public {
        entryFee = uint128(bound(uint256(entryFee), han.MIN_ENTRY_FEE(), han.MAX_ENTRY_FEE()));
        maxPlayers = uint8(bound(uint256(maxPlayers), 2, han.MAX_PLAYERS()));

        address host = makeAddr("host");
        vm.deal(host, uint256(entryFee));

        vm.prank(host);
        han.createGameRoom{value: entryFee}(roomId, bytes32("g"), entryFee, maxPlayers);

        (address h,, uint128 fee, uint8 max, uint8 count,,,,) = han.getRoom(roomId);
        assertEq(h, host);
        assertEq(fee, entryFee);
        assertEq(max, maxPlayers);
        assertEq(count, 1);
    }

    function testFuzz_settleGame_preservesBalance(uint8 numPlayers, uint128 entryFee) public {
        numPlayers = uint8(bound(uint256(numPlayers), 2, han.MAX_PLAYERS()));
        entryFee = uint128(bound(uint256(entryFee), han.MIN_ENTRY_FEE(), han.MAX_ENTRY_FEE()));

        address[] memory players = new address[](numPlayers);
        for (uint8 i = 0; i < numPlayers; i++) {
            players[i] = address(uint160(0x1000 + i));
            vm.deal(players[i], uint256(entryFee));
        }

        uint256 roomId = 42;
        vm.prank(players[0]);
        han.createGameRoom{value: entryFee}(roomId, bytes32("g"), entryFee, numPlayers);
        for (uint8 i = 1; i < numPlayers; i++) {
            vm.prank(players[i]);
            han.joinGame{value: entryFee}(roomId);
        }

        uint256 winnerBefore = players[0].balance;
        uint256 feeBefore = feeReceiver.balance;

        vm.prank(authority);
        han.settleGame(roomId, players[0]);

        uint256 pot = uint256(entryFee) * numPlayers;
        uint256 fee = (pot * han.feeBps()) / 10_000;
        uint256 payout = pot - fee;

        assertEq(players[0].balance, winnerBefore + payout);
        assertEq(feeReceiver.balance, feeBefore + fee);
        assertEq(address(han).balance, 0);
    }
}
