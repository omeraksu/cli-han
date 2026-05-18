// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";

import {HanTipRouter} from "../src/HanTipRouter.sol";
import {HanErrors} from "../src/libraries/HanErrors.sol";

contract HanTipRouterTest is Test {
    HanTipRouter internal router;
    address internal feeReceiver = makeAddr("feeReceiver");
    address internal streamer = makeAddr("streamer");
    address internal viewer = makeAddr("viewer");

    uint16 internal constant FEE_BPS = 300;

    function setUp() public {
        router = new HanTipRouter(FEE_BPS, feeReceiver);
        vm.deal(viewer, 10 ether);
    }

    function test_constructor_setsState() public view {
        assertEq(router.feeBps(), FEE_BPS);
        assertEq(router.feeReceiver(), feeReceiver);
    }

    function test_constructor_rejectsHighFee() public {
        vm.expectRevert(HanErrors.FeeBpsTooHigh.selector);
        new HanTipRouter(1001, feeReceiver);
    }

    function test_constructor_rejectsZeroReceiver() public {
        vm.expectRevert(HanErrors.ZeroAddress.selector);
        new HanTipRouter(FEE_BPS, address(0));
    }

    function test_tip_splitsCorrectly() public {
        uint256 amount = 0.1 ether;
        uint256 expectedFee = (amount * FEE_BPS) / 10_000;
        uint256 expectedStreamer = amount - expectedFee;

        uint256 feeBefore = feeReceiver.balance;
        uint256 streamerBefore = streamer.balance;

        vm.prank(viewer);
        router.tip{value: amount}(streamer);

        assertEq(feeReceiver.balance, feeBefore + expectedFee);
        assertEq(streamer.balance, streamerBefore + expectedStreamer);
        assertEq(address(router).balance, 0);
    }

    function test_tip_rejectsZeroStreamer() public {
        vm.prank(viewer);
        vm.expectRevert(HanErrors.ZeroAddress.selector);
        router.tip{value: 0.01 ether}(address(0));
    }

    function test_tip_rejectsZeroValue() public {
        vm.prank(viewer);
        vm.expectRevert(HanErrors.NoRefundAvailable.selector);
        router.tip{value: 0}(streamer);
    }

    function test_tip_emitsEvent() public {
        uint256 amount = 0.05 ether;
        uint256 fee = (amount * FEE_BPS) / 10_000;

        vm.prank(viewer);
        vm.expectEmit(true, true, false, true);
        emit HanTipRouter.Tipped(viewer, streamer, amount, fee, amount - fee);
        router.tip{value: amount}(streamer);
    }

    function testFuzz_tip_alwaysSplits(uint96 amount) public {
        vm.assume(amount > 0 && amount < 1000 ether);
        vm.deal(viewer, amount);

        uint256 expectedFee = (uint256(amount) * FEE_BPS) / 10_000;
        uint256 expectedStreamer = uint256(amount) - expectedFee;

        vm.prank(viewer);
        router.tip{value: amount}(streamer);

        assertEq(feeReceiver.balance, expectedFee);
        assertEq(streamer.balance, expectedStreamer);
    }
}
