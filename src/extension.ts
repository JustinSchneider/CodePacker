import * as vscode from 'vscode';
import {loadConfig, configureCodePacker} from './config';
import {packCode} from './fileOperations';
import {generateDiff, promptForDiffConfig} from './gitOperations';
import {CodePackerTreeDataProvider} from './uiComponents';
import {debugLog, initializeDebugLogging, updateDebugMode} from './utils';

let packCodeStatusBarItem: vscode.StatusBarItem;
let generateDiffStatusBarItem: vscode.StatusBarItem;

function createStatusBarItems(context: vscode.ExtensionContext) {
	// Pack Code button
	packCodeStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	packCodeStatusBarItem.text = "$(package) Pack Code";
	packCodeStatusBarItem.command = 'extension.packCode';
	packCodeStatusBarItem.tooltip = "Pack your code files into a single text file";
	packCodeStatusBarItem.show();
	context.subscriptions.push(packCodeStatusBarItem);

	// Generate Diff button
	generateDiffStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
	generateDiffStatusBarItem.text = "$(git-compare) Generate Diff";
	generateDiffStatusBarItem.command = 'extension.generateDiff';
	generateDiffStatusBarItem.tooltip = "Generate a diff between two branches";
	generateDiffStatusBarItem.show();
	context.subscriptions.push(generateDiffStatusBarItem);
}

export async function activate(context: vscode.ExtensionContext) {
    // Initialize logging first
    initializeDebugLogging();
    debugLog('Activating extension');

    // Create and show status bar item immediately
    createStatusBarItems(context);

    // Set up tree view
    const treeDataProvider = new CodePackerTreeDataProvider();
    vscode.window.createTreeView('codePackerExplorer', {treeDataProvider});

    // Register the pack code command
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.packCode', async () => {
            try {
                const config = await loadConfig();
                if (!config) {
                    const response = await vscode.window.showErrorMessage(
                        'No configuration found. Would you like to configure Code Packer now?',
                        'Yes', 'No'
                    );
                    if (response === 'Yes') {
                        await configureCodePacker();
                        // Retry packing after configuration
                        const newConfig = await loadConfig();
                        if (newConfig) {
                            await packCode(newConfig);
                        }
                    }
                    return;
                }
                await packCode(config);
                treeDataProvider.refresh();
            } catch (error) {
                vscode.window.showErrorMessage(`Error during code packing: ${error}`);
            }
        })
		);
	
		// Register the generate diff command
		context.subscriptions.push(
			vscode.commands.registerCommand('extension.generateDiff', async () => {
					try {
							const config = await promptForDiffConfig();
							if (config) {
									const diff = await generateDiff(config);
									if (diff) {
										vscode.window.showInformationMessage(
												`Diff generated successfully: ${config.outputFile}`,
												'Open in Explorer'
										).then(selection => {
												if (selection === 'Open in Explorer') {
														const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
														if (workspaceFolder) {
																const outputPath = vscode.Uri.file(
																		vscode.Uri.joinPath(workspaceFolder.uri, config.outputFile).fsPath
																);
																vscode.commands.executeCommand('revealFileInOS', outputPath);
														}
												}
										});
								}
							}
					} catch (error) {
							vscode.window.showErrorMessage(`Error generating diff: ${error}`);
					}
			})
		);

    // Register the configure command
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

    // Watch for configuration changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('codePacker.debug')) {
                updateDebugMode();
            }
        })
    );

    debugLog('Extension activated');
}

export function deactivate() {
	if (packCodeStatusBarItem) {
			packCodeStatusBarItem.dispose();
	}
	if (generateDiffStatusBarItem) {
			generateDiffStatusBarItem.dispose();
	}
}