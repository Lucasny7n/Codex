import { ReactNode } from 'react';

interface AppShellProps {
  header: ReactNode;
  sidebarLeft: ReactNode;
  main: ReactNode;
  sidebarRight: ReactNode;
}

export function AppShell({ header, sidebarLeft, main, sidebarRight }: AppShellProps): JSX.Element {
  return (
    <div className="app-shell">
      {header}
      <div className="app-main-grid">
        <aside className="app-column app-sidebar-left">
          {sidebarLeft}
        </aside>
        <main className="app-column-center">
          {main}
        </main>
        <aside className="app-column app-sidebar-right">
          {sidebarRight}
        </aside>
      </div>
    </div>
  );
}
