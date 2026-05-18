import React from 'react';
import { Box, Text, useInput } from 'ink';
import { colors } from './colors.js';

export type TipState = 'confirm' | 'pending' | 'sent' | 'error';

interface TipDialogProps {
  recipient: string;
  recipientPubkey?: string;
  amount: number;
  network: string;
  state: TipState;
  signature?: string;
  explorerUrl?: string;
  errorMessage?: string;
  focused?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function truncatePubkey(pubkey: string, head: number = 3, tail: number = 3): string {
  if (pubkey.length <= head + tail + 3) return pubkey;
  return `${pubkey.slice(0, head)}...${pubkey.slice(-tail)}`;
}

/**
 * Tip flow modal matching figma frame 10:128.
 *
 * Three states: `confirm` shows a structured box with recipient/amount/
 * network plus `[Y]/[N]` hints; `pending` is a small spinner-less wait
 * label; `sent` flips to the success view with signature, explorer link,
 * and a thank-you note in amber.
 */
export function TipDialog({
  recipient,
  recipientPubkey,
  amount,
  network,
  state,
  signature,
  explorerUrl,
  errorMessage,
  focused = true,
  onConfirm,
  onCancel,
}: TipDialogProps): React.JSX.Element {
  useInput(
    (input, key) => {
      if (state !== 'confirm') return;
      const lower = input?.toLowerCase();
      if (lower === 'y' || key.return) {
        onConfirm();
        return;
      }
      if (lower === 'n' || key.escape) {
        onCancel();
      }
    },
    { isActive: focused && state === 'confirm' }
  );

  const pubkeyHint = recipientPubkey ? `  (${truncatePubkey(recipientPubkey)})` : '';

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Box marginBottom={1}>
        <Text color={colors.accent} bold>
          ▮ han · tip · {recipient}
        </Text>
      </Box>

      {state === 'confirm' || state === 'pending' ? (
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor={colors.border}
          paddingX={2}
          paddingY={1}
        >
          <Text color={colors.foreground}>
            {'to        '}
            {recipient}
            {pubkeyHint}
          </Text>
          <Text color={colors.foreground}>
            {'amount    '}
            {amount} SOL
          </Text>
          <Text color={colors.foreground}>
            {'network   '}
            {network}
          </Text>
          <Box marginTop={1}>
            {state === 'pending' ? (
              <Text color={colors.dim}>sending…</Text>
            ) : (
              <Text color={colors.info} bold>
                [ Y ] confirm{'     '}[ N ] cancel
              </Text>
            )}
          </Box>
        </Box>
      ) : null}

      {state === 'sent' ? (
        <Box flexDirection="column" marginTop={1}>
          <Text color={colors.success} bold>
            ✓ sent.
          </Text>
          {signature ? (
            <Box marginTop={1}>
              <Text color={colors.dim}>
                sig: {truncatePubkey(signature, 24, 4)}
              </Text>
            </Box>
          ) : null}
          {explorerUrl ? (
            <Box>
              <Text color={colors.info}>{explorerUrl}</Text>
            </Box>
          ) : null}
          <Box marginTop={1}>
            <Text color={colors.highlight}>thanks for supporting the build 🔥</Text>
          </Box>
        </Box>
      ) : null}

      {state === 'error' ? (
        <Box marginTop={1}>
          <Text color={colors.error} bold>
            ✗ {errorMessage ?? 'transfer failed'}
          </Text>
        </Box>
      ) : null}
    </Box>
  );
}
