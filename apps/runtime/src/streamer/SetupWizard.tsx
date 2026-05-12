import React, { useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { Avatar } from '../ui/Avatar.js';
import { colors } from '../ui/colors.js';

interface SetupResult {
  handle: string;
  bio?: string;
}

interface SetupWizardProps {
  pubkey: string;
  onComplete: (profile: SetupResult) => void;
  onCancel: () => void;
}

const HANDLE_PATTERN = /^[a-zA-Z0-9_-]{2,32}$/;

export function SetupWizard({ pubkey, onComplete, onCancel }: SetupWizardProps): React.JSX.Element {
  const [handle, setHandle] = useState('');
  const [bio, setBio] = useState('');
  const [field, setField] = useState<'handle' | 'bio'>('handle');
  const { exit } = useApp();

  const handleValid = HANDLE_PATTERN.test(handle);

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      exit();
      return;
    }
    if (key.tab) {
      setField((f) => (f === 'handle' ? 'bio' : 'handle'));
      return;
    }
    if (key.return) {
      if (field === 'handle' && handleValid) {
        setField('bio');
        return;
      }
      if (handleValid) {
        onComplete({ handle: handle.trim(), bio: bio.trim() || undefined });
        exit();
      }
      return;
    }
    if (key.backspace || key.delete) {
      if (field === 'handle') setHandle((s) => s.slice(0, -1));
      else setBio((s) => s.slice(0, -1));
      return;
    }
    if (input && !key.ctrl && !key.meta) {
      if (field === 'handle') {
        if (handle.length < 32) setHandle((s) => s + input);
      } else if (bio.length < 80) {
        setBio((s) => s + input);
      }
    }
  });

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text color={colors.accent} bold>
        ▮ welcome to han
      </Text>
      <Box marginTop={1}>
        <Text color={colors.dim}>wallet connected · </Text>
        <Text color={colors.foreground}>{pubkey.slice(0, 16)}...</Text>
      </Box>

      <Box marginTop={2}>
        <Box marginRight={2}>
          <Avatar pubkey={pubkey} />
        </Box>
        <Box flexDirection="column">
          <Text color={colors.foreground} bold>
            your ascii avatar
          </Text>
          <Text color={colors.dim}>derived from your pubkey.</Text>
          <Text color={colors.dim}>same wallet → same avatar.</Text>
        </Box>
      </Box>

      <Box marginTop={2} flexDirection="column">
        <Text color={colors.foreground}>pick a handle</Text>
        <Box>
          <Text color={field === 'handle' ? colors.accent : colors.dim} bold>
            {field === 'handle' ? '> ' : '  '}
          </Text>
          <Text color={colors.foreground}>@{handle}</Text>
          {field === 'handle' ? (
            <Text color={colors.foreground} inverse>
              {' '}
            </Text>
          ) : null}
          {handleValid ? (
            <Text color={colors.success}>{'   ✓ available'}</Text>
          ) : handle.length > 0 ? (
            <Text color={colors.dim}>{'   · 2-32 chars, [a-z0-9_-]'}</Text>
          ) : null}
        </Box>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text color={colors.foreground}>add a one-liner (optional)</Text>
        <Box>
          <Text color={field === 'bio' ? colors.accent : colors.dim} bold>
            {field === 'bio' ? '> ' : '  '}
          </Text>
          <Text color={colors.foreground}>{bio}</Text>
          {field === 'bio' ? (
            <Text color={colors.foreground} inverse>
              {' '}
            </Text>
          ) : null}
        </Box>
        <Text color={colors.dim}>  {bio.length} / 80 chars</Text>
      </Box>

      <Box marginTop={2}>
        <Text color={colors.info} bold>
          [ TAB ] next field  [ ENTER ] save & enter han  [ ESC ] cancel
        </Text>
      </Box>
    </Box>
  );
}
