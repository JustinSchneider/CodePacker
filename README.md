# Code Packer

<p align="center">
  <img src="./images/codepacker-icon.png" alt="Code Packer Logo" width="128"/>
</p>

Code Packer is a Visual Studio Code extension that allows you to easily pack your project's code files into a single text file. This allows you to share a single file with an LLM to give it full context of your project's code, ensuring accurate context of your project at any time.

## Features

- Pack multiple code files into a single text file
- Customizable source directory, output file, and file patterns
- Exclude specific files or directories from packing
- Include only specific file types in the packed output
- Easy-to-use interface with status bar button and explorer view
- Project-specific and global configuration options
- Debug mode for troubleshooting

### Pack Code
Quickly pack your code using the status bar button or command palette.

### Configure Settings
Easily configure your packing settings through the extension's UI.

### Explorer View
View your current Code Packer configuration in the VS Code explorer.

## Requirements

This extension requires Visual Studio Code version 1.90.0 or higher.

## Extension Settings

This extension contributes the following settings:

* `codePacker.debug`: Enable or disable debug mode for Code Packer.
* `codePacker.defaultSourceDirectory`: Set the default source directory for code packing (relative to workspace root).
* `codePacker.defaultOutputFile`: Set the default output file name for packed code.
* `codePacker.defaultExclusionPatterns`: Set default patterns for files to exclude from packing.
* `codePacker.defaultInclusionPatterns`: Set default patterns for files to include in packing.

You can configure these settings globally in your VS Code settings, or per-project in the `.vscode/settings.json` file.

Additionally, you can create a project-specific configuration file `.vscode/code-packer.json` with the following structure:

```json
{
  "sourceDirectory": ".",
  "outputFile": "packed_code.txt",
  "exclusionPatterns": [
    "node_modules",
    "dist",
    "*.vsix",
    "package-lock.json"
  ],
  "inclusionPatterns": [
    "*.ts",
    "*.js",
    "*.json",
    "*.md"
  ],
  "debug": false
}
```

## How to Use

1. Install the Code Packer extension from the VS Code Marketplace.
2. Open a project in VS Code.
3. Click the "Pack Code" button in the status bar or run the "Pack Code" command from the command palette.
4. If it's your first time using the extension in the project, you'll be prompted to configure your settings.
5. The extension will pack your code according to your settings and save it to the specified output file.
6. You can view and modify your current configuration in the Code Packer explorer view.

## Known Issues

Currently, there are no known issues. If you encounter any problems, please report them on our [GitHub issues page](https://github.com/JustinSchneider/CodePacker/issues).

## Release Notes

### 1.0.0

Initial release of Code Packer:
- Basic code packing functionality
- Customizable source directory, output file, and file patterns
- Status bar button for quick access
- Explorer view for configuration display
- Global and project-specific settings

---

## Contributing

If you'd like to contribute to the development of Code Packer, please visit our [GitHub repository](https://github.com/JustinSchneider/CodePacker).

## License

This extension is licensed under the [MIT License](LICENSE.md).