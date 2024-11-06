import * as vscode from 'vscode';
import { loadConfig } from './config';

export class CodePackerTreeDataProvider implements vscode.TreeDataProvider<ConfigTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<ConfigTreeItem | undefined | null | void> = new vscode.EventEmitter<ConfigTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<ConfigTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ConfigTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: ConfigTreeItem): Promise<ConfigTreeItem[]> {
    if (!element) {
      const config = loadConfig();
      if (!config) {
        return [];
      }

      const items: ConfigTreeItem[] = [];
      
      // Add debug status
      items.push(new ConfigTreeItem(
        `Debug Mode: ${config.debug ? 'Enabled' : 'Disabled'}`,
        vscode.TreeItemCollapsibleState.None
      ));

      // Add directory configurations
      for (let i = 0; i < config.directories.length; i++) {
        const dir = config.directories[i];
        items.push(new ConfigTreeItem(
          `Directory Configuration ${i + 1}`,
          vscode.TreeItemCollapsibleState.Expanded,
          {
            sourceDirectory: dir.sourceDirectory,
            outputFile: dir.outputFile,
            exclusionPatterns: dir.exclusionPatterns,
            inclusionPatterns: dir.inclusionPatterns
          }
        ));
      }

      return items;
    } else if (element.dirConfig) {
      const dir = element.dirConfig;
      return [
        new ConfigTreeItem(`Source: ${dir.sourceDirectory}`, vscode.TreeItemCollapsibleState.None),
        new ConfigTreeItem(`Output: ${dir.outputFile}`, vscode.TreeItemCollapsibleState.None),
        new ConfigTreeItem(`Exclusions: ${dir.exclusionPatterns.join(', ')}`, vscode.TreeItemCollapsibleState.None),
        new ConfigTreeItem(`Inclusions: ${dir.inclusionPatterns.join(', ')}`, vscode.TreeItemCollapsibleState.None)
      ];
    }

    return [];
  }
}

class ConfigTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly dirConfig?: {
      sourceDirectory: string;
      outputFile: string;
      exclusionPatterns: string[];
      inclusionPatterns: string[];
    }
  ) {
    super(label, collapsibleState);
  }
}