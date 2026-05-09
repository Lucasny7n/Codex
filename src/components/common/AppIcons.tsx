export type UiIconName =
  | 'archive'
  | 'arrowLeft'
  | 'arrowUp'
  | 'book'
  | 'chart'
  | 'check'
  | 'chevronDown'
  | 'chevronLeft'
  | 'chevronRight'
  | 'copy'
  | 'desktop'
  | 'download'
  | 'edit'
  | 'file'
  | 'fileCode'
  | 'fileJson'
  | 'filePdf'
  | 'fileText'
  | 'folder'
  | 'folderPlus'
  | 'heart'
  | 'home'
  | 'image'
  | 'logout'
  | 'message'
  | 'mic'
  | 'more'
  | 'moveFromProject'
  | 'moveToProject'
  | 'music'
  | 'paperclip'
  | 'path'
  | 'pen'
  | 'pin'
  | 'plane'
  | 'plus'
  | 'refresh'
  | 'search'
  | 'send'
  | 'settings'
  | 'spark'
  | 'trash'
  | 'video'
  | 'x'
  | 'zip';

interface UiIconProps {
  name: UiIconName;
  className?: string;
}

export function UiIcon({ name, className = 'ui-icon' }: UiIconProps): JSX.Element {
  const paths = iconPaths[name];
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      {paths}
    </svg>
  );
}

