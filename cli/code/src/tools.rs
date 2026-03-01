use std::io::{self, Write};
use std::path::{Path, PathBuf};
use serde_json::Value;
use colored::Colorize;
use similar::{ChangeTag, TextDiff};

pub enum ToolResult {
    Ok(String),
    Err(String),
    Denied,
}

pub fn tool_definitions() -> Value {
    serde_json::json!([
        {
            "name": "read_file",
            "description": "Read the full contents of a file.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "path": { "type": "string", "description": "Path relative to project root" }
                },
                "required": ["path"]
            }
        },
        {
            "name": "write_file",
            "description": "Write content to a file. Shows a diff for confirmation before writing.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "path":    { "type": "string" },
                    "content": { "type": "string" }
                },
                "required": ["path", "content"]
            }
        },
        {
            "name": "run_bash",
            "description": "Run a shell command in the project root. Always provide a description.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "command":     { "type": "string" },
                    "description": { "type": "string", "description": "What this command does" }
                },
                "required": ["command", "description"]
            }
        },
        {
            "name": "list_files",
            "description": "List files in a directory.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "path":    { "type": "string", "description": "Directory path (default: .)" },
                    "pattern": { "type": "string", "description": "Optional file extension filter, e.g. rs, ts, py" }
                }
            }
        },
        {
            "name": "search_code",
            "description": "Search for a pattern in code files using ripgrep (or grep fallback).",
            "input_schema": {
                "type": "object",
                "properties": {
                    "pattern":   { "type": "string" },
                    "path":      { "type": "string", "description": "Directory to search (default: .)" },
                    "file_type": { "type": "string", "description": "File extension filter, e.g. rs, ts" }
                },
                "required": ["pattern"]
            }
        }
    ])
}

pub async fn execute_tool(
    name: &str,
    input: &Value,
    root: &Path,
    editor: &Option<String>,
) -> ToolResult {
    match name {
        "read_file"   => tool_read_file(input, root),
        "write_file"  => tool_write_file(input, root, editor),
        "run_bash"    => tool_run_bash(input, root).await,
        "list_files"  => tool_list_files(input, root),
        "search_code" => tool_search_code(input, root),
        other => ToolResult::Err(format!("unknown tool: {}", other)),
    }
}

fn resolve(root: &Path, path: &str) -> PathBuf {
    let p = Path::new(path);
    if p.is_absolute() { p.to_path_buf() } else { root.join(p) }
}

fn tool_read_file(input: &Value, root: &Path) -> ToolResult {
    let path_str = match input["path"].as_str() {
        Some(p) => p,
        None => return ToolResult::Err("missing path".into()),
    };
    let path = resolve(root, path_str);
    match std::fs::read_to_string(&path) {
        Ok(content) => {
            let lines = content.lines().count();
            println!("  {} {} lines", "○".dimmed(), lines);
            ToolResult::Ok(content)
        }
        Err(e) => ToolResult::Err(e.to_string()),
    }
}

fn tool_write_file(input: &Value, root: &Path, editor: &Option<String>) -> ToolResult {
    let path_str = match input["path"].as_str() {
        Some(p) => p,
        None => return ToolResult::Err("missing path".into()),
    };
    let new_content = match input["content"].as_str() {
        Some(c) => c,
        None => return ToolResult::Err("missing content".into()),
    };

    let path = resolve(root, path_str);
    let old_content = std::fs::read_to_string(&path).unwrap_or_default();

    // Show diff
    println!();
    let diff = TextDiff::from_lines(old_content.as_str(), new_content);
    let mut has_changes = false;
    for change in diff.iter_all_changes() {
        match change.tag() {
            ChangeTag::Insert => {
                has_changes = true;
                print!("{}", format!("  + {}", change).green());
            }
            ChangeTag::Delete => {
                has_changes = true;
                print!("{}", format!("  - {}", change).red());
            }
            ChangeTag::Equal => {
                // skip equal lines for brevity — only show context
            }
        }
    }
    if !has_changes {
        println!("  {} no changes", "○".dimmed());
        return ToolResult::Ok("no changes needed".into());
    }

    println!();
    print!("  {} {} [Y/n] ", "Apply?".bold(), path_str.cyan());
    io::stdout().flush().ok();

    let mut ans = String::new();
    io::stdin().read_line(&mut ans).ok();
    if ans.trim().to_lowercase() == "n" {
        return ToolResult::Denied;
    }

    // Create parent dirs if needed
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).ok();
    }

    match std::fs::write(&path, new_content) {
        Ok(_) => {
            println!("  {} {}", "✓".green(), path_str);
            // Offer to open in editor
            if let Some(e) = editor {
                if e == "vscode" {
                    std::process::Command::new("code")
                        .arg("--goto")
                        .arg(path.strip_prefix(root).unwrap_or(&path).to_str().unwrap_or(""))
                        .spawn().ok();
                }
            }
            ToolResult::Ok(format!("Written {} bytes", new_content.len()))
        }
        Err(e) => ToolResult::Err(e.to_string()),
    }
}

