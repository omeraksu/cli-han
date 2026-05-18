// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";

import {Han} from "../src/Han.sol";
import {HanTipRouter} from "../src/HanTipRouter.sol";

contract DeployFuji is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address feeReceiver = vm.envAddress("HAN_FEE_RECEIVER_ADDRESS");
        address authority = vm.envAddress("HUB_AUTHORITY_ADDRESS");
        uint16 feeBps = uint16(vm.envOr("HAN_FEE_BPS", uint256(300)));

        address deployer = vm.addr(deployerKey);
        console2.log("deployer", deployer);
        console2.log("feeReceiver", feeReceiver);
        console2.log("authority", authority);
        console2.log("feeBps", feeBps);

        vm.startBroadcast(deployerKey);
        Han han = new Han(feeBps, feeReceiver, authority, deployer);
        HanTipRouter router = new HanTipRouter(feeBps, feeReceiver);
        vm.stopBroadcast();

        console2.log("HAN_CONTRACT_ADDRESS", address(han));
        console2.log("HAN_TIP_ROUTER_ADDRESS", address(router));
    }
}