const iconPaths: Record<UiIconName, JSX.Element> = {
  archive: (
    <>
      <path d="M4.5 7.5h15" />
      <path d="M6.5 7.5v10a1.8 1.8 0 0 0 1.8 1.8h7.4a1.8 1.8 0 0 0 1.8-1.8v-10" />
      <path d="M8.2 4.7h7.6a1.5 1.5 0 0 1 1.5 1.5v1.3H6.7V6.2a1.5 1.5 0 0 1 1.5-1.5Z" />
      <path d="M9.5 11h5" />
    </>
  ),
  arrowLeft: <path d="M19 12H6m5-5-5 5 5 5" />,
  arrowUp: <path d="M12 19V6m-5 5 5-5 5 5" />,
  book: (
    <>
      <path d="M5.5 5.8A2.3 2.3 0 0 1 7.8 4h10.7v15H7.8a2.3 2.3 0 0 1-2.3-2.3Z" />
      <path d="M5.5 16.6A2.2 2.2 0 0 1 7.7 14.5h10.8" />
    </>
  ),
  chart: (
    <>
      <path d="M4 19.5h16" />
      <path d="M7 16v-5" />
      <path d="M12 16V7" />
      <path d="M17 16v-8" />
    </>
  ),
  check: <path d="m5 12.5 4.1 4.1L19 6.8" />,
  chevronDown: <path d="m7 10 5 5 5-5" />,
  chevronLeft: <path d="m15 7-5 5 5 5" />,
  chevronRight: <path d="m9 7 5 5-5 5" />,
  copy: (
    <>
      <rect x="8" y="8" width="11" height="11" rx="2" />
      <path d="M5 15.5V6.8A1.8 1.8 0 0 1 6.8 5h8.7" />
    </>
  ),
  desktop: (
    <>
      <rect x="4" y="5" width="16" height="11" rx="2" />
      <path d="M9 20h6" />
      <path d="M12 16v4" />
    </>
  ),
  download: <path d="M12 4v11m-5-5 5 5 5-5M5 20h14" />,
  edit: (
    <>
      <path d="M5 19h4.2L18.5 9.7a2.1 2.1 0 0 0-3-3L6.2 16 5 19Z" />
      <path d="m14.2 8 1.8 1.8" />
    </>
  ),
  file: (
    <>
      <path d="M7 4.5h6.5L18 9v10.5H7Z" />
      <path d="M13.5 4.5V9H18" />
    </>
  ),
  fileCode: (
    <>
      <path d="M7 4.5h6.5L18 9v10.5H7Z" />
      <path d="M13.5 4.5V9H18" />
      <path d="m10.5 12-2 2 2 2" />
      <path d="m14.5 12 2 2-2 2" />
    </>
  ),
  fileJson: (
    <>
      <path d="M7 4.5h6.5L18 9v10.5H7Z" />
      <path d="M13.5 4.5V9H18" />
      <path d="M11 12.2c-1.1.2-1.6.8-1.6 1.8s.5 1.6 1.6 1.8" />
      <path d="M14 12.2c1.1.2 1.6.8 1.6 1.8s-.5 1.6-1.6 1.8" />
    </>
  ),
  filePdf: (
    <>
      <path d="M7 4.5h6.5L18 9v10.5H7Z" />
      <path d="M13.5 4.5V9H18" />
      <path d="M9.4 15.8v-4h1.2a1.2 1.2 0 0 1 0 2.4H9.4" />
      <path d="M13 15.8v-4h.9c1.1 0 1.8.8 1.8 2s-.7 2-1.8 2Z" />
    </>
  ),
  fileText: (
    <>
      <path d="M7 4.5h6.5L18 9v10.5H7Z" />
      <path d="M13.5 4.5V9H18" />
      <path d="M9.7 12h4.6" />
      <path d="M9.7 15h4.6" />
    </>
  ),
  folder: <path d="M3.8 7.8a2 2 0 0 1 2-2h4.4l2 2h6a2 2 0 0 1 2 2v6.4a2 2 0 0 1-2 2H5.8a2 2 0 0 1-2-2Z" />,
  folderPlus: (
    <>
      <path d="M3.8 7.8a2 2 0 0 1 2-2h4.4l2 2h6a2 2 0 0 1 2 2v6.4a2 2 0 0 1-2 2H5.8a2 2 0 0 1-2-2Z" />
      <path d="M12 10.4v5.2" />
      <path d="M9.4 13h5.2" />
    </>
  ),
  heart: <path d="M12 19.2s-7-4.2-7-9a3.8 3.8 0 0 1 6.8-2.4A3.8 3.8 0 0 1 18.6 10c0 5-6.6 9.2-6.6 9.2Z" />,
  home: (
    <>
      <path d="m4.5 11 7.5-6 7.5 6" />
      <path d="M6.8 10.2v8.3h10.4v-8.3" />
    </>
  ),
  image: (
    <>
      <rect x="4.5" y="5" width="15" height="14" rx="2.2" />
      <circle cx="9" cy="9.5" r="1.3" />
      <path d="m5 16 4.4-4.1 3.1 3.1 2.1-2.1 4.4 4.7" />
    </>
  ),
  logout: <path d="M10 6H6v12h4m4-3 3-3-3-3m3 3H9" />,
  message: <path d="M5 6.5h14a1.8 1.8 0 0 1 1.8 1.8v6.1a1.8 1.8 0 0 1-1.8 1.8H9.5L5.2 19v-2.8H5a1.8 1.8 0 0 1-1.8-1.8V8.3A1.8 1.8 0 0 1 5 6.5Z" />,
  mic: (
    <>
      <path d="M12 4a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V7a3 3 0 0 0-3-3Z" />
      <path d="M6 11a6 6 0 0 0 12 0" />
      <path d="M12 17v3" />
    </>
  ),
  more: (
    <>
      <circle cx="6.5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="17.5" cy="12" r="1" />
    </>
  ),
  moveFromProject: <path d="M5 7h8m0 0-3-3m3 3-3 3M5 17h14m0 0-3-3m3 3-3 3" />,
  moveToProject: (
    <>
      <path d="M3.8 7.8a2 2 0 0 1 2-2h4.4l2 2h6a2 2 0 0 1 2 2v6.4a2 2 0 0 1-2 2H5.8a2 2 0 0 1-2-2Z" />
      <path d="M9 13h6m0 0-2.5-2.5M15 13l-2.5 2.5" />
    </>
  ),
  music: (
    <>
      <path d="M10 18V6l8-1.5v11.8" />
      <circle cx="7.5" cy="18" r="2.2" />
      <circle cx="15.5" cy="16.4" r="2.2" />
    </>
  ),
  paperclip: <path d="m8.5 12.7 5.9-5.9a3 3 0 0 1 4.2 4.2l-7.4 7.4a4.4 4.4 0 0 1-6.2-6.2l7.4-7.4" />,
  path: <path d="M5 7h14M5 12h9M5 17h14" />,
  pen: (
    <>
      <path d="M5 19h4.5L18 10.5a2.5 2.5 0 0 0-3.5-3.5L6 15.5Z" />
      <path d="M13.8 7.2 16.8 10.2" />
    </>
  ),
  pin: (
    <>
      <path d="m9 4 6 6" />
      <path d="M7.8 11.2 4.8 14.2l5 5 3-3 5.4-1.4-9-9Z" />
    </>
  ),
  plane: <path d="M4 12.5 20 5l-4.8 14-3.1-6.2Z" />,
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 12a8 8 0 0 1-13.5 5.8" />
      <path d="M4 12A8 8 0 0 1 17.5 6.2" />
      <path d="M17.5 3.8v2.4h-2.4" />
      <path d="M6.5 20.2v-2.4h2.4" />
    </>
  ),
  search: (
    <>
      <path d="m21 21-4.35-4.35" />
      <circle cx="11" cy="11" r="6" />
    </>
  ),
  send: <path d="M5 12 19 5l-4.2 14-2.6-5.8Z" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a7.3 7.3 0 0 0-1.8-1L14.4 3h-4.8l-.3 3.1a7.3 7.3 0 0 0-1.8 1l-2.4-1-2 3.4 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a7.3 7.3 0 0 0 1.8 1l.3 3.1h4.8l.3-3.1a7.3 7.3 0 0 0 1.8-1l2.4 1 2-3.4-2-1.5a7 7 0 0 0 .1-1Z" />
    </>
  ),
  spark: (
    <>
      <path d="M12 3.8 13.9 9l5.3 2-5.3 2-1.9 5.2-1.9-5.2-5.3-2 5.3-2Z" />
      <path d="m5 5 1 2.3L8.3 8 6 9 5 11.3 4 9 1.7 8 4 7.3Z" />
    </>
  ),
  trash: (
    <>
      <path d="M5 7h14" />
      <path d="M9 7V5.5h6V7" />
      <path d="M7 7l.8 12h8.4L17 7" />
      <path d="M10.5 10.5v5" />
      <path d="M13.5 10.5v5" />
    </>
  ),
  video: (
    <>
      <rect x="4" y="6.5" width="11" height="11" rx="2" />
      <path d="m15 10 5-2.5v9L15 14" />
    </>
  ),
  x: <path d="m6.5 6.5 11 11m0-11-11 11" />,
  zip: (
    <>
      <path d="M7 4.5h6.5L18 9v10.5H7Z" />
      <path d="M13.5 4.5V9H18" />
      <path d="M10 6.8h2M10 9h2M10 11.2h2M10 13.4h2" />
    </>
  ),
};
