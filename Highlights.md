# DroidScript-Code 0.3.2 Release Notes

Welcome to the 0.3.2 Release of DroidScript-Code. There are many updates in this version that we hope you'll like. Some of the key highlights include:

- [**Type support**](#typing) - Use JSDoc together with VS Code strong JS/TS intellisense capabilities
- [**Major UX improvements**](#ux-improvements) - Updated Docs & Project views
- [**Improved Project Management**](#project-management) - Choose save locations and ignore files in jsconfig.json
- [**New Sync features**](#sync-features) - Support multiple sync options, parallel processing and track all unsynced changes when disconnected

You can find the [Full Changelog](#full-change-log) at the bottom.

## Typing

- Support for JSDoc typed code bases
- Typescript definition files for the whole DroidScript API, including Hybrid, GameView and Material UI
- smartDeclare feature to migrate code to using types
- Use the strong VSCode js/ts intellisense capabilities!

![Type Error](https://imgur.com/blN1NlD.png)\
Type Error

![Inferred Types](https://imgur.com/usKhrxL.png)\
Inferred Types

## UX Improvements

Many new dialogs and features were added to the UI. This includes updated project view which displays project icons and local paths, and an updated docs tree view that is now collapsible based on lists found in the rendered document. When you are not connected to DroidScript the docs are loaded from [droidscript.github.io](https://droidscript.github.io/Docs)

You may also notice a wide range of new confirmation dialogs, error messages and more that hopefully improve your experience with this extension!

![Tree Views](https://imgur.com/uvHBtIi.png)

## Project Management

When opening a new project you will be asked where to save the project locally. You can either choose to use the same parent folder as the current open project, or assign a custom location.

It is recommended that you have all your projects in the same folder.
We suggest using `$userHome/DroidScript` as parent directory for all DroidScript projects, but you can choose any path you like.

## Sync Features

When opening a project you are offered a range of sync options. 

**Upload** If you made changes to your project offline you can choose to upload your files to DroidScript.

**Download** If you made changes to your project in DroidScript you want to download those changes first.

**Update** Both operations offer a update variant that only syncs files that are available both locally and in DroidScript. This is to prevent downloading large files or folders that you don't need on the other end.

![Sync Options](https://imgur.com/RnHdnbo.png)

## Full Change Log

Here is the full changelog since the last release:

### Version 0.3.0 (2024-01-23)
- Refactored project management
- New `Sync Project` dialog options
- Associate projects with custom location
- Multiple open projects in workspace
- Run `alt+r` and Stop `alt+s` keybinds
- Improved docs tree view
- Improved project tree view
- Docs opens github.io when not connected to DS
- Ignore hidden and custom files from jsconfig.json
- Significantly increased sync speed via parallel downloads
- Many other UX improvements

### Version 0.3.1
- Fixed opening main file when opening projects
- Focus vscode explorer view when opening projects
- Fixed build excluding required source file

### Version 0.3.2 (2024-01-24)
- Tracking **all** unsaved changes while disconnected, confirm dialog
- Fixed smartDeclare inferring global numbers
- Auto detect debug mode
- Showing Release Highlight page
- Always show sync qickpick on project open
- Fixed project reload logic when not in DS project
