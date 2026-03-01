mod api;
mod tools;
mod render;

use std::io::{self, Write};
use std::path::{Path, PathBuf};
use colored::Colorize;
use rustyline::DefaultEditor;
use rustyline::error::ReadlineError;

use api::{AnthropicClient, OpenAICompatClient, Provider, Message};
use tools::{tool_definitions, execute_tool};
use render::Renderer;

fn find_env_file() -> Option<PathBuf> {
    let mut dir = std::env::current_dir().ok()?;
    loop {
        for name in &[".env.local", ".env"] {
            let p = dir.join(name);
            if p.exists() { return Some(p); }
        }
        if !dir.pop() { return None; }
    }
}

fn find_project_root() -> PathBuf {
    let mut dir = std::env::current_dir().unwrap();
    loop {
        if dir.join(".git").exists() || dir.join("package.json").exists() || dir.join("Cargo.toml").exists() {
            return dir;
        }
        if !dir.pop() { break; }
    }
    std::env::current_dir().unwrap()
}

fn detect_editor() -> Option<String> {
    let term_program = std::env::var("TERM_PROGRAM").ok();
    let terminal_emulator = std::env::var("TERMINAL_EMULATOR").ok();
    let nvim = std::env::var("NVIM").ok();
    let zed = std::env::var("ZED_TERM").ok();

    if nvim.is_some() { return Some("neovim".into()); }
    if zed.is_some()  { return Some("zed".into()); }
    if let Some(t) = &term_program {
        if t.contains("vscode") || t.contains("Code") { return Some("vscode".into()); }
        if t.contains("iTerm") { return Some("iterm2".into()); }
    }
    if let Some(t) = &terminal_emulator {
        if t.contains("JetBrains") { return Some("jetbrains".into()); }
    }
    None
}

#[allow(dead_code)]
fn open_in_editor(path: &Path, editor: &Option<String>, root: &Path) {
    let rel = path.strip_prefix(root).unwrap_or(path);
    match editor.as_deref() {
        Some("vscode") => {
            std::process::Command::new("code")
                .arg("--goto").arg(rel.to_str().unwrap_or(""))
                .spawn().ok();
        }
        Some("neovim") => {
            // Send to neovim socket if available
            if let Ok(sock) = std::env::var("NVIM") {
                std::process::Command::new("nvim")
                    .arg("--server").arg(&sock)
                    .arg("--remote").arg(rel.to_str().unwrap_or(""))
                    .spawn().ok();
            }
        }
        _ => {}
    }
}

fn system_prompt(root: &Path, editor: &Option<String>) -> String {
    let editor_str = editor.as_deref().unwrap_or("terminal");
    let os = std::env::consts::OS;
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "sh".into());

    format!(
        "You are Deimos Code, an AI coding assistant running in the user's terminal.\n\
         You help developers read, write, and modify code.\n\n\
         Project root: {root}\n\
         Editor: {editor_str}\n\
         OS: {os}\n\
         Shell: {shell}\n\n\
         Guidelines:\n\
         - Always read files before modifying them\n\
         - Show a concise plan before making multiple changes\n\
         - Write complete, working code that follows existing patterns\n\
         - Be concise — don't over-explain unless asked\n\
         - For bash commands, describe what they do\n\
         - When you write a file, it gets shown as a diff for the user to confirm",
        root = root.display(),
    )
}

fn detect_provider() -> Provider {
    // Priority: Anthropic → OpenAI → Ollama (no key required)
    if let Ok(key) = std::env::var("ANTHROPIC_API_KEY") {
        if !key.is_empty() {
            let model = std::env::var("ANTHROPIC_MODEL")
                .unwrap_or_else(|_| "claude-sonnet-4-5".into());
            return Provider::Anthropic(AnthropicClient::new(key, model));
        }
    }
    if let Ok(key) = std::env::var("OPENAI_API_KEY") {
        if !key.is_empty() {
            let model = std::env::var("OPENAI_MODEL")
                .unwrap_or_else(|_| "gpt-4o".into());
            return Provider::OpenAI(OpenAICompatClient::openai(key, model));
        }
    }
    // Custom OpenAI-compatible base URL (e.g. local LM Studio, vLLM, etc.)
    if let Ok(base) = std::env::var("OPENAI_API_BASE") {
        let key = std::env::var("OPENAI_API_KEY").ok();
        let model = std::env::var("OPENAI_MODEL")
            .unwrap_or_else(|_| "default".into());
        return Provider::OpenAI(OpenAICompatClient::new(key, model, "custom".into(), base));
    }
    // Ollama — check if it's running
    let ollama_model = std::env::var("OLLAMA_MODEL")
        .unwrap_or_else(|_| "llama3.2".into());
    Provider::OpenAI(OpenAICompatClient::ollama(ollama_model))
}

