import { useState } from 'react';
import { Sidebar } from '../components/shared/Sidebar';
import { Header } from '../components/shared/Header';
import { RightPanel } from '../components/shared/RightPanel';
import { Console } from '../components/shared/Console';
import { OperatorView } from '../components/operator/OperatorView';
import { ApprovalModal } from '../components/approvals/ApprovalModal';

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [consoleOpen, setConsoleOpen] = useState(false);

  return (
    <div className="app-container">
      <Sidebar isOpen={sidebarOpen} toggle={() => setSidebarOpen(!sidebarOpen)} />

      <div className="main-content">
        <Header 
          toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          toggleRightPanel={() => setRightPanelOpen(!rightPanelOpen)}
        />
        
        <main className="main-area">
          <OperatorView />
          <Console isOpen={consoleOpen} toggle={() => setConsoleOpen(!consoleOpen)} />
        </main>
      </div>

      <RightPanel isOpen={rightPanelOpen} toggle={() => setRightPanelOpen(!rightPanelOpen)} />
      
      {/* Global Modals */}
      <ApprovalModal />
    </div>
  );
}
