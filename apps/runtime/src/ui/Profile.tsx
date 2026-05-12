import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { colors } from './colors.js';
import { Avatar } from './Avatar.js';

export interface HanProfileStats {
  streamsHosted: number;
  hoursStreamed: number;
  tipsReceivedUsdc: number;
  gamesPlayed: number;
  gamesWon: number;
  potEarnedUsdc: number;
}

export interface HanProfile {
  pubkey: string;
  handle: string;
  displayName?: string;
  bio?: string;
  link?: string;
  domain?: string;
  memberSince?: string;
  isLive?: boolean;
  liveDuration?: string;
  viewerCount?: number;
  stats?: HanProfileStats;
}

export type ProfileView = 'view-self' | 'view-other' | 'edit' | 'settings';

interface ProfileScreenProps {
  view: ProfileView;
  profile: HanProfile;
  focused?: boolean;
  onEdit?: () => void;
  onSettings?: () => void;
  onWatchStream?: () => void;
  onTip?: () => void;
  onBack?: () => void;
  onSubmitEdit?: (next: HanProfile) => void;
}

function truncatePubkey(pubkey: string): string {
  if (pubkey.length <= 24) return pubkey;
  return `${pubkey.slice(0, 12)}...${pubkey.slice(-8)}`;
}

function StatCell({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Box flexDirection="column" marginRight={6}>
      <Text color={colors.dim}>{label}</Text>
      <Text color={colors.foreground} bold>
        {value}
      </Text>
      {sub ? <Text color={colors.dim}>{sub}</Text> : null}
    </Box>
  );
}

function StatsBlock({ stats }: { stats: HanProfileStats }) {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color={colors.accent}>/ stats</Text>
      <Box marginTop={1}>
        <StatCell label="streams hosted" value={String(stats.streamsHosted)} />
        <StatCell label="hours streamed" value={String(stats.hoursStreamed)} />
        <StatCell label="tips received" value={`${stats.tipsReceivedUsdc.toFixed(1)} USDC`} />
      </Box>
      <Box marginTop={1}>
        <StatCell label="games played" value={String(stats.gamesPlayed)} />
        <StatCell label="games won" value={String(stats.gamesWon)} />
        <StatCell label="pot earned" value={`${stats.potEarnedUsdc.toFixed(1)} USDC`} />
      </Box>
    </Box>
  );
}

function ProfileHeader({ profile, ownerLabel }: { profile: HanProfile; ownerLabel: string }) {
  return (
    <Box marginTop={1}>
      <Box marginRight={2}>
        <Avatar pubkey={profile.pubkey} />
      </Box>
      <Box flexDirection="column">
        <Box>
          <Text color={colors.foreground} bold>
            @{profile.handle}
          </Text>
          <Text color={colors.dim}> · {ownerLabel}</Text>
        </Box>
        {profile.domain ? (
          <Text color={colors.foreground}>{profile.domain}</Text>
        ) : null}
        <Text color={colors.dim}>{truncatePubkey(profile.pubkey)}</Text>
        {profile.bio ? <Text color={colors.foreground}>{profile.bio}</Text> : null}
      </Box>
    </Box>
  );
}

function ViewOther({ profile, onWatchStream, onTip, onBack, focused }: ProfileScreenProps) {
  useInput(
    (input) => {
      const lower = input?.toLowerCase();
      if (lower === 'w' && onWatchStream) return onWatchStream();
      if (lower === 't' && onTip) return onTip();
      if (lower === 'b' && onBack) return onBack();
    },
    { isActive: focused !== false }
  );

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <ProfileHeader profile={profile} ownerLabel={`/profile ${profile.handle}`} />

      {profile.isLive ? (
        <Box marginTop={1}>
          <Text color={colors.success}>◉ live now</Text>
          <Text color={colors.dim}>
            {' '}
            · streaming for {profile.liveDuration ?? '0m'} ·{' '}
            {profile.viewerCount ?? 0} viewers
          </Text>
        </Box>
      ) : null}

      <Box marginTop={1}>
        <Text color={colors.border}>{'─'.repeat(48)}</Text>
      </Box>

      {profile.stats ? <StatsBlock stats={profile.stats} /> : null}

      {profile.link ? (
        <Box marginTop={2} flexDirection="column">
          <Text color={colors.accent}>links</Text>
          <Text color={colors.foreground}>{profile.link}</Text>
        </Box>
      ) : null}

      <Box marginTop={2}>
        <Text color={colors.info} bold>
          [ W ] watch stream  [ T ] tip  [ B ] back
        </Text>
      </Box>
    </Box>
  );
}

