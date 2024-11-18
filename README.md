# Code Packer

<p align="center">
  <img src="./images/codepacker-icon.png" alt="Code Packer Logo" width="128"/>
</p>

Code Packer is a Visual Studio Code extension that allows you to easily pack your project's code files into text files for sharing with LLMs. This makes it simple to share specific parts of your project while keeping the file sizes manageable.

## Features

### Pack Code

Quickly pack your code using the status bar button or command palette. You can pack all configured directories at once, creating separate output files for each.

### Generate Branch Diffs (Experimental)

> **Note**: The Git diff feature is currently experimental. While functional, you may encounter some issues with certain file types or edge cases. We're actively working on improvements.

Generate text files containing diffs between any two git branches in your repository:

1. Click the "Generate Diff" button in the status bar or use the command palette
2. Select your source and target branches from the dropdown menus
3. Choose a name for your output file
4. The diff will be generated with helpful metadata and saved to your specified file

### Configure Settings

Easily configure your packing settings through the extension's UI. Add, edit, or remove directory configurations as needed.

### Explorer View

View and manage your Code Packer configurations in the VS Code explorer. Each directory configuration shows its source, output, and patterns.

## Requirements

- Visual Studio Code version 1.90.0 or higher
- Git extension must be enabled for diff generation feature

## Configuration

You can create a project-specific configuration file `.vscode/code-packer.json` with the following structure:

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
  "debug": false,
  "diffConfig": {
    "exclusionPatterns": ["node_modules/**", "dist/**"],
    "inclusionPatterns": ["src/**/*.ts", "*.json"],
    "maxFileSize": 2048,
    "includeBinaryFiles": false
  }
}
```

Alternatively, you can use the built-in configuration UI to manage your settings.

## Commands

All commands can be accessed through the Command Palette (Ctrl+Shift+P / Cmd+Shift+P) under the "Code Packer" category:

- `Code Packer: Pack Code` - Pack your code according to current configuration
- `Code Packer: Generate Branch Diff` - Create a diff between two git branches (experimental)
- `Code Packer: Configure Settings` - Open the configuration UI

These commands are also available through buttons in the status bar for quick access.

## Known Issues

- The Git diff feature is experimental and may have issues with certain file types or edge cases
- Binary files are currently excluded from diffs by default
- Large files (>1MB) are excluded from diffs by default

For other issues or to report a bug, please visit our [GitHub issues page](https://github.com/JustinSchneider/CodePacker/issues).

## Release Notes

See the [Change Log](CHANGELOG.md) for the full version history and list of changes.

## Contributing

If you'd like to contribute to the development of Code Packer, please visit our [GitHub repository](https://github.com/JustinSchneider/CodePacker).

## License

This extension is licensed under the [MIT License](LICENSE.md).
