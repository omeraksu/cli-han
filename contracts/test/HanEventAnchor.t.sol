// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";

import {HanEventAnchor} from "../src/HanEventAnchor.sol";
import {HanErrors} from "../src/libraries/HanErrors.sol";

contract HanEventAnchorTest is Test {
    HanEventAnchor internal anchor;

    address internal authority = makeAddr("authority");
    address internal builder = makeAddr("builder");
    address internal team = makeAddr("team");
    address internal organizer = makeAddr("organizer");

    bytes32 internal constant EVENT_KEY = keccak256("han.event:smoke-pilot");
    bytes32 internal constant DATA_HASH = keccak256("submission#1");

    event SubmissionAnchored(
        bytes32 indexed eventKey, address indexed team, bytes32 dataHash, uint64 timestamp
    );

    event AttestationAnchored(
        bytes32 indexed eventKey,
        address indexed builder,
        uint8 role,
        bytes32 dataHash,
        uint64 timestamp
    );

    function setUp() public {
        anchor = new HanEventAnchor(authority);
    }

    function test_constructor_setsAuthority() public view {
        assertEq(anchor.authority(), authority);
    }

    function test_constructor_rejectsZeroAuthority() public {
        vm.expectRevert(HanErrors.ZeroAddress.selector);
        new HanEventAnchor(address(0));
    }

    function test_anchorSubmission_byAuthority_emits() public {
        vm.warp(1_700_000_000);
        vm.expectEmit(true, true, false, true);
        emit SubmissionAnchored(EVENT_KEY, team, DATA_HASH, uint64(block.timestamp));

        vm.prank(authority);
        anchor.anchorSubmission(EVENT_KEY, team, DATA_HASH);
    }

    function test_anchorSubmission_rejectsNonAuthority() public {
        vm.prank(builder);
        vm.expectRevert(HanErrors.UnauthorizedSettler.selector);
        anchor.anchorSubmission(EVENT_KEY, team, DATA_HASH);
    }

    function test_anchorSubmission_rejectsZeroTeam() public {
        vm.prank(authority);
        vm.expectRevert(HanErrors.ZeroAddress.selector);
        anchor.anchorSubmission(EVENT_KEY, address(0), DATA_HASH);
    }

    function test_anchorAttestation_byBuilder_emits() public {
        vm.warp(1_700_000_000);
        uint8 role = 4; // builder
        vm.expectEmit(true, true, false, true);
        emit AttestationAnchored(EVENT_KEY, builder, role, DATA_HASH, uint64(block.timestamp));

        vm.prank(builder);
        anchor.anchorAttestation(EVENT_KEY, role, DATA_HASH);
    }

    function test_anchorAttestation_anyRole_anyone() public {
        // Anyone can self-attest under any role. The trust is in the
        // msg.sender that gets indexed; off-chain layers decide what to
        // honor (e.g. only attestations where role matches the off-chain
        // EventMember row).
        for (uint8 role = 0; role <= 5; role++) {
            vm.prank(organizer);
            anchor.anchorAttestation(EVENT_KEY, role, DATA_HASH);
        }
    }

    function testFuzz_anchorSubmission_eventEmitMatches(
        bytes32 eventKey,
        address teamAddr,
        bytes32 dataHash
    ) public {
        vm.assume(teamAddr != address(0));
        vm.warp(1_700_000_000);
        vm.expectEmit(true, true, false, true);
        emit SubmissionAnchored(eventKey, teamAddr, dataHash, uint64(block.timestamp));

        vm.prank(authority);
        anchor.anchorSubmission(eventKey, teamAddr, dataHash);
    }
}