function ViewSelf({ profile, onEdit, onSettings, onBack, focused }: ProfileScreenProps) {
  useInput(
    (input) => {
      const lower = input?.toLowerCase();
      if (lower === 'e' && onEdit) return onEdit();
      if (lower === 's' && onSettings) return onSettings();
      if (lower === 'b' && onBack) return onBack();
    },
    { isActive: focused !== false }
  );

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <ProfileHeader profile={profile} ownerLabel="this is you" />

      {profile.memberSince ? (
        <Box marginTop={1}>
          <Text color={colors.dim}>member since · {profile.memberSince}</Text>
        </Box>
      ) : null}

      <Box marginTop={1}>
        <Text color={colors.border}>{'─'.repeat(48)}</Text>
      </Box>

      {profile.stats ? <StatsBlock stats={profile.stats} /> : null}

      {profile.link ? (
        <Box marginTop={2} flexDirection="column">
          <Text color={colors.accent}>links</Text>
          <Text color={colors.foreground}>{profile.link}</Text>
        </Box>
      ) : null}

      <Box marginTop={2}>
        <Text color={colors.info} bold>
          [ E ] edit profile  [ S ] settings  [ B ] back
        </Text>
      </Box>
    </Box>
  );
}

function ProfileEdit({ profile, onSubmitEdit, onBack, focused }: ProfileScreenProps) {
  const [handle, setHandle] = useState(profile.handle);
  const [displayName, setDisplayName] = useState(profile.displayName ?? '');
  const [bio, setBio] = useState(profile.bio ?? '');
  const [link, setLink] = useState(profile.link ?? '');
  const [field, setField] = useState<0 | 1 | 2 | 3>(0);

  useInput(
    (input, key) => {
      if (key.tab) {
        setField((f) => (((f as number) + 1) % 4) as 0 | 1 | 2 | 3);
        return;
      }
      if (key.escape) {
        if (onBack) onBack();
        return;
      }
      if (key.ctrl && input === 's') {
        if (onSubmitEdit) {
          onSubmitEdit({
            ...profile,
            handle: handle.trim() || profile.handle,
            displayName: displayName.trim() || undefined,
            bio: bio.trim() || undefined,
            link: link.trim() || undefined,
          });
        }
        return;
      }
      if (key.backspace || key.delete) {
        if (field === 0) setHandle((s) => s.slice(0, -1));
        if (field === 1) setDisplayName((s) => s.slice(0, -1));
        if (field === 2) setBio((s) => s.slice(0, -1));
        if (field === 3) setLink((s) => s.slice(0, -1));
        return;
      }
      if (input && !key.ctrl && !key.meta && !key.escape) {
        if (field === 0) setHandle((s) => s + input);
        if (field === 1) setDisplayName((s) => s + input);
        if (field === 2) setBio((s) => s + input);
        if (field === 3) setLink((s) => s + input);
      }
    },
    { isActive: focused !== false }
  );

  function renderField(label: string, value: string, idx: number) {
    const active = field === idx;
    return (
      <Box flexDirection="column" marginTop={1}>
        <Text color={colors.dim}>{label}</Text>
        <Box>
          <Text color={active ? colors.accent : colors.dim} bold>
            {active ? '> ' : '  '}
          </Text>
          <Text color={colors.foreground}>{value}</Text>
          {active ? (
            <Text color={colors.foreground} inverse>
              {' '}
            </Text>
          ) : null}
        </Box>
      </Box>
    );
  }

  const bioLength = bio.length;
  const bioMax = 80;

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text color={colors.accent} bold>
        ▮ edit profile
      </Text>
      <Box marginTop={1}>
        <Text color={colors.dim}>
          changes save off-chain. avatar derived from pubkey.
        </Text>
      </Box>

      {renderField('handle', `@${handle}`, 0)}
      {renderField('display name (optional)', displayName, 1)}
      {renderField('bio (one line)', bio, 2)}
      <Box>
        <Text color={colors.dim}>  {bioLength} / {bioMax} chars</Text>
      </Box>
      {renderField('links', link, 3)}

      <Box marginTop={2}>
        <Text color={colors.info} bold>
          [ TAB ] next field  [ Ctrl+S ] save  [ ESC ] cancel
        </Text>
      </Box>
    </Box>
  );
}

