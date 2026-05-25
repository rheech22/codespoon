export interface InvokeResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
}

export interface InvokeOptions {
  dir: string;
  model: string;
  timeoutMs: number;
}

export interface AgentAdapter {
  invoke(prompt: string, opts: InvokeOptions): Promise<InvokeResult>;
}
