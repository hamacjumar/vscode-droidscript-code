# Contributing to this extension

You're contributing to FOSS just by using it. Taking it to the next level with a +1, reviews, public comments.  
You can also be a great contributor simply by answering questions for others, or even just by asking questions.  
It's especially helpful when you report issues and enhancement requests, and verify or +1 issues posted by others.

The ultimate in contributions is when you load the code, test, make changes, test some more ;\), and provide your code to others.

## Load and Run

You don't need to know anything about VSCode extensions. This is how you get started with this code as just another package to load and run.

- Fork the repo to your own account.
- Clone the repo to your workstation.
- Create a branch with a meaningful name for your work.
- Use `npm install` to load dependencies. (Not configured for PNPM)
- Uninstall the extension from VSCode.
- Catch up on [Change Log](./CHANGELOG.md) for v0.3.4 and [Highlights](./Highlights.md).
- See [v0.3.5](./v0.3.5.md) notes. (Pull from upstream to update)
- Run package.json script `build`. This generates droidscript-code-0.3.5.vsix.
  - When prompted for a license file, enter 'y' to continue without one.
  - You may see a note like this:
    > The latest version of @vscode/vsce is 3.6.0 and you have 2.32.0.  
    > Update it now: npm install -g @vscode/vsce
    - Update vsce, exit/restart VSCode, rebuild.
- In VSCode, go to Extensions, the "..." menu, and Install from VSIX.

The version will always be 0.3.5. We cannot use a build ID like 0.3.5.1.

## Making Changes

This project can't provide the information required for working with VSCode extensions. You need to get that [education](https://code.visualstudio.com/api) on your own. Continue here after you feel competent to modify a VSCode extension.

**Before writing code for features or fixes, get acknowledgement in the repo!**  
**Don't spend time writing code that someone else may already be working on.**

Do not publish your VSIX anywhere for others to download. Do not load any unknown VSIX files.

Ask questions in Discord. Check repo Issues. Verify open issues. Create new issues.

Update code in your branch, push to origin.

## PR upstream.

- Please keep PRs small and focused, or at least separate related code into different commits.
- Try to make it easy for someone to understand what you've done.
- Reference open/verified issues.  
- Document in your PR what you are changing and why so that the code can be easily checked and approved.
- Please have patience during this process. It takes time to understand and verify issues, test PRs, merge, re-test, etc.

## Links:

- Repo (Issues/PRs): https://github.com/hamacjumar/vscode-droidscript-code
- Marketplace: https://marketplace.visualstudio.com/items?itemName=droidscript.droidscript-code
- Discord Discussions
  - Server : https://discord.com/invite/MUhvxxbXeK
  - Channel : DroidScript > #vscode

## Thank you for contributing to DroidScript!!!!
