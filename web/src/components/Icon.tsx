import type { ReactNode } from 'react';

const ICONS = {
  sun: (
    <>
      <circle cx="8" cy="8" r="3" />
      <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3 3l1 1M12 12l1 1M3 13l1-1M12 4l1-1" />
    </>
  ),
  moon: <path d="M13.5 9.5A5.5 5.5 0 0 1 6.5 2.5a5.5 5.5 0 1 0 7 7z" />,
  check: <path d="M3 8.5l3 3 7-7" />,
  x: <path d="M4 4l8 8M12 4l-8 8" />,
  dot: <circle cx="8" cy="8" r="2.5" />,
  chevron: <path d="M6 3l5 5-5 5" />,
  arrow: <path d="M3 8h10M9 4l4 4-4 4" />,
  play: <path d="M5 3l8 5-8 5z" />,
  skip: <path d="M3 3l6 5-6 5zM10 3v10M13 3v10" />,
  stop: <rect x="4" y="4" width="8" height="8" rx="1" />,
  alert: <path d="M8 2l6.5 11.5h-13zM8 6.5v3M8 11.5v.5" />,
  info: <path d="M8 14.5A6.5 6.5 0 1 0 8 1.5a6.5 6.5 0 0 0 0 13zM8 7v4M8 4.8v.4" />,
  wait: <path d="M8 14.5A6.5 6.5 0 1 0 8 1.5a6.5 6.5 0 0 0 0 13zM8 4.5V8l2.5 1.5" />,
  spinner: <path d="M8 1.5A6.5 6.5 0 1 1 1.5 8" />,
  user: <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2.5 14.5c.6-2.8 2.8-4.5 5.5-4.5s4.9 1.7 5.5 4.5" />,
  shield: <path d="M8 1.5l5.5 2v4.2c0 3.3-2.3 5.8-5.5 6.8-3.2-1-5.5-3.5-5.5-6.8V3.5z" />,
  table: <path d="M2 3h12v10H2zM2 6.5h12M2 10h12M6 3v10" />,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof ICONS;

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  /** Without a title the icon is decorative and hidden from screen readers. */
  title?: string;
}

export function Icon({ name, size = 16, className, title }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={!title || undefined}
      role={title ? 'img' : undefined}
      style={{ flex: 'none' }}
    >
      {title && <title>{title}</title>}
      {ICONS[name]}
    </svg>
  );
}

export const Spinner = ({ size = 16 }: { size?: number }) => <Icon name="spinner" size={size} className="spin" />;
