# Code Packer

<p align="center">
  <img src="./images/codepacker-icon.png" alt="Code Packer Logo" width="128"/>
</p>

Code Packer is a Visual Studio Code extension that allows you to easily pack your project's code files into text files. This makes it simple to share specific parts of your project with LLMs, ensuring accurate context while keeping the file sizes manageable.

## Features

- Pack multiple code directories into separate text files
- Configure different patterns and outputs for each directory
- Customizable source directories, output files, and file patterns
- Exclude specific files or directories from packing
- Include only specific file types in the packed output
- Easy-to-use interface with status bar button and explorer view
- Project-specific and global configuration options
- Debug mode for troubleshooting

### Pack Code

Quickly pack your code using the status bar button or command palette. You can pack all configured directories at once, creating separate output files for each.

### Configure Settings

Easily configure your packing settings through the extension's UI. Add, edit, or remove directory configurations as needed.

### Explorer View

View and manage your Code Packer configurations in the VS Code explorer. Each directory configuration shows its source, output, and patterns.

## Requirements

This extension requires Visual Studio Code version 1.90.0 or higher.

## Extension Settings

This extension contributes the following settings:

- `codePacker.debug`: Enable or disable debug mode for Code Packer.
- `codePacker.defaultSourceDirectory`: Set the default source directory for new configurations (relative to workspace root).
- `codePacker.defaultOutputFile`: Set the default output file name for new configurations.
- `codePacker.defaultExclusionPatterns`: Set default patterns for files to exclude from packing.
- `codePacker.defaultInclusionPatterns`: Set default patterns for files to include in packing.

You can configure these settings globally in your VS Code settings, or per-project in the `.vscode/settings.json` file.

Additionally, you can create a project-specific configuration file `.vscode/code-packer.json` with the following structure:

```json
{
  "directories": [
    {
      "sourceDirectory": "src/frontend",
      "outputFile": "frontend_code.txt",
      "exclusionPatterns": ["node_modules", "dist", "*.test.ts"],
      "inclusionPatterns": ["*.ts", "*.tsx", "*.css", "*.json"]
    },
    {
      "sourceDirectory": "src/backend",
      "outputFile": "backend_code.txt",
      "exclusionPatterns": ["node_modules", "dist", "*.test.ts"],
      "inclusionPatterns": ["*.ts", "*.js", "*.json"]
    }
  ],
  "debug": false
}
```

## How to Use

1. Install the Code Packer extension from the VS Code Marketplace.
2. Open a project in VS Code.
3. Click the "Pack Code" button in the status bar or run the "Pack Code" command from the command palette.
4. If it's your first time using the extension in the project, you'll be prompted to configure your settings.
5. Add one or more directory configurations through the configuration UI:
   - Choose "Configure Code Packer" from the command palette
   - Use "Add New Directory" to create additional configurations
   - Set the source directory, output file, and patterns for each
6. The extension will pack your code according to your settings and save it to the specified output files.
7. You can view and modify your current configurations in the Code Packer explorer view.

## Known Issues

Currently, there are no known issues. If you encounter any problems, please report them on our [GitHub issues page](https://github.com/JustinSchneider/CodePacker/issues).

## Release Notes

### 1.1.0

- Added support for multiple directory configurations
- Each directory can now have its own output file and patterns
- Updated UI to manage multiple directory configurations
- Maintained backward compatibility with single-directory config

### 1.0.2

- Fixed issue with recursive named-file exclusion.

### 1.0.1

- Fixed issue with recursive directory exclusion.

### 1.0.0

- Initial release

---

## Contributing

If you'd like to contribute to the development of Code Packer, please visit our [GitHub repository](https://github.com/JustinSchneider/CodePacker).

## License

This extension is licensed under the [MIT License](LICENSE.md).
