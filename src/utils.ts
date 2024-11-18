import * as vscode from 'vscode';
import * as path from 'path';

let outputChannel: vscode.OutputChannel;
let isDebugMode = false;

export function initializeDebugLogging() {
  outputChannel = vscode.window.createOutputChannel('Code Packer');
  updateDebugMode();
}

export function updateDebugMode() {
  const config = vscode.workspace.getConfiguration('codePacker');
  isDebugMode = config.get<boolean>('debug', false);
  debugLog(`Debug mode ${isDebugMode ? 'enabled' : 'disabled'}`);
}

export function setDebugMode(debug: boolean) {
  isDebugMode = debug;
}

export function debugLog(...args: any[]) {
  if (isDebugMode) {
    const message = args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');

    if (outputChannel) {
      outputChannel.appendLine(`[${new Date().toISOString()}] ${message}`);
    }
    console.log(`[Code Packer Debug] ${message}`);
  }
}

export function getSafeProjectName(workspaceFolder: vscode.WorkspaceFolder): string {
  const projectName = path.basename(workspaceFolder.uri.fsPath);
  return projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}
