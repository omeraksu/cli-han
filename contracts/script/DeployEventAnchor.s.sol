// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";

import {HanEventAnchor} from "../src/HanEventAnchor.sol";

contract DeployEventAnchor is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address authority = vm.envAddress("HUB_AUTHORITY_ADDRESS");

        address deployer = vm.addr(deployerKey);
        console2.log("deployer", deployer);
        console2.log("authority", authority);

        vm.startBroadcast(deployerKey);
        HanEventAnchor anchor = new HanEventAnchor(authority);
        vm.stopBroadcast();

        console2.log("HAN_EVENT_ANCHOR_ADDRESS", address(anchor));
    }
}
