# Modelos de Dados (Data Models)

## Typescript (Frontend)

```typescript
// Contexto
export interface ActiveContext {
  type: 'system' | 'model' | 'file' | 'project' | 'error' | 'command';
  id: string;
  label: string;
  summary: string;
  data: unknown;
  source: string;
  timestamp: number;
}

// Approval
export interface ExecutionStep {
  order: number;
  description: string;
  command: string;
  args: string[];
  riskLevel: 'Seguro' | 'Baixo' | 'Médio' | 'Alto' | 'Crítico';
  requiresSudo: boolean;
  rollbackCommand?: string;
}

export interface ExecutionPlan {
  id: string;
  summary: string;
  reason: string;
  steps: ExecutionStep[];
  totalRisk: string;
  requiresSudo: boolean;
  backupRequired: boolean;
  rollbackPlan?: string;
  skillId?: string;
}
```

## Rust (Backend)

```rust
// Executor
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CommandOutput {
    pub success: bool,
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
    pub execution_time_ms: u64,
}

// Memory / SQLite
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct MemoryEntry {
    pub id: i64,
    pub category: String, // "preference", "hardware", "success", "error"
    pub content: String,
    pub timestamp: i64,
}

// Hardware
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct HardwareProfile {
    pub cpu_name: String,
    pub vram_total_mb: u32,
    pub ram_total_mb: u32,
    pub gpu_name: String,
    pub has_cuda: bool,
}
```
