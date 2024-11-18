import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import {debugLog, setDebugMode} from './utils';

export interface DirectoryConfig {
  sourceDirectory: string;
  outputFile: string;
  exclusionPatterns: string[];
  inclusionPatterns: string[];
}

export interface CodePackerConfig {
  directories: DirectoryConfig[];
  debug: boolean;
  diffConfig?: Partial<DiffConfig>;
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
  }

  return null; // Return null if no config exists instead of creating defaults
}

export async function configureCodePacker(): Promise<CodePackerConfig | null> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('No workspace folder found. Please open a folder before configuring Code Packer.');
    return null;
  }

  debugLog('Workspace folder:', workspaceFolder.uri.fsPath);
  const currentConfig = loadConfig();

  // Start with an empty config if none exists
  const config: CodePackerConfig = currentConfig || {
    directories: [],
    debug: false
  };

  while (true) {
    const action = await vscode.window.showQuickPick([
      'Add New Directory',
      ...(config.directories.length > 0 ? ['Edit Directory', 'Remove Directory'] : []),
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
      if (config.directories.length === 0) {
        const response = await vscode.window.showWarningMessage(
          'No directories configured. Would you like to add one now?',
          'Yes', 'No'
        );
        if (response === 'Yes') {
          continue;
        } else {
          return null;
        }
      }
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
      }
    }
  }

  const configPath = path.join(workspaceFolder.uri.fsPath, '.vscode', 'code-packer.json');
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

async function configureDirectoryConfig(existing?: DirectoryConfig): Promise<DirectoryConfig | null> {
  const sourceDirectory = await vscode.window.showInputBox({
    prompt: 'Enter source directory (relative to workspace root)',
    value: existing?.sourceDirectory || '',
    placeHolder: 'src',
    validateInput: input => {
      if (!input.trim()) {
        return 'Source directory cannot be empty';
      }
      if (input.includes('..')) {
        return 'Path cannot contain ".."';
      }
      return null;
    }
  });

  if (!sourceDirectory) {return null;}

  const outputFile = await vscode.window.showInputBox({
    prompt: 'Enter output file name',
    value: existing?.outputFile || '',
    placeHolder: 'packed/project_source.txt',
    validateInput: input => {
      if (!input.trim()) {
        return 'Output file name cannot be empty';
      }
      return null;
    }
  });

  if (!outputFile) {return null;}

  const exclusions = await vscode.window.showInputBox({
    prompt: 'Enter exclusion patterns (comma-separated)',
    value: existing?.exclusionPatterns.join(', ') || '',
    placeHolder: 'node_modules, dist, *.test.ts, *.meta'
  });

  if (exclusions === undefined) {return null;}

  const inclusions = await vscode.window.showInputBox({
    prompt: 'Enter inclusion patterns (comma-separated)',
    value: existing?.inclusionPatterns.join(', ') || '',
    placeHolder: '*.cs, *.ts, *.json'
  });

  if (inclusions === undefined) {return null;}

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

export interface DiffConfig {
  // Branches to compare
  sourceBranch: string;
  targetBranch: string;
  outputFile: string;

  // Filtering patterns
  exclusionPatterns?: string[];  // e.g. ["*.meta", "ProjectSettings/*"]
  inclusionPatterns?: string[];  // e.g. ["*.cs", "*.ts"]

  // Content options
  includeBinaryFiles?: boolean;  // If true, at least note their presence
  includeMetaFiles?: boolean;    // Unity meta files
  maxFileSize?: number;         // Skip files larger than this (in KB)
}

export const DEFAULT_DIFF_CONFIG: Partial<DiffConfig> = {
  exclusionPatterns: [
    "node_modules/**",    // More specific pattern
    "dist/**",
    "out/**",
    "*.meta",             // Unity meta files
    "ProjectSettings/**", // Unity project settings
    "*.asset",           // Unity assets
    "package-lock.json", // NPM lock file
    "*.vsix",           // VS Code extension package
    "Library/**",        // Unity-specific directory
    "Temp/**",          // Unity-specific directory
    "Logs/**"           // Unity-specific directory
  ],
  inclusionPatterns: [
    "Assets/**/*.cs",     // Unity C# files
    "Assets/**/*.unity",  // Unity scene files
    "Assets/**/*.prefab", // Unity prefab files
    "Assets/**/*.asset",  // Unity asset files (if not excluded)
    "Packages/**/*.json", // Package manifests
    "ProjectSettings/**/*.asset" // Allow specific ProjectSettings
  ],
  includeBinaryFiles: false,
  includeMetaFiles: false,
  maxFileSize: 1024        // 1MB
};