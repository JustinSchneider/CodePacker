import * as vscode from 'vscode';
import {loadConfig, configureCodePacker} from './config';
import {packCode} from './fileOperations';
import {CodePackerTreeDataProvider} from './uiComponents';
import {debugLog, initializeDebugLogging, updateDebugMode} from './utils';

export function activate(context: vscode.ExtensionContext) {
	initializeDebugLogging();
	debugLog('Activating extension');

	const treeDataProvider = new CodePackerTreeDataProvider();
	vscode.window.createTreeView('codePackerExplorer', {treeDataProvider});

	const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	statusBarItem.text = "$(package) Pack Code";
	statusBarItem.command = 'extension.packCode';
	statusBarItem.show();
	context.subscriptions.push(statusBarItem);

	context.subscriptions.push(
		vscode.commands.registerCommand('extension.packCode', async () => {
			try {
				const config = await loadConfig();
				if (!config) {
					throw new Error('Failed to load configuration');
				}
				await packCode(config);
				treeDataProvider.refresh();
			} catch (error) {
				vscode.window.showErrorMessage(`Error during code packing: ${error}`);
			}
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('extension.configureCodePacker', async () => {
			try {
				await configureCodePacker();
				treeDataProvider.refresh();
			} catch (error) {
				vscode.window.showErrorMessage(`Error during configuration: ${error}`);
			}
		})
	);

	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('codePacker.debug')) {
				updateDebugMode();
			}
		})
	);

	debugLog('Extension activated');
}

export function deactivate() {}