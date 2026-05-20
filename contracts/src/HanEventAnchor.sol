// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {HanErrors} from "./libraries/HanErrors.sol";

/// @notice Han events on-chain anchor — provenance for submission archives
///         and the verified builder graph (deck slide 10: "what you keep").
/// @dev Event-log only; no storage. Off-chain indexers reconstruct the
///      submission + attestation history. This keeps gas costs bounded
///      whether an event has 30 builders or 3000.
///
///      Two anchor types share one contract because they share the same
///      (eventKey, dataHash) provenance pattern — only the authorization
///      differs (hub-signed submissions vs. builder-signed attestations).
contract HanEventAnchor {
    /// @notice Wallet permitted to anchor submissions on behalf of organizers.
    /// @dev The hub authority signs submission anchors so organizers don't
    ///      need to hold AVAX for routine archival. Builder attestations are
    ///      always self-signed (msg.sender = builder) and need no authority.
    address public immutable authority;

    /// @notice Emitted when a submission is anchored. eventKey is
    ///         keccak256("han.event:" || event.slug) computed off-chain.
    event SubmissionAnchored(
        bytes32 indexed eventKey,
        address indexed team,
        bytes32 dataHash,
        uint64 timestamp
    );

    /// @notice Emitted when a builder self-attests participation. role is
    ///         a small enum (organizer=0, judge=1, mentor=2, instructor=3,
    ///         builder=4, spectator=5) mirroring the off-chain EventMember
    ///         table — kept inline so indexers don't need to join.
    event AttestationAnchored(
        bytes32 indexed eventKey,
        address indexed builder,
        uint8 role,
        bytes32 dataHash,
        uint64 timestamp
    );

    constructor(address _authority) {
        if (_authority == address(0)) revert HanErrors.ZeroAddress();
        authority = _authority;
    }

    /// @notice Anchor an organizer-approved submission. authority-only.
    /// @param eventKey keccak256("han.event:" || event.slug)
    /// @param team    Wallet of the submitting team lead (informational).
    /// @param dataHash keccak256 of the submission JSON (title+summary+repo+demo).
    function anchorSubmission(bytes32 eventKey, address team, bytes32 dataHash) external {
        if (msg.sender != authority) revert HanErrors.UnauthorizedSettler();
        if (team == address(0)) revert HanErrors.ZeroAddress();
        emit SubmissionAnchored(eventKey, team, dataHash, uint64(block.timestamp));
    }

    /// @notice Builder self-attests participation in an event under a role.
    /// @dev msg.sender is the builder; no authority gate. Replay is fine —
    ///      events are append-only provenance.
    function anchorAttestation(bytes32 eventKey, uint8 role, bytes32 dataHash) external {
        emit AttestationAnchored(eventKey, msg.sender, role, dataHash, uint64(block.timestamp));
    }
}
