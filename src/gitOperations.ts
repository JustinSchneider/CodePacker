import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import {debugLog} from './utils';
import {minimatch} from 'minimatch';
import {DEFAULT_DIFF_CONFIG, DiffConfig, loadConfig} from './config';

type GitStatus = number;

const GitStatus = {
  INDEX_MODIFIED: 0,
  INDEX_ADDED: 1,
  INDEX_DELETED: 2,
  INDEX_RENAMED: 3,
  INDEX_COPIED: 4,
  MODIFIED: 5,
  DELETED: 6,
  UNTRACKED: 7,
  IGNORED: 8,
  INTENT_TO_ADD: 9,
  ADDED_BY_US: 10,
  DELETED_BY_US: 11
} as const;

interface DiffStats {
  additions: number;
  deletions: number;
}

async function isBinaryFile(repository: any, relativePath: string): Promise<boolean> {
  try {
    const objectType = await repository.detectObjectType(relativePath);
    return !objectType.mimetype.startsWith('text/') &&
      objectType.mimetype !== 'application/json';
  } catch (error) {
    debugLog(`Error detecting file type: ${error}`);
    return false;
  }
}

function calculateDiffStats(diffContent: string): DiffStats {
  const lines = diffContent.split('\n');
  let additions = 0;
  let deletions = 0;
  let inHunk = false;

  for (const line of lines) {
    // Skip diff headers
    if (line.startsWith('diff --git') ||
      line.startsWith('index ') ||
      line.startsWith('--- ') ||
      line.startsWith('+++ ')) {
      continue;
    }

    // Detect hunk headers
    if (line.startsWith('@@')) {
      inHunk = true;
      continue;
    }

    // Only count lines within hunks
    if (!inHunk) {continue;}

    if (line.startsWith('+') && !line.startsWith('+++')) {
      additions++;
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      deletions++;
    }
  }

  return {additions, deletions};
}

async function getFileContent(
  repository: any,
  change: any,
  config: DiffConfig,
  relativePath: string
): Promise<{content: string | null; stats: DiffStats}> {
  try {
    let content: string | null = null;
    let stats: DiffStats = {additions: 0, deletions: 0};

    // For added files - show full content as additions
    if (change.status === GitStatus.INDEX_ADDED || change.status === GitStatus.ADDED_BY_US) {
      content = await repository.show(`${config.sourceBranch}:${relativePath}`);
      if (content) {
        const lines = content.split('\n');
        stats.additions = lines.length;
        // Format as a proper diff
        content = [
          `diff --git a/${relativePath} b/${relativePath}`,
          'new file mode 100644',
          `--- /dev/null`,
          `+++ b/${relativePath}`,
          `@@ -0,0 +1,${lines.length} @@`,
          ...lines.map(line => `+${line}`)
        ].join('\n');
      }
    }
    // For deleted files - show full content as deletions
    else if (change.status === GitStatus.INDEX_DELETED || change.status === GitStatus.DELETED_BY_US) {
      content = await repository.show(`${config.targetBranch}:${relativePath}`);
      if (content) {
        const lines = content.split('\n');
        stats.deletions = lines.length;
        // Format as a proper diff
        content = [
          `diff --git a/${relativePath} b/${relativePath}`,
          'deleted file mode 100644',
          `--- a/${relativePath}`,
          `+++ /dev/null`,
          `@@ -1,${lines.length} +0,0 @@`,
          ...lines.map(line => `-${line}`)
        ].join('\n');
      }
    }
    // For renamed files
    else if (change.status === GitStatus.INDEX_RENAMED) {
      const oldPath = change.originalUri ?
        vscode.workspace.asRelativePath(change.originalUri) :
        'unknown';

      content = await repository.diffBetween(
        config.targetBranch,
        config.sourceBranch,
        relativePath
      );

      if (content) {
        stats = calculateDiffStats(content);
        content = [
          `diff --git a/${oldPath} b/${relativePath}`,
          `rename from ${oldPath}`,
          `rename to ${relativePath}`,
          content
        ].join('\n');
      }
    }
    // For modified files
    else {
      content = await repository.diffBetween(
        config.targetBranch,
        config.sourceBranch,
        relativePath
      );
      if (content) {
        stats = calculateDiffStats(content);
      }
    }

    return {content, stats};
  } catch (error) {
    debugLog(`Error getting content: ${error}`);
    return {content: null, stats: {additions: 0, deletions: 0}};
  }
}

