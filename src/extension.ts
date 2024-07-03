import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

interface CodePackerConfig {
	sourceDirectory: string;
	outputFile: string;
	exclusionPatterns: string[];
	inclusionPatterns: string[];
}

class CodePackerTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
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

export function activate(context: vscode.ExtensionContext) {
	const treeDataProvider = new CodePackerTreeDataProvider();
	vscode.window.createTreeView('codePackerExplorer', {treeDataProvider});

	const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	statusBarItem.text = "$(package) Pack Code";
	statusBarItem.command = 'extension.packCode';
	statusBarItem.show();
	context.subscriptions.push(statusBarItem);

	let disposable = vscode.commands.registerCommand('extension.packCode', async () => {
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		if (!workspaceFolder) {
			vscode.window.showErrorMessage('No workspace folder found');
			return;
		}

		const config = await loadConfig();
		if (!config) {
			vscode.window.showErrorMessage('Failed to load configuration');
			return;
		}

		const outputContent = await packCode(config);
		if (outputContent) {
			const outputPath = path.join(workspaceFolder.uri.fsPath, config.outputFile);
			fs.writeFileSync(outputPath, outputContent);
			vscode.window.showInformationMessage(`Code packed successfully to ${outputPath}`);
			vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(outputPath));
			treeDataProvider.refresh();
		}
	});

	context.subscriptions.push(disposable);

	context.subscriptions.push(vscode.commands.registerCommand('extension.configureCodePacker', async () => {
		const config = await configureCodePacker();
		if (config) {
			treeDataProvider.refresh();
		}
	}));
}

function loadConfig(): CodePackerConfig | null {
	const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
	if (!workspaceFolder) {return null;}

	const configPath = path.join(workspaceFolder.uri.fsPath, '.vscode', 'code-packer.json');
	if (fs.existsSync(configPath)) {
		const configContent = fs.readFileSync(configPath, 'utf8');
		return JSON.parse(configContent);
	} else {
		const settings = vscode.workspace.getConfiguration('codePacker');
		return {
			sourceDirectory: settings.get('defaultSourceDirectory', '.'),
			outputFile: settings.get('defaultOutputFile', 'packed_code.txt'),
			exclusionPatterns: settings.get('defaultExclusionPatterns', []),
			inclusionPatterns: settings.get('defaultInclusionPatterns', [])
		};
	}
}

async function configureCodePacker(): Promise<CodePackerConfig | null> {
	const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
	if (!workspaceFolder) {return null;}

	const config = loadConfig() || {
		sourceDirectory: '.',
		outputFile: 'packed_code.txt',
		exclusionPatterns: [],
		inclusionPatterns: []
	};

	config.sourceDirectory = await vscode.window.showInputBox({prompt: 'Enter source directory (relative to workspace root)', value: config.sourceDirectory}) || config.sourceDirectory;
	config.outputFile = await vscode.window.showInputBox({prompt: 'Enter output file name', value: config.outputFile}) || config.outputFile;
	const exclusions = await vscode.window.showInputBox({prompt: 'Enter exclusion patterns (comma-separated)', value: config.exclusionPatterns.join(',')});
	if (exclusions !== undefined) {config.exclusionPatterns = exclusions.split(',').map(p => p.trim());}
	const inclusions = await vscode.window.showInputBox({prompt: 'Enter inclusion patterns (comma-separated)', value: config.inclusionPatterns.join(',')});
	if (inclusions !== undefined) {config.inclusionPatterns = inclusions.split(',').map(p => p.trim());}

	const configPath = path.join(workspaceFolder.uri.fsPath, '.vscode', 'code-packer.json');
	fs.mkdirSync(path.dirname(configPath), {recursive: true});
	fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

	return config;
}

async function packCode(config: CodePackerConfig): Promise<string | null> {
	const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
	if (!workspaceFolder) {return null;}

	const sourceDir = path.join(workspaceFolder.uri.fsPath, config.sourceDirectory);
	let output = '';

	output += "--- START OF HEADER ---\n";
	output += `Generated on: ${new Date().toISOString()}\n`;
	output += "Generated by: VS Code Code Packer Extension\n";
	output += "Purpose: Code packing for analysis or documentation\n";
	output += "--- END OF HEADER ---\n\n";

	const files = await vscode.workspace.findFiles(
		new vscode.RelativePattern(config.sourceDirectory, '**/*'),
		`{${config.exclusionPatterns.join(',')}}`
	);

	for (const file of files) {
		const relativePath = path.relative(sourceDir, file.fsPath);
		if (config.inclusionPatterns.length === 0 || config.inclusionPatterns.some(pattern => minimatch(relativePath, pattern))) {
			const content = fs.readFileSync(file.fsPath, 'utf8');
			output += `--- FILE: ${relativePath} ---\n`;
			output += content;
			output += "\n--- END FILE ---\n\n";
		}
	}

	return output;
}

function minimatch(filePath: string, pattern: string): boolean {
	const regexPattern = pattern
		.replace(/\./g, '\\.')
		.replace(/\*/g, '.*')
		.replace(/\?/g, '.');
	return new RegExp(`^${regexPattern}$`, 'i').test(filePath);
}

export function deactivate() {}