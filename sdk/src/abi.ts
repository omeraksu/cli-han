import hanAbiJson from '../abi/han.json' with { type: 'json' };
import hanTipRouterAbiJson from '../abi/hanTipRouter.json' with { type: 'json' };
import type { Abi } from 'abitype';

export const hanAbi = hanAbiJson as Abi;
export const hanTipRouterAbi = hanTipRouterAbiJson as Abi;
