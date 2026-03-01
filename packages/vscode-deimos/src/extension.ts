import * as vscode from "vscode";

let replTerminal: vscode.Terminal | undefined;

function getReplBin(): string {
	return vscode.workspace.getConfiguration("deimos").get("replPath", "code");
}

function getOrCreateTerminal(): vscode.Terminal {
	// Reuse existing terminal if still alive
	if (replTerminal && vscode.window.terminals.includes(replTerminal)) {
		return replTerminal;
	}

	const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

	replTerminal = vscode.window.createTerminal({
		name: "✦ Deimos Code",
		cwd: workspaceRoot,
		env: { TERM_PROGRAM: "vscode" },
		iconPath: new vscode.ThemeIcon("sparkle"),
	});

	return replTerminal;
}

export function activate(context: vscode.ExtensionContext) {
	// Open REPL command
	context.subscriptions.push(
		vscode.commands.registerCommand("deimos.openRepl", () => {
			const terminal = getOrCreateTerminal();
			terminal.show(false);
			// Start the REPL if not already running
			terminal.sendText(getReplBin(), true);
		}),
	);

	// Ask about selection
	context.subscriptions.push(
		vscode.commands.registerCommand("deimos.askAboutSelection", () => {
			const editor = vscode.window.activeTextEditor;
			if (!editor) return;

			const selection = editor.document.getText(editor.selection);
			if (!selection) {
				vscode.window.showWarningMessage("No text selected.");
				return;
			}

			const file = vscode.workspace.asRelativePath(editor.document.uri);
			const lang = editor.document.languageId;

			const terminal = getOrCreateTerminal();
			terminal.show(false);

			// Send context to the REPL as a user message
			const prompt = `In ${file} (${lang}), explain this code:\n\`\`\`${lang}\n${selection}\n\`\`\``;
			terminal.sendText(getReplBin(), false);
			// Wait a moment then send the prompt
			setTimeout(() => {
				terminal.sendText(prompt, true);
			}, 1500);
		}),
	);

	// Explain file
	context.subscriptions.push(
		vscode.commands.registerCommand("deimos.explainFile", () => {
			const editor = vscode.window.activeTextEditor;
			if (!editor) return;

			const file = vscode.workspace.asRelativePath(editor.document.uri);
			const terminal = getOrCreateTerminal();
			terminal.show(false);
			setTimeout(() => {
				terminal.sendText(`Explain what ${file} does`, true);
			}, 1500);
		}),
	);

	// Auto-open if configured
	if (vscode.workspace.getConfiguration("deimos").get("autoOpen")) {
		vscode.commands.executeCommand("deimos.openRepl");
	}
}

export function deactivate() {
	replTerminal?.dispose();
}
