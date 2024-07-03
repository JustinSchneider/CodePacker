import * as vscode from 'vscode';
import {loadConfig} from './config';

export class CodePackerTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null | void> = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
    if (!element) {
      const config = loadConfig();
      if (!config) {return Promise.resolve([]);}

      return Promise.resolve([
        new vscode.TreeItem(`Source: ${config.sourceDirectory}`),
        new vscode.TreeItem(`Output: ${config.outputFile}`),
        new vscode.TreeItem(`Exclusions: ${config.exclusionPatterns.join(', ')}`),
        new vscode.TreeItem(`Inclusions: ${config.inclusionPatterns.join(', ')}`),
      ]);
    }
    return Promise.resolve([]);
  }
}