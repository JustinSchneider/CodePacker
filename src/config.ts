import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import {debugLog, setDebugMode, getSafeProjectName, getDefaultExclusionPatterns, getDefaultInclusionPatterns} from './utils';

export interface DirectoryConfig {
  sourceDirectory: string;
  outputFile: string;
  exclusionPatterns: string[];
  inclusionPatterns: string[];
}

export interface CodePackerConfig {
  directories: DirectoryConfig[];
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
      const rawConfig = JSON.parse(configContent);
      
      // Handle backward compatibility with old config format
      if ('sourceDirectory' in rawConfig) {
        // Convert old format to new format
        const config: CodePackerConfig = {
          directories: [{
            sourceDirectory: rawConfig.sourceDirectory,
            outputFile: rawConfig.outputFile,
            exclusionPatterns: rawConfig.exclusionPatterns,
            inclusionPatterns: rawConfig.inclusionPatterns
          }],
          debug: rawConfig.debug || false
        };
        setDebugMode(config.debug);
        debugLog('Converted old config format:', config);
        return config;
      }

      // New format
      setDebugMode(rawConfig.debug || false);
      debugLog('Loaded config:', rawConfig);
      return rawConfig;
    } catch (error) {
      console.error('[Code Packer] Error reading config file:', error);
      return null;
    }
  } else {
    debugLog('No config file found, using default settings');
    const settings = vscode.workspace.getConfiguration('codePacker');
    const safeProjectName = getSafeProjectName(workspaceFolder);
    const config: CodePackerConfig = {
      directories: [{
        sourceDirectory: settings.get('defaultSourceDirectory', '.'),
        outputFile: settings.get('defaultOutputFile', `${safeProjectName}_packed_code.txt`),
        exclusionPatterns: settings.get('defaultExclusionPatterns', getDefaultExclusionPatterns()),
        inclusionPatterns: settings.get('defaultInclusionPatterns', getDefaultInclusionPatterns())
      }],
      debug: false
    };
    setDebugMode(config.debug);
    return config;
  }
}

export async function configureCodePacker(): Promise<CodePackerConfig | null> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('No workspace folder found. Please open a folder before configuring Code Packer.');
    return null;
  }

  debugLog('Workspace folder:', workspaceFolder.uri.fsPath);
  const currentConfig = loadConfig();
  
  const config: CodePackerConfig = currentConfig || {
    directories: [{
      sourceDirectory: '.',
      outputFile: `${getSafeProjectName(workspaceFolder)}_packed_code.txt`,
      exclusionPatterns: getDefaultExclusionPatterns(),
      inclusionPatterns: getDefaultInclusionPatterns()
    }],
    debug: false
  };

  while (true) {
    const action = await vscode.window.showQuickPick([
      'Add New Directory',
      'Edit Directory',
      'Remove Directory',
      'Toggle Debug Mode',
      'Save Configuration',
      'Cancel'
    ], {
      placeHolder: 'Choose an action'
    });

    if (!action || action === 'Cancel') {
      return null;
    }

    if (action === 'Save Configuration') {
      break;
    }

    if (action === 'Toggle Debug Mode') {
      config.debug = !config.debug;
      continue;
    }

    if (action === 'Add New Directory') {
      const dirConfig = await configureDirectoryConfig();
      if (dirConfig) {
        config.directories.push(dirConfig);
      }
    } else if (action === 'Edit Directory') {
      const dirIndex = await selectDirectory(config.directories);
      if (dirIndex !== undefined) {
        const updatedConfig = await configureDirectoryConfig(config.directories[dirIndex]);
        if (updatedConfig) {
          config.directories[dirIndex] = updatedConfig;
        }
      }
    } else if (action === 'Remove Directory') {
      const dirIndex = await selectDirectory(config.directories);
      if (dirIndex !== undefined) {
        config.directories.splice(dirIndex, 1);
        if (config.directories.length === 0) {
          vscode.window.showWarningMessage('At least one directory configuration is required.');
          config.directories.push({
            sourceDirectory: '.',
            outputFile: `${getSafeProjectName(workspaceFolder)}_packed_code.txt`,
            exclusionPatterns: getDefaultExclusionPatterns(),
            inclusionPatterns: getDefaultInclusionPatterns()
          });
        }
      }
    }
  }

  const configPath = path.join(workspaceFolder.uri.fsPath, '.vscode', 'code-packer.json');
  try {
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
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

async function configureDirectoryConfig(existing?: DirectoryConfig): Promise<DirectoryConfig | null> {
  const sourceDirectory = await vscode.window.showInputBox({
    prompt: 'Enter source directory (relative to workspace root)',
    value: existing?.sourceDirectory || '.',
    placeHolder: '.',
    validateInput: input => input.includes('..') ? 'Path cannot contain ".."' : null
  });
  
  if (!sourceDirectory) {return null;}

  const outputFile = await vscode.window.showInputBox({
    prompt: 'Enter output file name',
    value: existing?.outputFile || undefined,
    placeHolder: 'packed_code.txt'
  });
  
  if (!outputFile) {return null;}

  const exclusions = await vscode.window.showInputBox({
    prompt: 'Enter exclusion patterns (comma-separated)',
    value: existing?.exclusionPatterns.join(', ') || getDefaultExclusionPatterns().join(', '),
    placeHolder: getDefaultExclusionPatterns().join(', ')
  });
  
  if (!exclusions) {return null;}

  const inclusions = await vscode.window.showInputBox({
    prompt: 'Enter inclusion patterns (comma-separated)',
    value: existing?.inclusionPatterns.join(', ') || getDefaultInclusionPatterns().join(', '),
    placeHolder: getDefaultInclusionPatterns().join(', ')
  });
  
  if (!inclusions) {return null;}

  return {
    sourceDirectory,
    outputFile,
    exclusionPatterns: exclusions.split(',').map(p => p.trim()).filter(p => p !== ''),
    inclusionPatterns: inclusions.split(',').map(p => p.trim()).filter(p => p !== '')
  };
}

async function selectDirectory(directories: DirectoryConfig[]): Promise<number | undefined> {
  const items = directories.map((dir, index) => ({
    label: `${index + 1}. ${dir.sourceDirectory}`,
    description: `Output: ${dir.outputFile}`,
    index
  }));

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select a directory configuration'
  });

  return selected?.index;
}