#[tokio::main]
async fn main() {
    // Load .env
    if let Some(env_path) = find_env_file() {
        dotenvy::from_path(&env_path).ok();
    }

    let provider = detect_provider();

    let root = find_project_root();
    let editor = detect_editor();
    let renderer = Renderer::new();

    // Welcome
    println!();
    println!("  {} {}", "✦".bold(), "Deimos Code".bold());
    println!("  {} {}", "provider".dimmed(), provider.label().dimmed());
    println!("  {} {}", "model   ".dimmed(), provider.model().dimmed());
    println!("  {} {}", "root    ".dimmed(), root.display().to_string().dimmed());
    if let Some(e) = &editor {
        println!("  {} {}", "editor  ".dimmed(), e.dimmed());
    }
    println!();
    println!("{}", "  Type your request. /help for commands. Ctrl-C or /exit to quit.".dimmed());
    println!();
    let system = system_prompt(&root, &editor);
    let tools = tool_definitions();

    let mut messages: Vec<Message> = vec![];
    let history_path = dirs_path();
    let mut rl = DefaultEditor::new().unwrap();
    if let Some(ref hp) = history_path {
        rl.load_history(hp).ok();
    }

    loop {
        let input = match rl.readline(&format!("{} ", "❯".bold().to_string())) {
            Ok(line) => line.trim().to_string(),
            Err(ReadlineError::Interrupted) | Err(ReadlineError::Eof) => {
                println!("\n{}", "  bye.".dimmed());
                break;
            }
            Err(e) => {
                eprintln!("readline error: {}", e);
                break;
            }
        };

        if input.is_empty() { continue; }
        rl.add_history_entry(&input).ok();

        // Slash commands
        match input.as_str() {
            "/exit" | "/quit" => { println!("{}", "  bye.".dimmed()); break; }
            "/clear" => { messages.clear(); println!("{}", "  conversation cleared.".dimmed()); continue; }
            "/help" => {
                println!();
                println!("  {}", "Commands:".bold());
                println!("  {:<12} {}", "/clear".cyan(), "clear conversation history");
                println!("  {:<12} {}", "/exit".cyan(),  "quit");
                println!("  {:<12} {}", "/root".cyan(),  "show project root");
                println!();
                continue;
            }
            "/root" => { println!("  {}", root.display().to_string().cyan()); continue; }
            _ => {}
        }

        messages.push(Message::user(&input));

        // Agentic tool loop
        loop {
            print!("\n");
            io::stdout().flush().ok();

            let result = provider.stream(
                &system,
                &messages,
                &tools,
                |event| {
                    use api::StreamEvent::*;
                    match event {
                        Text(t) => { print!("{}", t); io::stdout().flush().ok(); }
                        ToolStart { name } => {
                            println!();
                            print!("  {} {}", "◈".cyan(), name.cyan().bold());
                            io::stdout().flush().ok();
                        }
                        ToolArg(s) => { print!(" {}", s.dimmed()); io::stdout().flush().ok(); }
                        Finished => {}
                    }
                },
            ).await;

            match result {
                Err(e) => {
                    eprintln!("\n{} {}", "✗".red(), e);
                    break;
                }
                Ok((blocks, tool_calls)) => {
                    // Add assistant response to history
                    messages.push(Message::assistant(blocks));

                    if tool_calls.is_empty() {
                        println!("\n");
                        break;
                    }

                    // Execute tools
                    let mut tool_results: Vec<serde_json::Value> = vec![];
                    for tc in &tool_calls {
                        println!();
                        let result = execute_tool(
                            &tc.name,
                            &tc.input,
                            &root,
                            &editor,
                        ).await;

                        match &result {
                            tools::ToolResult::Ok(output) => {
                                renderer.show_tool_result(&tc.name, output);
                                tool_results.push(serde_json::json!({
                                    "type": "tool_result",
                                    "tool_use_id": tc.id,
                                    "content": output,
                                }));
                            }
                            tools::ToolResult::Err(e) => {
                                eprintln!("  {} {}: {}", "✗".red(), tc.name, e);
                                tool_results.push(serde_json::json!({
                                    "type": "tool_result",
                                    "tool_use_id": tc.id,
                                    "content": format!("Error: {}", e),
                                    "is_error": true,
                                }));
                            }
                            tools::ToolResult::Denied => {
                                tool_results.push(serde_json::json!({
                                    "type": "tool_result",
                                    "tool_use_id": tc.id,
                                    "content": "User denied this action.",
                                    "is_error": true,
                                }));
                            }
                        }
                    }

                    messages.push(Message::user_blocks(tool_results));
                    // Continue loop — send tool results back to model
                }
            }
        }
    }

    if let Some(ref hp) = history_path {
        rl.save_history(hp).ok();
    }
}

fn dirs_path() -> Option<PathBuf> {
    let home = std::env::var("HOME").ok()?;
    let dir = PathBuf::from(home).join(".deimos");
    std::fs::create_dir_all(&dir).ok()?;
    Some(dir.join("code_history"))
}
