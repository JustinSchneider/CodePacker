import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import {debugLog, setDebugMode, getSafeProjectName, getDefaultExclusionPatterns, getDefaultInclusionPatterns} from './utils';

export interface CodePackerConfig {
  sourceDirectory: string;
  outputFile: string;
  exclusionPatterns: string[];
  inclusionPatterns: string[];
  debug: boolean;
}

export function loadConfig(): CodePackerConfig | null {
  debugLog('Loading configuration');

  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    console.error('No workspace folder found');
    return null;
  }

  const configPath = path.join(workspaceFolder.uri.fsPath, '.vscode', 'code-packer.json');
  debugLog('Attempting to load config from:', configPath);

  if (fs.existsSync(configPath)) {
    try {
      const configContent = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(configContent);
      setDebugMode(config.debug || false);  // Set debug mode
      debugLog('Loaded config:', config);
      return config;
    } catch (error) {
      console.error('[Code Packer] Error reading config file:', error);
      return null;
    }
  } else {
    debugLog('No config file found, using default settings');
    const settings = vscode.workspace.getConfiguration('codePacker');
    const safeProjectName = getSafeProjectName(workspaceFolder);
    const config = {
      sourceDirectory: settings.get('defaultSourceDirectory', '.'),
      outputFile: settings.get('defaultOutputFile', `${safeProjectName}_packed_code.txt`),
      exclusionPatterns: settings.get('defaultExclusionPatterns', getDefaultExclusionPatterns()),
      inclusionPatterns: settings.get('defaultInclusionPatterns', getDefaultInclusionPatterns()),
      debug: false  // Default to false for default settings
    };
    setDebugMode(config.debug);  // Set debug mode
    return config;
  }
}

export async function configureCodePacker(): Promise<CodePackerConfig | null> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    console.error('No workspace folder found');
    vscode.window.showErrorMessage('No workspace folder found. Please open a folder before configuring Code Packer.');
    return null;
  }

  debugLog('Workspace folder:', workspaceFolder.uri.fsPath);

  const safeProjectName = getSafeProjectName(workspaceFolder);
  const defaultConfig = {
    sourceDirectory: '.',
    outputFile: `${safeProjectName}_packed_code.txt`,
    exclusionPatterns: getDefaultExclusionPatterns(),
    inclusionPatterns: getDefaultInclusionPatterns(),
    debug: false
  };

  let config = loadConfig() || defaultConfig;
  debugLog('Loaded or default config:', config);

  config.sourceDirectory = await vscode.window.showInputBox({
    prompt: 'Enter source directory (relative to workspace root)',
    value: config.sourceDirectory,
    placeHolder: '.',
    validateInput: input => input.includes('..') ? 'Path cannot contain ".."' : null
  }) || config.sourceDirectory;

  config.outputFile = await vscode.window.showInputBox({
    prompt: 'Enter output file name',
    value: config.outputFile,
    placeHolder: `${safeProjectName}_packed_code.txt`
  }) || config.outputFile;

  const exclusions = await vscode.window.showInputBox({
    prompt: 'Enter exclusion patterns (comma-separated)',
    value: config.exclusionPatterns.join(', '),
    placeHolder: getDefaultExclusionPatterns().join(', ')
  });
  if (exclusions !== undefined) {
    config.exclusionPatterns = exclusions.split(',').map(p => p.trim()).filter(p => p !== '');
  }

  const inclusions = await vscode.window.showInputBox({
    prompt: 'Enter inclusion patterns (comma-separated)',
    value: config.inclusionPatterns.join(', '),
    placeHolder: getDefaultInclusionPatterns().join(', ')
  });
  if (inclusions !== undefined) {
    config.inclusionPatterns = inclusions.split(',').map(p => p.trim()).filter(p => p !== '');
  }

  debugLog('Updated config:', config);

  const configPath = path.join(workspaceFolder.uri.fsPath, '.vscode', 'code-packer.json');
  debugLog('Config file path:', configPath);

  try {
    fs.mkdirSync(path.dirname(configPath), {recursive: true});
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    debugLog('Config file written successfully');
    vscode.window.showInformationMessage('Code Packer configuration saved successfully.');
  } catch (error) {
    console.error('Error writing config file:', error);
    vscode.window.showErrorMessage(`Failed to save Code Packer configuration: ${error}`);
    return null;
  }

  return config;
}