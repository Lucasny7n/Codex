import { useState } from 'react';
import { Sidebar } from '../components/shared/Sidebar';
import { Header } from '../components/shared/Header';
import { RightPanel } from '../components/shared/RightPanel';
import { Console } from '../components/shared/Console';
import { OperatorView } from '../components/operator/OperatorView';
import { ApprovalModal } from '../components/approvals/ApprovalModal';
import { RuntimePanel } from '../components/panels/RuntimePanel';
import { ModelCatalog } from '../components/models/ModelCatalog';
import { MemoryPanel } from '../components/panels/MemoryPanel';
import { VoicePanel } from '../components/panels/VoicePanel';

import { useEffect } from 'react';
import { useRuntimeStore } from '../stores/runtimeStore';

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [activeView, setActiveView] = useState('operator');
  
  const { loadHardware, checkRuntimeStatus } = useRuntimeStore();

  useEffect(() => {
    loadHardware();
    checkRuntimeStatus();
    
    const interval = setInterval(() => {
      checkRuntimeStatus();
      loadHardware();
    }, 10000);
    
    return () => clearInterval(interval);
  }, [loadHardware, checkRuntimeStatus]);

  return (
    <div className="app-shell">
      <Sidebar isOpen={sidebarOpen} toggle={() => setSidebarOpen(!sidebarOpen)} activeView={activeView} setActiveView={setActiveView} />

      <div className="app-main">
        <Header 
          toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          toggleRightPanel={() => setRightPanelOpen(!rightPanelOpen)}
        />
        
        <main className="app-content-area">
          {activeView === 'operator' && <OperatorView />}
          {activeView === 'runtime' && <RuntimePanel />}
          {activeView === 'models' && <ModelCatalog />}
          {activeView === 'memory' && <MemoryPanel />}
          {activeView === 'voice' && <VoicePanel />}
          
          <Console isOpen={consoleOpen} toggle={() => setConsoleOpen(!consoleOpen)} />
        </main>
      </div>

      <RightPanel isOpen={rightPanelOpen} toggle={() => setRightPanelOpen(!rightPanelOpen)} />
      
      {/* Global Modals */}
      <ApprovalModal />
    </div>
  );
}
