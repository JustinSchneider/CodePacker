import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import {minimatch} from 'minimatch';
import {CodePackerConfig} from './config';
import {debugLog} from './utils';

export async function packCode(config: CodePackerConfig): Promise<string | null> {
  debugLog('Starting packCode function');
  debugLog('Config:', JSON.stringify(config, null, 2));

  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    console.error('No workspace folder found');
    vscode.window.showErrorMessage('No workspace folder found');
    return null;
  }
  debugLog('Workspace folder:', workspaceFolder.uri.fsPath);

  const sourceDir = path.resolve(workspaceFolder.uri.fsPath, config.sourceDirectory);
  debugLog('Resolved source directory:', sourceDir);

  const outputPath = path.join(workspaceFolder.uri.fsPath, config.outputFile);
  debugLog('Output file path:', outputPath);

  // Delete the existing output file if it exists
  if (fs.existsSync(outputPath)) {
    try {
      await fs.promises.unlink(outputPath);
      debugLog(`Existing output file deleted: ${outputPath}`);
    } catch (error) {
      console.error(`Error deleting existing output file: ${error}`);
      vscode.window.showErrorMessage(`Failed to delete existing output file: ${outputPath}`);
      return null;
    }
  }

  let output = '';

  output += "--- START OF HEADER ---\n";
  output += `Generated on: ${new Date().toISOString()}\n`;
  output += "Generated by: VS Code Code Packer Extension\n";
  output += "Purpose: Code packing for analysis or documentation\n";
  output += "--- END OF HEADER ---\n\n";

  try {
    debugLog('Starting file search');
    debugLog('Source directory:', sourceDir);
    debugLog('Exclusion patterns:', config.exclusionPatterns);
    debugLog('Inclusion patterns:', config.inclusionPatterns);

    const recursiveExclusionPatterns = config.exclusionPatterns.map(pattern => {
      if (pattern.includes('/') || pattern.includes('\\')) {
        // It's a path, make it recursive
        return pattern.endsWith('/') || pattern.endsWith('\\') ? `${pattern}**` : `${pattern}/**`;
      } else if (pattern.includes('*')) {
        // It's already a glob pattern, make it match in all directories
        return `**/${pattern}`;
      } else {
        // It's a specific filename, make it match in all directories
        return `**/${pattern}`;
      }
    });

    // Use '**' to recursively search all directories and files
    const allFiles = await vscode.workspace.findFiles(
      new vscode.RelativePattern(sourceDir, '**'),
      new vscode.RelativePattern(sourceDir, `{${recursiveExclusionPatterns.join(',')}}`)
    );

    debugLog(`Total files found: ${allFiles.length}`);
    allFiles.forEach(file => debugLog(`Found file: ${file.fsPath}`));

    const files = allFiles.filter(file => {
      const relativePath = path.relative(sourceDir, file.fsPath).replace(/\\/g, '/');
      debugLog(`Checking file: ${relativePath}`);

      const shouldInclude = config.inclusionPatterns.length === 0 ||
        config.inclusionPatterns.some(pattern => {
          const match = minimatch(relativePath, pattern, {matchBase: true});
          debugLog(`  Inclusion pattern ${pattern}: ${match ? 'matched' : 'not matched'}`);
          return match;
        });

      const shouldExclude = recursiveExclusionPatterns.some(pattern => {
        const match = minimatch(relativePath, pattern, {matchBase: true});
        debugLog(`  Exclusion pattern ${pattern}: ${match ? 'matched' : 'not matched'}`);
        return match;
      });

      if (shouldInclude && !shouldExclude) {
        debugLog(`Including file: ${relativePath}`);
        return true;
      } else {
        debugLog(`Excluding file: ${relativePath}`);
        return false;
      }
    });

    debugLog(`Files after applying patterns: ${files.length}`);

    let includedCount = 0;
    let excludedCount = 0;

    for (const file of files) {
      const absoluteFilePath = file.fsPath;
      const relativePath = path.relative(sourceDir, absoluteFilePath).replace(/\\/g, '/');

      debugLog(`Processing file: ${relativePath}`);

      try {
        const content = await fs.promises.readFile(absoluteFilePath, 'utf8');
        output += `--- FILE: ${relativePath} ---\n`;
        output += content;
        output += "\n--- END FILE ---\n\n";
        includedCount++;
      } catch (err) {
        console.error(`Error reading file ${absoluteFilePath}:`, err);
        vscode.window.showWarningMessage(`Failed to read file: ${relativePath}`);
        excludedCount++;
      }
    }

    debugLog(`Total files: ${files.length}, Included: ${includedCount}, Excluded: ${excludedCount}`);

    // Write the output to file
    debugLog('Writing output to file:', outputPath);
    await fs.promises.writeFile(outputPath, output, 'utf8');
    debugLog('File written successfully');

    // Show a success message
    vscode.window.showInformationMessage(`Code packed successfully. Output file: ${outputPath}`, 'Open File')
      .then(selection => {
        if (selection === 'Open File') {
          vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(outputPath));
        }
      });

  } catch (err) {
    console.error('Error packing code:', err);
    let errorMessage = 'An unknown error occurred while packing code.';
    if (err instanceof Error) {
      errorMessage = err.message;
    } else if (typeof err === 'string') {
      errorMessage = err;
    }
    vscode.window.showErrorMessage(`Failed to pack code: ${errorMessage}`);
    return null;
  }

  debugLog('Packing completed successfully');
  return output;
}