interface Props {
  value: string | number;
  label: string;
  tone?: 'cream' | 'ember' | 'teal' | 'amber';
}

const toneClass: Record<NonNullable<Props['tone']>, string> = {
  cream: 'text-cream',
  ember: 'text-ember',
  teal: 'text-teal',
  amber: 'text-amber',
};

export function LiveStat({ value, label, tone = 'cream' }: Props): React.ReactElement {
  return (
    <div className="px-2">
      <div className={`font-mono text-5xl font-semibold ${toneClass[tone]}`}>{value}</div>
      <div className="wm-mono text-xs text-dim mt-1">{label}</div>
    </div>
  );
}