async fn tool_run_bash(input: &Value, root: &Path) -> ToolResult {
    let cmd = match input["command"].as_str() {
        Some(c) => c,
        None => return ToolResult::Err("missing command".into()),
    };
    let desc = input["description"].as_str().unwrap_or(cmd);

    println!();
    println!("  {} {}", "$".yellow().bold(), cmd.yellow());
    println!("  {}", desc.dimmed());
    print!("  {} [Y/n] ", "Run?".bold());
    io::stdout().flush().ok();

    let mut ans = String::new();
    io::stdin().read_line(&mut ans).ok();
    if ans.trim().to_lowercase() == "n" {
        return ToolResult::Denied;
    }

    let output = tokio::process::Command::new("sh")
        .arg("-c")
        .arg(cmd)
        .current_dir(root)
        .output()
        .await;

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout).to_string();
            let stderr = String::from_utf8_lossy(&out.stderr).to_string();
            let combined = format!("{}{}", stdout, stderr);

            if out.status.success() {
                println!("  {} exit 0", "✓".green());
            } else {
                println!("  {} exit {}", "✗".red(), out.status.code().unwrap_or(-1));
            }

            // Print first 50 lines of output
            for line in combined.lines().take(50) {
                println!("  {}", line.dimmed());
            }
            if combined.lines().count() > 50 {
                println!("  {} (truncated)", "…".dimmed());
            }

            ToolResult::Ok(if combined.len() > 4000 {
                format!("{}…(truncated)", &combined[..4000])
            } else {
                combined
            })
        }
        Err(e) => ToolResult::Err(e.to_string()),
    }
}

fn tool_list_files(input: &Value, root: &Path) -> ToolResult {
    let path_str = input["path"].as_str().unwrap_or(".");
    let ext_filter = input["pattern"].as_str();
    let dir = resolve(root, path_str);

    let mut files: Vec<String> = vec![];

    fn walk(dir: &Path, root: &Path, ext: Option<&str>, files: &mut Vec<String>, depth: usize) {
        if depth > 4 { return; }
        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
                // Skip hidden dirs and common noise
                if name.starts_with('.') || name == "node_modules" || name == "target" || name == "__pycache__" {
                    continue;
                }
                if path.is_dir() {
                    walk(&path, root, ext, files, depth + 1);
                } else {
                    if let Some(e) = ext {
                        if !name.ends_with(&format!(".{}", e)) { continue; }
                    }
                    if let Ok(rel) = path.strip_prefix(root) {
                        files.push(rel.to_string_lossy().to_string());
                    }
                }
            }
        }
    }

    walk(&dir, root, ext_filter, &mut files, 0);
    files.sort();

    println!("  {} {} files", "○".dimmed(), files.len());
    ToolResult::Ok(files.join("\n"))
}

fn tool_search_code(input: &Value, root: &Path) -> ToolResult {
    let pattern = match input["pattern"].as_str() {
        Some(p) => p,
        None => return ToolResult::Err("missing pattern".into()),
    };
    let search_path = input["path"].as_str().unwrap_or(".");
    let file_type = input["file_type"].as_str();
    let dir = resolve(root, search_path);

    // Try rg first, fall back to grep
    let mut cmd = std::process::Command::new("rg");
    cmd.arg("--line-number")
       .arg("--color=never")
       .arg("--max-count=5")
       .arg("--max-depth=6");
    if let Some(ft) = file_type {
        cmd.arg("-t").arg(ft);
    }
    cmd.arg(pattern).arg(&dir);

    let output = cmd.output().unwrap_or_else(|_| {
        // fallback to grep
        let mut gc = std::process::Command::new("grep");
        gc.arg("-rn").arg("--include=*.*").arg(pattern).arg(&dir);
        gc.output().unwrap_or_else(|_| std::process::Output {
            status: std::process::ExitStatus::default(),
            stdout: vec![],
            stderr: vec![],
        })
    });

    let result = String::from_utf8_lossy(&output.stdout).to_string();
    let lines: Vec<&str> = result.lines().take(50).collect();
    println!("  {} {} matches", "○".dimmed(), lines.len());
    ToolResult::Ok(lines.join("\n"))
}
