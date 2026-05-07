import { ReactNode } from 'react';

interface AppShellProps {
  header?: ReactNode;
  sidebarLeft: ReactNode;
  main: ReactNode;
  sidebarRight: ReactNode;
  sidebarRightVisible?: boolean;
}

export function AppShell({
  header,
  sidebarLeft,
  main,
  sidebarRight,
  sidebarRightVisible = true
}: AppShellProps): JSX.Element {
  return (
    <div className="app-shell">
      {header ?? null}
      <div className={`app-main-grid${sidebarRightVisible ? '' : ' app-main-grid-no-right'}`}>
        <aside className="app-column app-sidebar-left">
          {sidebarLeft}
        </aside>
        <main className="app-column-center">
          {main}
        </main>
        {sidebarRightVisible ? (
          <aside className="app-column app-sidebar-right">
            {sidebarRight}
          </aside>
        ) : null}
      </div>
    </div>
  );
}
