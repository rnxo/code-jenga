export type ExecutionParams = { language: string; code: string; testCode?: string; removedLineWasBlank?: boolean };
export type ExecutionResult = { passed: boolean; output: string };
export interface CodeExecutor { execute(params: ExecutionParams): Promise<ExecutionResult>; }