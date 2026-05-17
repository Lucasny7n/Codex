import { ReactNode } from 'react';

interface AppShellProps {
  header?: ReactNode;
  sidebarLeft: ReactNode;
  main: ReactNode;
  sidebarRight: ReactNode;
  sidebarRightVisible?: boolean;
  sidebarLeftVisible?: boolean;
  sidebarLeftCollapsed?: boolean;
  sidebarRestore?: ReactNode;
}

export function AppShell({
  header,
  sidebarLeft,
  main,
  sidebarRight,
  sidebarRightVisible = true,
  sidebarLeftVisible = true,
  sidebarLeftCollapsed = false,
  sidebarRestore,
}: AppShellProps): JSX.Element {
  return (
    <div className="app-shell">
      {header ?? null}
      <div className={`app-main-grid${sidebarRightVisible ? '' : ' app-main-grid-no-right'}${sidebarLeftVisible ? '' : ' app-main-grid-no-left'}${sidebarLeftVisible && sidebarLeftCollapsed ? ' app-main-grid-left-collapsed' : ''}`}>
        {sidebarLeftVisible ? (
          <aside className={`app-column app-sidebar-left${sidebarLeftCollapsed ? ' app-sidebar-left-collapsed' : ''}`}>
            {sidebarLeft}
          </aside>
        ) : null}
        <main className="app-column-center">
          {!sidebarLeftVisible ? sidebarRestore : null}
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
