const PATHS = {
  home: 'M3 11.5 12 3l9 8.5M5.5 9.5V21h13V9.5',
  undo: 'M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-4',
  eraser: 'M15.5 3.5 21 9 10.5 19.5H6L3 16.5Z M8.5 10l6 6 M11 19.5h10',
  restart: 'M6 3h9l4 4v14H6Z M15 3v4h4',
  repeat: 'M4 4.5h16v11H11l-5 4.5v-4.5H4Z M8.5 10h.01 M12 10h.01 M15.5 10h.01',
  speaker: 'M4 9h4l5-4v14l-5-4H4Z M16.5 9a4 4 0 0 1 0 6 M19 6.5a8 8 0 0 1 0 11',
  mute: 'M4 9h4l5-4v14l-5-4H4Z M16 9l6 6 M22 9l-6 6',
  check: 'M5 12.5 10 17.5 19.5 7',
  close: 'M6 6l12 12M18 6 6 18',
}

export type IconName = keyof typeof PATHS

export function Icon({ name, size = 36 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