function Settings({ profile, onBack, focused }: ProfileScreenProps) {
  const [privacyOn, setPrivacyOn] = useState(true);
  const [summarizerMode, setSummarizerMode] = useState<'off' | 'low' | 'medium' | 'high'>(
    'medium'
  );
  const [selected, setSelected] = useState<0 | 1>(0);

  useInput(
    (input, key) => {
      if (key.escape || input?.toLowerCase() === 'b') {
        if (onBack) onBack();
        return;
      }
      if (key.upArrow) setSelected(0);
      if (key.downArrow) setSelected(1);
      if (key.return) {
        if (selected === 0) setPrivacyOn((v) => !v);
        if (selected === 1) {
          const cycle: Array<'off' | 'low' | 'medium' | 'high'> = ['off', 'low', 'medium', 'high'];
          setSummarizerMode((current) => {
            const idx = cycle.indexOf(current);
            return cycle[(idx + 1) % cycle.length] ?? 'medium';
          });
        }
      }
    },
    { isActive: focused !== false }
  );

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text color={colors.accent} bold>
        ▮ settings
      </Text>

      <Box marginTop={1}>
        <Text color={colors.accent}>/ privacy</Text>
      </Box>

      <Box marginTop={1} justifyContent="space-between">
        <Box flexDirection="column">
          <Text color={selected === 0 ? colors.accent : colors.foreground} bold>
            {selected === 0 ? '▸ ' : '  '}privacy filters
          </Text>
          <Text color={colors.dim}>  redact secrets in stream before sending</Text>
        </Box>
        <Box flexDirection="column" alignItems="flex-end">
          <Text color={privacyOn ? colors.success : colors.dim} bold>
            [ {privacyOn ? 'ON' : 'OFF'} ]
          </Text>
          <Text color={colors.dim}>default</Text>
        </Box>
      </Box>

      <Box marginTop={1} justifyContent="space-between">
        <Box flexDirection="column">
          <Text color={selected === 1 ? colors.accent : colors.foreground} bold>
            {selected === 1 ? '▸ ' : '  '}summarizer mode
          </Text>
          <Text color={colors.dim}>  how often ai feed updates</Text>
        </Box>
        <Box flexDirection="column" alignItems="flex-end">
          <Text color={colors.info} bold>
            [ {summarizerMode} ]
          </Text>
          <Text color={colors.dim}>{summarizerMode === 'medium' ? '10s window' : '—'}</Text>
        </Box>
      </Box>

      <Box marginTop={2}>
        <Text color={colors.border}>{'─'.repeat(48)}</Text>
      </Box>

      <Box marginTop={1}>
        <Text color={colors.accent}>/ wallet</Text>
      </Box>
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={colors.border}
        paddingX={2}
        paddingY={1}
        marginTop={1}
      >
        <Text color={colors.foreground} bold>
          ◆ local keypair
        </Text>
        <Text color={colors.foreground}>{truncatePubkey(profile.pubkey)}</Text>
        <Text color={colors.dim}>connected · devnet</Text>
      </Box>

      <Box marginTop={2}>
        <Text color={colors.info} bold>
          [ ↑↓ ] navigate  [ ENTER ] toggle  [ B ] back
        </Text>
      </Box>
    </Box>
  );
}

/**
 * Profile screen matching figma frames 26:39 / 26:73 / 26:107 / 26:132.
 *
 * Single component, branches on `view`. Setup (26:12) ships with the
 * onboarding wizard (Sprint 3.4) — it has a different flow and lives in
 * its own component.
 */
export function ProfileScreen(props: ProfileScreenProps): React.JSX.Element {
  switch (props.view) {
    case 'view-other':
      return <ViewOther {...props} />;
    case 'view-self':
      return <ViewSelf {...props} />;
    case 'edit':
      return <ProfileEdit {...props} />;
    case 'settings':
      return <Settings {...props} />;
    default:
      return <ViewSelf {...props} />;
  }
}
