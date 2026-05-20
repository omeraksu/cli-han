import hanAbiJson from '../abi/han.json' with { type: 'json' };
import hanTipRouterAbiJson from '../abi/hanTipRouter.json' with { type: 'json' };
import hanEventAnchorAbiJson from '../abi/hanEventAnchor.json' with { type: 'json' };
import type { Abi } from 'abitype';

export const hanAbi = hanAbiJson as Abi;
export const hanTipRouterAbi = hanTipRouterAbiJson as Abi;
export const hanEventAnchorAbi = hanEventAnchorAbiJson as Abi;