export async function generateDiff(config: DiffConfig): Promise<string | null> {
  // Load user config
  const userConfig = await loadConfig();

  // Merge configs with priorities: user config > provided config > default config
  const fullConfig = {
    ...DEFAULT_DIFF_CONFIG,
    ...config,
    ...(userConfig?.diffConfig || {})
  };

  const gitExtension = vscode.extensions.getExtension('vscode.git');
  if (!gitExtension) {
    vscode.window.showErrorMessage('Git extension is not available');
    return null;
  }

  const git = gitExtension.exports.getAPI(1);
  const repository = git.repositories[0];

  if (!repository) {
    vscode.window.showErrorMessage('No Git repository found');
    return null;
  }

  try {
    debugLog(`Generating diff between ${config.sourceBranch} and ${config.targetBranch}`);

    // Get changes from target to source to show what changes would be merged
    const changes = await repository.diffBetween(config.targetBranch, config.sourceBranch);

    if (!changes || changes.length === 0) {
      vscode.window.showInformationMessage('No differences found');
      return null;
    }

    // Filter changes based on patterns
    const filteredChanges = changes.filter((change: {uri: vscode.Uri}) => {
      const relativePath = vscode.workspace.asRelativePath(change.uri);
      return shouldIncludeFile(relativePath, fullConfig);
    });

    if (filteredChanges.length === 0) {
      vscode.window.showInformationMessage('No changes match the inclusion/exclusion patterns');
      return null;
    }

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      throw new Error('No workspace folder found');
    }

    const outputPath = path.join(workspaceFolder.uri.fsPath, config.outputFile);

    let totalStats: DiffStats = {additions: 0, deletions: 0};
    let output = "--- START OF HEADER ---\n";
    output += `Generated on: ${new Date().toISOString()}\n`;
    output += "Generated by: VS Code Code Packer Extension\n";
    output += "Purpose: Git branch diff for analysis\n";
    output += `Source Branch: ${config.sourceBranch}\n`;
    output += `Target Branch: ${config.targetBranch}\n`;
    output += "--- END OF HEADER ---\n\n";

    const processedFiles: string[] = [];

    for (const change of filteredChanges) {
      const relativePath = vscode.workspace.asRelativePath(change.uri);

      try {
        // Skip if already processed (handles renamed files that might appear twice)
        if (processedFiles.includes(relativePath)) {
          continue;
        }
        processedFiles.push(relativePath);

        // Check file size and binary status
        const stats = await getFileStats(repository, relativePath,
          change.status === GitStatus.INDEX_ADDED ? config.sourceBranch : config.targetBranch);

        if (stats) {
          const maxSize = (fullConfig.maxFileSize ?? DEFAULT_DIFF_CONFIG.maxFileSize!) * 1024;
          if (stats.size > maxSize) {
            debugLog(`Skipping large file: ${relativePath} (${stats.size / 1024}KB)`);
            output += `=== ${relativePath} ===\n`;
            output += `Status: ${getStatusText(change.status)}\n`;
            output += `Skipped: File too large (${Math.round(stats.size / 1024)}KB)\n`;
            output += "=== END FILE ===\n\n";
            continue;
          }

          if (stats.isBinary && !fullConfig.includeBinaryFiles) {
            output += `=== ${relativePath} ===\n`;
            output += `Status: ${getStatusText(change.status)}\n`;
            output += "Type: Binary file (skipped)\n";
            output += "=== END FILE ===\n\n";
            continue;
          }
        }

        // Get file content and stats
        const {content, stats: fileStats} = await getFileContent(
          repository,
          change,
          config,
          relativePath
        );

        totalStats.additions += fileStats.additions;
        totalStats.deletions += fileStats.deletions;

        if (change.status === GitStatus.INDEX_RENAMED && change.originalUri) {
          const oldPath = vscode.workspace.asRelativePath(change.originalUri);
          output += `=== ${relativePath} (renamed from ${oldPath}) ===\n`;
        } else {
          output += `=== ${relativePath} ===\n`;
        }
        output += `Status: ${getStatusText(change.status)}\n`;

        if (content) {
          output += `Changes: +${fileStats.additions} -${fileStats.deletions}\n\n`;
          output += content + "\n";
        } else {
          output += "No content changes\n";
        }
        output += "=== END FILE ===\n\n";

      } catch (error) {
        const errorMessage = error instanceof Error ?
          `${error.name}: ${error.message}` :
          String(error);
        debugLog(`Error processing ${relativePath}:`, errorMessage);
        output += `=== ${relativePath} ===\n`;
        output += `Status: ${getStatusText(change.status)}\n`;
        output += `Error: ${errorMessage}\n`;
        output += "=== END FILE ===\n\n";
      }
    }

    // Add summary at the start
    const summary = `Showing ${processedFiles.length} changed files with ` +
      `**${totalStats.additions} additions** and ` +
      `**${totalStats.deletions} deletions**.\n\n`;
    output = summary + output;

    await fs.promises.writeFile(outputPath, output, 'utf8');
    debugLog('Diff file written successfully:', outputPath);

    return output;
  } catch (error) {
    console.error('Error generating diff:', error);
    vscode.window.showErrorMessage(`Failed to generate diff: ${error}`);
    return null;
  }
}

