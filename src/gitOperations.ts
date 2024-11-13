import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { debugLog } from './utils';

export interface DiffConfig {
  sourceBranch: string;
  targetBranch: string;
  outputFile: string;
}

interface Change {
  status: number;
  uri: vscode.Uri;
  originalUri: vscode.Uri;
  renameUri: vscode.Uri;
}

async function getFileContentAtRef(repository: any, filePath: string, ref: string): Promise<string> {
  try {
    // Use show with :ref:path syntax to get file content at specific ref
    const content = await repository.show(`${ref}:${filePath}`);
    return content || '';
  } catch (error) {
    debugLog(`Error reading file ${filePath} at ref ${ref}:`, error);
    return '';
  }
}

export async function generateDiff(config: DiffConfig): Promise<string | null> {
  const gitExtension = vscode.extensions.getExtension('vscode.git');
  if (!gitExtension) {
    vscode.window.showErrorMessage('Git extension is not available');
    return null;
  }

  const git = gitExtension.exports.getAPI(1);
  const repository = git.repositories[0];
  
  if (!repository) {
    vscode.window.showErrorMessage('No Git repository found in the current workspace');
    return null;
  }

  try {
    debugLog(`Generating diff between ${config.sourceBranch} and ${config.targetBranch}`);
    
    // Get the list of changed files
    const changes = await repository.diffBetween(config.sourceBranch, config.targetBranch) as Change[];
    
    if (!changes || changes.length === 0) {
      vscode.window.showInformationMessage('No differences found between the branches');
      return null;
    }

    debugLog(`Found ${changes.length} changed files`);

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        throw new Error('No workspace folder found');
    }

    const outputPath = path.join(workspaceFolder.uri.fsPath, config.outputFile);
    
    // Create the diff file content with metadata
    let output = "--- START OF HEADER ---\n";
    output += `Generated on: ${new Date().toISOString()}\n`;
    output += "Generated by: VS Code Code Packer Extension\n";
    output += "Purpose: Git branch diff for analysis\n";
    output += `Source Branch: ${config.sourceBranch}\n`;
    output += `Target Branch: ${config.targetBranch}\n`;
    output += `Number of Changed Files: ${changes.length}\n`;
    output += "--- END OF HEADER ---\n\n";

    // Process each changed file
    for (const change of changes) {
      // Get the file path relative to the workspace root
      const relativePath = vscode.workspace.asRelativePath(change.uri);
      const gitPath = relativePath.replace(/\\/g, '/'); // Ensure forward slashes for git

      output += `=== ${relativePath} ===\n`;
      output += `Status: ${change.status === 1 ? 'Added' : change.status === 5 ? 'Modified' : 'Status ' + change.status}\n\n`;

      try {
        if (change.status === 1) {  // Added file
          const newContent = await getFileContentAtRef(repository, gitPath, config.targetBranch);
          output += "=== Added Content ===\n";
          output += newContent;
          output += "\n";
        } else if (change.status === 5) {  // Modified file
          const originalContent = await getFileContentAtRef(repository, gitPath, config.sourceBranch);
          const modifiedContent = await getFileContentAtRef(repository, gitPath, config.targetBranch);
          
          output += "=== Original Content ===\n";
          output += originalContent;
          output += "\n=== Modified Content ===\n";
          output += modifiedContent;
          output += "\n";
        }
      } catch (error) {
        debugLog(`Error getting content for ${relativePath}:`, error);
        output += `Error retrieving file content: ${error}\n`;
      }

      output += "=== END FILE ===\n\n";
    }

    // Write the diff to the output file
    await fs.promises.writeFile(outputPath, output, 'utf8');
    debugLog('Diff file written successfully:', outputPath);

    return output;
  } catch (error) {
    console.error('Error generating diff:', error);
    vscode.window.showErrorMessage(`Failed to generate diff: ${error}`);
    return null;
  }
}

export async function getBranches(): Promise<string[]> {
  const gitExtension = vscode.extensions.getExtension('vscode.git');
  if (!gitExtension) {
      throw new Error('Git extension is not available');
  }

  const git = gitExtension.exports.getAPI(1);
  const repository = git.repositories[0];
  
  if (!repository) {
      throw new Error('No Git repository found in the current workspace');
  }

  // Get all branches including remote ones
  const branches = await repository.getBranches();
  return branches.map((branch: {name: any; toString: () => any;}) => branch.name || branch.toString());
}

export async function promptForDiffConfig(): Promise<DiffConfig | null> {
  try {
      const branches = await getBranches();
      
      // Get source branch
      const sourceBranch = await vscode.window.showQuickPick(branches, {
          placeHolder: 'Select source branch',
          title: 'Select Source Branch'
      });
      
      if (!sourceBranch) {
          return null;
      }

      // Get target branch
      const targetBranch = await vscode.window.showQuickPick(
          branches.filter(b => b !== sourceBranch),
          {
              placeHolder: 'Select target branch',
              title: 'Select Target Branch'
          }
      );
      
      if (!targetBranch) {
          return null;
      }

      // Get output file name
      const defaultFileName = `diff_${sourceBranch.replace(/[^a-z0-9]/gi, '_')}_${targetBranch.replace(/[^a-z0-9]/gi, '_')}.txt`;
      const outputFile = await vscode.window.showInputBox({
          prompt: 'Enter output file name',
          value: defaultFileName,
          validateInput: input => {
              if (!input.trim()) {
                  return 'Output file name cannot be empty';
              }
              return null;
          }
      });

      if (!outputFile) {
          return null;
      }

      return {
          sourceBranch,
          targetBranch,
          outputFile
      };
  } catch (error) {
      vscode.window.showErrorMessage(`Error configuring diff: ${error}`);
      return null;
  }
}