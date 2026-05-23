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
import { invoke } from '@tauri-apps/api/core';
import { RuntimeStatus, HardwareInfo, useRuntimeStore } from '../stores/runtimeStore';

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [activeView, setActiveView] = useState('operator');
  
  const { setRuntime, setHardware } = useRuntimeStore();

  useEffect(() => {
    // Global fetch for header state
    invoke<RuntimeStatus>('get_runtime_status').then(setRuntime).catch(console.error);
    invoke<HardwareInfo>('get_hardware_info').then(setHardware).catch(console.error);
    
    const interval = setInterval(() => {
      invoke<RuntimeStatus>('get_runtime_status').then(setRuntime).catch(console.error);
      invoke<HardwareInfo>('get_hardware_info').then(setHardware).catch(console.error);
    }, 10000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="app-container">
      <Sidebar isOpen={sidebarOpen} toggle={() => setSidebarOpen(!sidebarOpen)} activeView={activeView} setActiveView={setActiveView} />

      <div className="main-content">
        <Header 
          toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          toggleRightPanel={() => setRightPanelOpen(!rightPanelOpen)}
        />
        
        <main className="main-area">
          {activeView === 'operator' && <OperatorView />}
          {activeView === 'runtime' && <RuntimePanel />}
          {activeView === 'models' && <ModelCatalog />}
          {activeView === 'memory' && <MemoryPanel />}
          {activeView === 'voice' && <VoicePanel />}
          {/* Outras telas virão aqui */}
          
          <Console isOpen={consoleOpen} toggle={() => setConsoleOpen(!consoleOpen)} />
        </main>
      </div>

      <RightPanel isOpen={rightPanelOpen} toggle={() => setRightPanelOpen(!rightPanelOpen)} />
      
      {/* Global Modals */}
      <ApprovalModal />
    </div>
  );
}