function getStatusText(status: GitStatus): string {
  switch (status) {
    case 0: return 'Modified (Index)';
    case 1: return 'Added (Index)';
    case 2: return 'Deleted (Index)';
    case 3: return 'Renamed (Index)';
    case 4: return 'Copied (Index)';
    case 5: return 'Modified';
    case 6: return 'Deleted';
    case 7: return 'Untracked';
    case 8: return 'Ignored';
    case 9: return 'Intent to Add';
    case 10: return 'Added by Us';
    case 11: return 'Deleted by Us';
    default: return `Status ${status}`;
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

  const branches = await repository.getBranches();
  return branches.map((branch: {name: any; toString: () => any;}) => branch.name || branch.toString());
}

export async function promptForDiffConfig(): Promise<DiffConfig | null> {
  try {
    const branches = await getBranches();

    const sourceBranch = await vscode.window.showQuickPick(branches, {
      placeHolder: 'Select source branch',
      title: 'Select Source Branch'
    });

    if (!sourceBranch) {
      return null;
    }

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

export function shouldIncludeFile(
  relativePath: string,
  config: DiffConfig
): boolean {
  // Always check exclusions first - these take precedence
  if (config.exclusionPatterns?.some(pattern => {
    // Handle both glob patterns and direct paths
    if (pattern.includes('/')) {
      // For patterns with paths, use exact matching
      return minimatch(relativePath, pattern);
    } else {
      // For simple patterns, match against basename
      return minimatch(relativePath, `**/${pattern}`);
    }
  })) {
    return false;
  }

  // If no inclusion patterns specified, include everything not excluded
  if (!config.inclusionPatterns?.length) {
    return true;
  }

  // Check against inclusion patterns
  return config.inclusionPatterns.some(pattern => {
    if (pattern.includes('/')) {
      return minimatch(relativePath, pattern);
    } else {
      return minimatch(relativePath, `**/${pattern}`);
    }
  });
}

async function getFileStats(
  repository: any,
  relativePath: string,
  ref: string
): Promise<{size: number; isBinary: boolean} | null> {
  try {
    const details = await repository.getObjectDetails(ref, relativePath);
    if (!details) {return null;}

    const objectType = await repository.detectObjectType(details.object);
    const isBinary = !objectType.mimetype.startsWith('text/') &&
      objectType.mimetype !== 'application/json';

    return {
      size: details.size,
      isBinary
    };
  } catch {
    return null;
  }
}
