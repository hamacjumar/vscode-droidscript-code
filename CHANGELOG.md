# Change Log

Notable releases.

### Version 0.3.0
- refactored project management
- new `Sync Project` dialog options
- associate projects with custom location
- multiple open projects in workspace
- Run `alt+r` and Stop `alt+s` keybinds
- improved docs tree view
- improved project tree view
- docs opens github.io when not connected to DS
- ignore hidden and custom files from jsconfig.json
- significantly increased sync speed via parallel downloads
- many other UX improvements

**Typing**
- Support for JSDoc typed code bases
- Typescript definition files for the whole DroidScript API, including Hybrid, GameView and Material UI
- `smartDeclare` feature to migrate code to using types
- Use the strong VSCode js/ts intellisense capabilities!

### Version 0.2.8
- Fixed autocompletion, signatureHelpProvider, hoverProvider and intellisense for app scope.
- Fixed autocompletion, signatureHelpProvider, hoverProvider and intellisense for ui scope.
- Fixed autocompletion, signatureHelpProvider, hoverProvider and intellisense for MUI scope.
- Auto display the documentation on the right panel when folder is detected as DroidScript project.
- Use Live Preview to open documentation.
- Docs is now shipped to the extension.
- Automatically open the root file for each droidscript project.
- Added context menus to projects and samples.
- Improved connection to wifi IDE.
- Support for DS V3 samples with categories.
- Added support for backward compatibility for old droidscript versions.
- Improved creating an app process.
- Added template quick pick step when creating an app.
- Added support for creating python app.
- Added support for running python samples.
- Updated README file.
- Learn more option will now open the README file.
- Added opening of a project to a new window of vs code.
- Fixed premium samples not showing on non-premium users.
- Added a process to check for premium templates when creating an app in non-premium users.

### Version 0.2.6
- Added Project Name at the bottom status bar.
- Hide `.droidscript` folder to secret folder.
- Load source files from the secret folder for intellisense support.
- Started working on displaying all DroidScript projects in a Projects TreeView.
- Hide the `.droidscript` folder in all local copy of DroidScript projects.
- Added `Projects` treeview in the DroidScript section.
- Added `learn more` webview panel.
- Added feature to open a project when project-name is selected in the Projects TreeView.

- Fixed `listenToTerminal` error.
- Add new `DroidScript: Create new app` command to create apps directly in VS Code.
- Implement different types of DS apps in `DroidScript: Create new app` command.
- Add `delete` view-action item in each tree-item in Projects section to delete the app directly in VS Code.
- Add `rename` view-action item in each tree-item in Projects section to rename the app directly in VS Code.
- Add `play` view-action item in each tree item in Sample section to run the samples directly in VS Code.

### Version 0.2.5 - 2023-06-30
- Fixed error in downloading text files.

### 0.2.2 - 2023-06-19
- Show the Documentation in the right side panel to allow persistent docs viewing.
- Move complete dsconfig data into other place.
- Added complete code completion and intellisense to app, ui and MUI namespaces.
- Added complete code completion and intellisense to methods and properties on app, ui and MUI namespaces.

### 0.2.1 - 2023-06-07
- Fixed space at the start of `ui` object completion.

### 0.1.9 - 2023-06-03
- Fixed deletion of subfolders in the vscode extension path for samples.
- Add the top-level documentation only to the Docs section.
- Added network error handling for Play and Stop buttons.
- Fixed samples not showing when selected.
- More fixes and error handling for connection issues.
- Fixed app not running when there is no active editor.

### 0.1.8 - 2023-05-22
- Added Folders from DroidScript projects to the local copy of the project.
- Upload assets to DroidScript project folders. Just drag and drop the files into the vscode explorer folder. All the files will then be push to the associated DroidScript project.

### 0.1.6 - 2023-05-20
- Added DroidScript Samples with premium feature checking.
- Enable running the samples within the vscode extension.

### 0.1.5 - 2023-05-19
- Added DroidScript Docs and DroidScript Panel.
- More fixes on connection errror handling.

### 0.1.4 - 2023-05-18
- Added autocompletion for app, MUI and ui objects.

### 0.1.2 - 2023-05-16
- Added Debug Logs on OUTPUT panel.
- Added connection status on bottom status bar.
- Added reconnect dialog when saving, deleting, renaming and creating files.

### 0.1.1 - 2023-04-13
- Added error handling when password is incorrect.

### 0.1.0 - 2023-04-05
- Initial release...