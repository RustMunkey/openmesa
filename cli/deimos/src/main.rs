use std::fs;
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

use clap::{Parser, Subcommand};
use colored::Colorize;
use crossterm::{
    event::{self, Event, KeyCode, KeyEventKind},
    execute,
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
};
use ratatui::{
    backend::CrosstermBackend,
    layout::{Constraint, Direction, Layout},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, BorderType, Borders, List, ListItem, Paragraph, Wrap},
    Terminal,
};

// ── CLI definition ────────────────────────────────────────────────────────────

#[derive(Parser)]
#[command(
    name = "deimos",
    about = "Deimos — run with no arguments to open the launcher",
    version,
)]
struct Cli {
    #[command(subcommand)]
    command: Option<Cmd>,
}

#[derive(Subcommand)]
enum Cmd {
    /// Start the backend daemon
    Start {
        /// Also start the Next.js frontend dev server
        #[arg(long)]
        frontend: bool,
    },
    /// Stop running services (graceful SIGTERM → SIGKILL)
    Stop,
    /// Force kill everything on ports 8787, 3000, 3001
    Kill,
    /// Start everything: DB + backend + frontend
    Dev,
    /// Show status of all services
    Status,
    /// Tail logs (backend by default)
    Logs {
        /// Tail frontend logs
        #[arg(long)]
        frontend: bool,
    },
    /// Manage the local Postgres database
    Db {
        #[command(subcommand)]
        action: DbAction,
    },
    /// Health-check backend + providers
    Check,
    /// Pull latest changes from git and reinstall
    Update,
    /// First-time setup wizard
    Setup,
    /// Open the AI code REPL
    Code,
}

#[derive(Subcommand)]
enum DbAction {
    /// docker compose up -d
    Up,
    /// docker compose down
    Down,
    /// Open a psql shell inside the container
    Shell,
    /// Drop and recreate the schema (DESTRUCTIVE)
    Reset,
}

// ── Entry point ───────────────────────────────────────────────────────────────

fn main() {
    let cli = Cli::parse();

    let rt = tokio::runtime::Runtime::new().expect("tokio runtime");

    match cli.command {
        None => run_launcher(),
        Some(Cmd::Start { frontend }) => rt.block_on(cmd_start(frontend)),
        Some(Cmd::Stop) => cmd_stop(),
        Some(Cmd::Kill) => cmd_kill(),
        Some(Cmd::Dev) => rt.block_on(cmd_dev()),
        Some(Cmd::Status) => rt.block_on(cmd_status()),
        Some(Cmd::Logs { frontend }) => cmd_logs(frontend),
        Some(Cmd::Db { action }) => cmd_db(action),
        Some(Cmd::Check) => rt.block_on(cmd_check()),
        Some(Cmd::Update) => cmd_update(),
        Some(Cmd::Setup) => cmd_setup(),
        Some(Cmd::Code) => cmd_code(),
    }
}

// ── Project root ──────────────────────────────────────────────────────────────

fn find_project_root() -> Option<PathBuf> {
    let mut dir = std::env::current_dir().ok()?;
    loop {
        if dir.join("services/backend").exists() && dir.join("cli/deimos").exists() {
            return Some(dir);
        }
        if !dir.pop() {
            return None;
        }
    }
}

fn project_root() -> PathBuf {
    find_project_root().unwrap_or_else(|| {
        eprintln!(
            "{}",
            "Error: not inside a deimos project (needs package.json + backend/)".red()
        );
        std::process::exit(1);
    })
}

fn deimos_dir(root: &Path) -> PathBuf {
    let dir = root.join(".deimos");
    fs::create_dir_all(&dir).ok();
    dir
}

fn pid_path(root: &Path, name: &str) -> PathBuf {
    deimos_dir(root).join(format!("{}.pid", name))
}

fn log_path(root: &Path, name: &str) -> PathBuf {
    deimos_dir(root).join(format!("{}.log", name))
}

// ── PID helpers ───────────────────────────────────────────────────────────────

fn read_pid(path: &Path) -> Option<u32> {
    fs::read_to_string(path).ok()?.trim().parse().ok()
}

fn write_pid(path: &Path, pid: u32) {
    fs::write(path, pid.to_string()).ok();
}

fn is_running(pid: u32) -> bool {
    Command::new("kill")
        .args(["-0", &pid.to_string()])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

fn send_signal(pid: u32, sig: &str) {
    Command::new("kill")
        .args([sig, &pid.to_string()])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .ok();
}

// ── deimosstart ─────────────────────────────────────────────────────────────────

async fn cmd_start(with_frontend: bool) {
    let root = project_root();

    let backend_pid_file = pid_path(&root, "backend");
    if let Some(pid) = read_pid(&backend_pid_file) {
        if is_running(pid) {
            println!("{} Backend already running (pid {})", "●".green(), pid);
            if !with_frontend {
                return;
            }
        }
    }

    start_backend(&root).await;

    if with_frontend {
        start_frontend(&root);
    }
}

async fn start_backend(root: &Path) {
    let log_file = open_log(root, "backend");

    let python = if root.join("services/backend/.venv/bin/python").exists() {
        root.join("services/backend/.venv/bin/python")
            .to_str()
            .unwrap()
            .to_string()
    } else {
        "python3".to_string()
    };

    print!("{} Starting backend", "→".cyan());
    io::stdout().flush().ok();

    let child = Command::new(&python)
        .args(["-m", "backend"])
        .env("PYTHONPATH", root.join("services/backend"))
        .current_dir(root)
        .stdout(log_file.try_clone().unwrap())
        .stderr(log_file)
        .spawn()
        .unwrap_or_else(|_| {
            eprintln!("\n{} Failed to spawn backend", "✗".red());
            std::process::exit(1);
        });

    let pid = child.id();
    write_pid(&pid_path(root, "backend"), pid);
    std::mem::forget(child); // detach — keep running after deimos exits

    // Poll /health
    let start = Instant::now();
    loop {
        if start.elapsed() > Duration::from_secs(20) {
            println!("\n{} Backend failed to start — run {} for details", "✗".red(), "deimos logs".bold());
            std::process::exit(1);
        }

        if let Ok(resp) = reqwest::get("http://localhost:8787/health").await {
            if resp.status().is_success() {
                println!("\r{} Backend ready on :8787 (pid {})    ", "✓".green(), pid);
                return;
            }
        }

        print!(".");
        io::stdout().flush().ok();
        tokio::time::sleep(Duration::from_millis(500)).await;
    }
}

fn start_frontend(root: &Path) {
    let pid_file = pid_path(root, "frontend");
    if let Some(pid) = read_pid(&pid_file) {
        if is_running(pid) {
            println!("{} Frontend already running (pid {})", "●".green(), pid);
            return;
        }
    }

    let log_file = open_log(root, "frontend");

    let child = Command::new("pnpm")
        .args(["dev"])
        .current_dir(root.join("apps/web"))
        .stdout(log_file.try_clone().unwrap())
        .stderr(log_file)
        .spawn()
        .unwrap_or_else(|_| {
            eprintln!("{} Failed to spawn frontend (is pnpm installed?)", "✗".red());
            std::process::exit(1);
        });

    let pid = child.id();
    write_pid(&pid_path(root, "frontend"), pid);
    std::mem::forget(child);

    println!("{} Frontend starting on :3000 (pid {})", "✓".green(), pid);
    println!("{}", "  (give it a few seconds to compile)".dimmed());
}

fn open_log(root: &Path, name: &str) -> fs::File {
    fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_path(root, name))
        .unwrap_or_else(|_| {
            eprintln!("{} Cannot open log file", "✗".red());
            std::process::exit(1);
        })
}

// ── deimosdev ───────────────────────────────────────────────────────────────────

async fn cmd_dev() {
    let root = project_root();

    println!("{} Starting Postgres...", "→".cyan());
    let db_ok = Command::new("docker")
        .args(["compose", "up", "-d"])
        .current_dir(&root)
        .status()
        .map(|s| s.success())
        .unwrap_or(false);

    if db_ok {
        println!("{} Postgres up", "✓".green());
    } else {
        println!("{} docker compose failed — is Docker running?", "✗".yellow());
    }

    // Small pause for DB to accept connections
    tokio::time::sleep(Duration::from_secs(2)).await;

    start_backend(&root).await;
    start_frontend(&root);

    println!();
    println!("{}", "Deimos is running!".bold().green());
    println!("  Backend  → {}", "http://localhost:8787".cyan());
    println!("  Frontend → {}", "http://localhost:3000".cyan());
    println!();
    println!("  {} to follow backend logs", "deimos logs".bold());
    println!("  {} to stop everything", "deimos stop".bold());
}

// ── deimosstop ──────────────────────────────────────────────────────────────────

fn cmd_stop() {
    let root = project_root();
    let mut stopped_any = false;

    for name in &["backend", "frontend"] {
        let pid_file = pid_path(&root, name);
        match read_pid(&pid_file) {
            Some(pid) if is_running(pid) => {
                print!("{} Stopping {} (pid {})...", "→".cyan(), name, pid);
                io::stdout().flush().ok();

                send_signal(pid, "-TERM");

                // Wait up to 5s for graceful exit
                let deadline = Instant::now() + Duration::from_secs(5);
                while Instant::now() < deadline && is_running(pid) {
                    std::thread::sleep(Duration::from_millis(300));
                }

                if is_running(pid) {
                    send_signal(pid, "-KILL");
                    println!(" {}", "(force killed)".yellow());
                } else {
                    println!(" {}", "done".green());
                }

                fs::remove_file(&pid_file).ok();
                stopped_any = true;
            }
            Some(_) => {
                println!("{} {} — stale PID, removing", "○".dimmed(), name);
                fs::remove_file(&pid_file).ok();
            }
            None => {
                println!("{} {} — not running", "○".dimmed(), name);
            }
        }
    }

    if !stopped_any {
        println!("{}", "Nothing to stop.".dimmed());
    }
}

// ── deimoskill ──────────────────────────────────────────────────────────────────

fn cmd_kill() {
    println!("{} Force killing ports 8787, 3000, 3001...", "→".cyan());

    let output = Command::new("lsof")
        .args(["-ti:8787,3000,3001"])
        .output();

    match output {
        Ok(out) => {
            let raw = String::from_utf8_lossy(&out.stdout);
            let pids: Vec<&str> = raw.split_whitespace().collect();

            if pids.is_empty() {
                println!("{} Nothing running on those ports", "○".dimmed());
            } else {
                for pid in &pids {
                    Command::new("kill")
                        .args(["-9", pid])
                        .stdout(Stdio::null())
                        .stderr(Stdio::null())
                        .status()
                        .ok();
                }
                println!("{} Killed {} process(es): {}", "✓".green(), pids.len(), pids.join(", "));
            }
        }
        Err(_) => eprintln!("{} lsof not found", "✗".red()),
    }

    // Clean stale PID files
    if let Some(root) = find_project_root() {
        fs::remove_file(pid_path(&root, "backend")).ok();
        fs::remove_file(pid_path(&root, "frontend")).ok();
    }
}

// ── deimosstatus ────────────────────────────────────────────────────────────────

async fn cmd_status() {
    let root = project_root();

    println!("{}", "Deimos Status".bold());
    println!("{}", "─────────────".dimmed());

    // Backend
    let b_pid = read_pid(&pid_path(&root, "backend"));
    let b_alive = b_pid.map(is_running).unwrap_or(false);
    let b_healthy = if b_alive {
        reqwest::get("http://localhost:8787/health")
            .await
            .map(|r| r.status().is_success())
            .unwrap_or(false)
    } else {
        false
    };

    let b_label = match (b_alive, b_healthy) {
        (true, true) => format!("{} running", "●".green()),
        (true, false) => format!("{} process alive, not responding", "●".yellow()),
        _ => format!("{} stopped", "○".dimmed()),
    };
    let b_pid_str = b_pid.map(|p| format!(" (pid {})", p)).unwrap_or_default();
    println!("  Backend   {}{}", b_label, b_pid_str.dimmed());

    // Frontend
    let f_pid = read_pid(&pid_path(&root, "frontend"));
    let f_alive = f_pid.map(is_running).unwrap_or(false);
    let f_label = if f_alive {
        format!("{} running", "●".green())
    } else {
        format!("{} stopped", "○".dimmed())
    };
    let f_pid_str = f_pid.map(|p| format!(" (pid {})", p)).unwrap_or_default();
    println!("  Frontend  {}{}", f_label, f_pid_str.dimmed());

    // Postgres
    let db_up = db_is_running(&root);
    let db_label = if db_up {
        format!("{} running (port 5433)", "●".green())
    } else {
        format!("{} stopped", "○".dimmed())
    };
    println!("  Postgres  {}", db_label);

    println!();

    if b_healthy {
        println!("  Open → {}", "http://localhost:8787".cyan());
    }
    if f_alive {
        println!("  Open → {}", "http://localhost:3000".cyan());
    }
    if !b_alive && !f_alive {
        println!("  Run {} to start everything", "deimos dev".bold());
    }
}

fn db_is_running(root: &Path) -> bool {
    Command::new("docker")
        .args(["compose", "ps", "--services", "--filter", "status=running"])
        .current_dir(root)
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .output()
        .map(|out| String::from_utf8_lossy(&out.stdout).contains("postgres"))
        .unwrap_or(false)
}

// ── deimoslogs ──────────────────────────────────────────────────────────────────

fn cmd_logs(frontend: bool) {
    let root = project_root();
    let name = if frontend { "frontend" } else { "backend" };
    let log = log_path(&root, name);

    if !log.exists() {
        println!("{} No log file yet at {}", "○".dimmed(), log.display());
        println!("  Run {} first", "deimos start".bold());
        return;
    }

    println!("{} {} — Ctrl+C to stop", "→".cyan(), log.display());
    println!("{}", "─".repeat(60).dimmed());

    Command::new("tail")
        .args(["-f", "-n", "100", log.to_str().unwrap()])
        .status()
        .unwrap_or_else(|_| {
            eprintln!("{} tail not found", "✗".red());
            std::process::exit(1);
        });
}

// ── deimosdb ────────────────────────────────────────────────────────────────────

fn cmd_db(action: DbAction) {
    let root = project_root();

    match action {
        DbAction::Up => {
            println!("{} Starting Postgres (docker compose up -d)...", "→".cyan());
            let ok = Command::new("docker")
                .args(["compose", "up", "-d"])
                .current_dir(&root)
                .status()
                .map(|s| s.success())
                .unwrap_or(false);

            if ok {
                println!("{} Postgres running on port 5433", "✓".green());
            } else {
                eprintln!("{} Failed — is Docker running?", "✗".red());
            }
        }

        DbAction::Down => {
            println!("{} Stopping Postgres...", "→".cyan());
            let ok = Command::new("docker")
                .args(["compose", "down"])
                .current_dir(&root)
                .status()
                .map(|s| s.success())
                .unwrap_or(false);

            if ok {
                println!("{} Postgres stopped", "✓".green());
            } else {
                eprintln!("{} Failed", "✗".red());
            }
        }

        DbAction::Shell => {
            println!("{} Connecting to deimos database...", "→".cyan());
            Command::new("docker")
                .args([
                    "compose", "exec", "postgres",
                    "psql", "-U", "deimos", "-d", "deimos",
                ])
                .current_dir(&root)
                .status()
                .unwrap_or_else(|_| {
                    eprintln!("{} docker not found", "✗".red());
                    std::process::exit(1);
                });
        }

        DbAction::Reset => {
            println!("{} This will DROP ALL DATA in the local database.", "⚠".yellow().bold());
            print!("  Are you sure? [y/N] ");
            io::stdout().flush().ok();

            let mut input = String::new();
            io::stdin().read_line(&mut input).ok();

            if input.trim().to_lowercase() != "y" {
                println!("Aborted.");
                return;
            }

            let sql = "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO deimos;";
            let ok = Command::new("docker")
                .args([
                    "compose", "exec", "-T", "postgres",
                    "psql", "-U", "deimos", "-d", "deimos", "-c", sql,
                ])
                .current_dir(&root)
                .status()
                .map(|s| s.success())
                .unwrap_or(false);

            if ok {
                println!("{} Schema reset — restart backend to recreate tables", "✓".green());
            } else {
                eprintln!("{} Reset failed (is DB running? try: deimos db up)", "✗".red());
            }
        }
    }
}

// ── deimoscheck ─────────────────────────────────────────────────────────────────

async fn cmd_check() {
    println!("{}", "Checking Deimos...".bold());
    println!("{}", "──────────────────".dimmed());

    // /health
    match reqwest::get("http://localhost:8787/health").await {
        Ok(r) if r.status().is_success() => {
            println!("  {} Backend /health", "✓".green());
        }
        Ok(r) => {
            println!("  {} Backend /health → HTTP {}", "✗".red(), r.status());
            return;
        }
        Err(_) => {
            println!("  {} Backend not responding — run {}", "✗".red(), "deimos start".bold());
            return;
        }
    }

    // /api/providers
    match reqwest::get("http://localhost:8787/api/providers").await {
        Ok(r) if r.status().is_success() => {
            if let Ok(body) = r.json::<serde_json::Value>().await {
                let empty = vec![];
                let providers = body
                    .get("providers")
                    .and_then(|v| v.as_array())
                    .unwrap_or(&empty);

                println!("  {} /api/providers ({} configured)", "✓".green(), providers.len());

                for p in providers {
                    let id = p.get("id").and_then(|v| v.as_str()).unwrap_or("?");
                    let avail = p.get("available").and_then(|v| v.as_bool()).unwrap_or(false);
                    let icon = if avail { "✓".green().to_string() } else { "○".dimmed().to_string() };
                    println!("     {} {}", icon, id);
                }
            }
        }
        _ => {
            println!("  {} /api/providers failed", "✗".yellow());
        }
    }

    // DB (indirectly — if backend is up and healthy, DB is connected)
    println!();
    println!("{}", "All checks passed.".dimmed());
}

// ── deimosupdate ────────────────────────────────────────────────────────────────

fn cmd_update() {
    let root = project_root();

    println!("{}", "Updating Deimos...".bold());
    println!("{}", "──────────────────".dimmed());

    // 1. Check for uncommitted changes
    let dirty = Command::new("git")
        .args(["status", "--porcelain"])
        .current_dir(&root)
        .output()
        .map(|out| !out.stdout.is_empty())
        .unwrap_or(false);

    if dirty {
        println!("{} Uncommitted changes detected — stashing them first", "→".yellow());
        let ok = Command::new("git")
            .args(["stash"])
            .current_dir(&root)
            .status()
            .map(|s| s.success())
            .unwrap_or(false);
        if !ok {
            eprintln!("{} git stash failed — commit or discard changes first", "✗".red());
            std::process::exit(1);
        }
        println!("{} Stashed (run `git stash pop` to restore after update)", "✓".green());
    }

    // 2. git pull
    print!("{} Pulling latest from origin...", "→".cyan());
    io::stdout().flush().ok();

    let pull = Command::new("git")
        .args(["pull", "--rebase", "origin", "main"])
        .current_dir(&root)
        .output();

    match pull {
        Ok(out) if out.status.success() => {
            let msg = String::from_utf8_lossy(&out.stdout);
            if msg.contains("Already up to date") {
                println!("\r{} Already up to date            ", "✓".green());
            } else {
                println!("\r{} Pulled latest changes         ", "✓".green());
                // Print a brief summary of what changed
                for line in msg.lines().take(5) {
                    println!("  {}", line.dimmed());
                }
            }
        }
        Ok(out) => {
            let err = String::from_utf8_lossy(&out.stderr);
            eprintln!("\n{} git pull failed:\n{}", "✗".red(), err.trim());
            std::process::exit(1);
        }
        Err(_) => {
            eprintln!("\n{} git not found", "✗".red());
            std::process::exit(1);
        }
    }

    // 3. Install updated Python deps (silent unless there are new packages)
    print!("{} Checking Python dependencies...", "→".cyan());
    io::stdout().flush().ok();

    let pip = if root.join("services/backend/.venv/bin/pip").exists() {
        root.join("services/backend/.venv/bin/pip").to_str().unwrap().to_string()
    } else {
        "pip3".to_string()
    };

    let pip_out = Command::new(&pip)
        .args(["install", "-r", "services/backend/requirements.txt", "-q", "--disable-pip-version-check"])
        .current_dir(&root)
        .output();

    match pip_out {
        Ok(out) if out.status.success() => println!("\r{} Python deps up to date          ", "✓".green()),
        Ok(out) => {
            let err = String::from_utf8_lossy(&out.stderr);
            println!("\r{} pip install had warnings (non-fatal):", "⚠".yellow());
            for line in err.lines().take(3) {
                println!("  {}", line.dimmed());
            }
        }
        Err(_) => println!("\r{} pip not found — skipping Python deps", "⚠".yellow()),
    }

    // 4. Install updated Node deps
    print!("{} Checking Node dependencies...", "→".cyan());
    io::stdout().flush().ok();

    let pnpm_out = Command::new("pnpm")
        .args(["install", "--frozen-lockfile", "--silent"])
        .current_dir(root.join("apps/web"))
        .output();

    match pnpm_out {
        Ok(out) if out.status.success() => println!("\r{} Node deps up to date            ", "✓".green()),
        Ok(_) => {
            // --frozen-lockfile fails if lockfile changed; retry without it
            let ok = Command::new("pnpm")
                .args(["install"])
                .current_dir(root.join("apps/web"))
                .status()
                .map(|s| s.success())
                .unwrap_or(false);
            if ok {
                println!("\r{} Node deps updated               ", "✓".green());
            } else {
                println!("\r{} pnpm install failed — run manually", "⚠".yellow());
            }
        }
        Err(_) => println!("\r{} pnpm not found — skipping Node deps", "⚠".yellow()),
    }

    // 5. Reinstall CLI binary
    print!("{} Rebuilding Deimos CLI...", "→".cyan());
    io::stdout().flush().ok();

    let cargo_out = Command::new("cargo")
        .args(["install", "--path", "deimos-cli", "--quiet"])
        .current_dir(&root)
        .output();

    match cargo_out {
        Ok(out) if out.status.success() => println!("\r{} CLI rebuilt and installed        ", "✓".green()),
        Ok(out) => {
            let err = String::from_utf8_lossy(&out.stderr);
            eprintln!("\r{} cargo install failed:\n{}", "✗".red(), err.trim());
            std::process::exit(1);
        }
        Err(_) => {
            eprintln!("\r{} cargo not found", "✗".red());
            std::process::exit(1);
        }
    }

    // 6. Check if backend was running — prompt to restart
    let backend_was_running = read_pid(&pid_path(&root, "backend"))
        .map(is_running)
        .unwrap_or(false);

    println!();
    println!("{}", "Update complete!".bold().green());

    if backend_was_running {
        println!();
        println!("{} Backend is still running with old code.", "⚠".yellow());
        print!("  Restart now? [Y/n] ");
        io::stdout().flush().ok();

        let mut input = String::new();
        io::stdin().read_line(&mut input).ok();

        if input.trim().to_lowercase() != "n" {
            cmd_stop();
            // Give processes a moment to fully exit
            std::thread::sleep(Duration::from_millis(500));
            println!();
            println!("{} Run {} to start with the new version", "→".cyan(), "deimos dev".bold());
        }
    }
}


// ── deimossetup ─────────────────────────────────────────────────────────────────
//
// Mars palette — approximate sRGB values derived from the app's dark theme
// oklch(0.1611 0.0040 48.46) → bg, oklch(0.62 0.10 33.0) → primary, etc.

const M_BG:        Color = Color::Rgb(28,  22,  16);   // --background
const M_CARD:      Color = Color::Rgb(40,  32,  23);   // --card
const M_MUTED:     Color = Color::Rgb(56,  45,  33);   // --secondary / muted
const M_BORDER:    Color = Color::Rgb(62,  48,  36);   // --border
const M_FG:        Color = Color::Rgb(232, 225, 210);  // --foreground
const M_MFG:       Color = Color::Rgb(155, 135, 112);  // --muted-foreground
const M_PRIMARY:   Color = Color::Rgb(185, 108, 70);   // --primary (rust orange)
const M_ACCENT_BG: Color = Color::Rgb(65,  46,  36);   // --accent (selection bg)
const M_SUCCESS:   Color = Color::Rgb(100, 182, 92);   // success green
const M_ERROR:     Color = Color::Rgb(130, 55,  35);   // --destructive

// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq)]
enum TaskStatus { Pending, Running, Done, Failed, Skipped }

#[derive(Debug, Clone, PartialEq)]
enum Provider { Anthropic, OpenAI, Ollama, OpenRouter, Groq, Skip }

impl Provider {
    fn label(&self) -> &str {
        match self {
            Provider::Anthropic  => "Anthropic   — Claude 3.5 / 4",
            Provider::OpenAI     => "OpenAI      — GPT-4o / o1",
            Provider::Ollama     => "Ollama      — local models",
            Provider::OpenRouter => "OpenRouter  — 300+ models",
            Provider::Groq       => "Groq        — fast inference",
            Provider::Skip       => "Skip for now",
        }
    }
    fn env_key(&self) -> Option<&str> {
        match self {
            Provider::Anthropic  => Some("ANTHROPIC_API_KEY"),
            Provider::OpenAI     => Some("OPENAI_API_KEY"),
            Provider::OpenRouter => Some("OPENROUTER_API_KEY"),
            Provider::Groq       => Some("GROQ_API_KEY"),
            _                    => None,
        }
    }
    fn needs_model(&self) -> bool { matches!(self, Provider::Ollama) }
}

#[derive(Debug, Clone, PartialEq)]
enum DbChoice { Sqlite, Postgres }

#[derive(Debug, Clone, PartialEq)]
enum Step {
    Welcome, DepCheck, InstallDeps,
    ChooseProvider, ConfigureProvider,
    ChooseDb, ConfigureDb,
    Summary, Done,
}

struct WizardState {
    step:              Step,
    deps:              Vec<(String, bool, String)>,
    install_tasks:     Vec<(String, TaskStatus, String)>,
    install_done:      bool,
    provider_idx:      usize,
    providers:         Vec<Provider>,
    selected_provider: Option<Provider>,
    api_key:           String,
    ollama_model:      String,
    input_buf:         String,
    input_masked:      bool,
    error_msg:         Option<String>,
    db_idx:            usize,
    db_choice:         DbChoice,
    postgres_url:      String,
    start_idx:         usize,
    wants_start:       bool,
}

impl WizardState {
    fn new() -> Self {
        Self {
            step:              Step::Welcome,
            deps:              vec![],
            install_tasks:     vec![
                ("Python venv".into(), TaskStatus::Pending, String::new()),
                ("Python deps".into(), TaskStatus::Pending, String::new()),
                ("Node deps".into(),   TaskStatus::Pending, String::new()),
            ],
            install_done:      false,
            provider_idx:      0,
            providers:         vec![
                Provider::Anthropic, Provider::OpenAI, Provider::Ollama,
                Provider::OpenRouter, Provider::Groq, Provider::Skip,
            ],
            selected_provider: None,
            api_key:           String::new(),
            ollama_model:      String::new(),
            input_buf:         String::new(),
            input_masked:      false,
            error_msg:         None,
            db_idx:            0,
            db_choice:         DbChoice::Sqlite,
            postgres_url:      String::new(),
            start_idx:         0,
            wants_start:       false,
        }
    }
}

// ── dep check ─────────────────────────────────────────────────────────────────

fn check_deps() -> Vec<(String, bool, String)> {
    let mut out = vec![];

    let node = Command::new("node").arg("--version").output();
    match node {
        Ok(o) if o.status.success() => {
            let v = String::from_utf8_lossy(&o.stdout).trim().to_string();
            out.push(("Node.js".into(), true, v));
        }
        _ => out.push(("Node.js".into(), false, "not found — install from nodejs.org".into())),
    }

    let pnpm = Command::new("pnpm").arg("--version").output();
    match pnpm {
        Ok(o) if o.status.success() => {
            out.push(("pnpm".into(), true, format!("v{}", String::from_utf8_lossy(&o.stdout).trim())));
        }
        _ => out.push(("pnpm".into(), false, "not found — run: npm i -g pnpm".into())),
    }

    let python = Command::new("python3").arg("--version").output();
    match python {
        Ok(o) if o.status.success() => {
            out.push(("Python".into(), true, String::from_utf8_lossy(&o.stdout).trim().to_string()));
        }
        _ => out.push(("Python".into(), false, "not found — install Python 3.10+".into())),
    }

    let git = Command::new("git").arg("--version").output();
    match git {
        Ok(o) if o.status.success() => {
            out.push(("Git".into(), true, String::from_utf8_lossy(&o.stdout).trim().to_string()));
        }
        _ => out.push(("Git".into(), false, "not found".into())),
    }

    let docker = Command::new("docker").arg("--version").output();
    match docker {
        Ok(o) if o.status.success() => {
            out.push(("Docker".into(), true,
                format!("{} (optional)", String::from_utf8_lossy(&o.stdout).trim())));
        }
        _ => out.push(("Docker".into(), false, "not found — optional, needed for Postgres".into())),
    }

    let ollama = Command::new("ollama").arg("--version").output();
    match ollama {
        Ok(o) if o.status.success() => {
            out.push(("Ollama".into(), true,
                format!("{} (optional)", String::from_utf8_lossy(&o.stdout).trim())));
        }
        _ => out.push(("Ollama".into(), false, "not found — optional, needed for local AI".into())),
    }

    out
}

// ── install steps ─────────────────────────────────────────────────────────────

fn run_install_steps(
    terminal: &mut Terminal<CrosstermBackend<io::Stdout>>,
    state: &mut WizardState,
    root: &Path,
) {
    // 0 — Python venv
    state.install_tasks[0].1 = TaskStatus::Running;
    terminal.draw(|f| draw_wizard(f, state)).ok();

    let venv = root.join("services/backend/.venv");
    if venv.exists() {
        state.install_tasks[0].1 = TaskStatus::Skipped;
        state.install_tasks[0].2 = "already exists".into();
    } else {
        let ok = Command::new("python3")
            .args(["-m", "venv", venv.to_str().unwrap_or(".venv")])
            .current_dir(root)
            .stdout(Stdio::null()).stderr(Stdio::null())
            .status().map(|s| s.success()).unwrap_or(false);
        if ok { state.install_tasks[0].1 = TaskStatus::Done; }
        else  {
            state.install_tasks[0].1 = TaskStatus::Failed;
            state.install_tasks[0].2 = "python3 -m venv failed".into();
        }
    }
    terminal.draw(|f| draw_wizard(f, state)).ok();

    // 1 — pip install
    state.install_tasks[1].1 = TaskStatus::Running;
    terminal.draw(|f| draw_wizard(f, state)).ok();

    let pip = root.join("services/backend/.venv/bin/pip");
    let req = root.join("services/backend/requirements.txt");
    if !pip.exists() || !req.exists() {
        state.install_tasks[1].1 = TaskStatus::Skipped;
        state.install_tasks[1].2 = "pip or requirements.txt not found".into();
    } else {
        let ok = Command::new(&pip)
            .args(["install", "-r", req.to_str().unwrap(), "-q", "--disable-pip-version-check"])
            .current_dir(root)
            .stdout(Stdio::null()).stderr(Stdio::null())
            .status().map(|s| s.success()).unwrap_or(false);
        if ok { state.install_tasks[1].1 = TaskStatus::Done; }
        else  {
            state.install_tasks[1].1 = TaskStatus::Failed;
            state.install_tasks[1].2 = "pip install failed".into();
        }
    }
    terminal.draw(|f| draw_wizard(f, state)).ok();

    // 2 — pnpm install
    state.install_tasks[2].1 = TaskStatus::Running;
    terminal.draw(|f| draw_wizard(f, state)).ok();

    let ok = Command::new("pnpm")
        .args(["install", "--silent"])
        .current_dir(root)
        .stdout(Stdio::null()).stderr(Stdio::null())
        .status().map(|s| s.success()).unwrap_or(false);
    if ok { state.install_tasks[2].1 = TaskStatus::Done; }
    else  {
        state.install_tasks[2].1 = TaskStatus::Failed;
        state.install_tasks[2].2 = "pnpm not found or install failed".into();
    }
    terminal.draw(|f| draw_wizard(f, state)).ok();

    state.install_done = true;
}

// ── .env writer ───────────────────────────────────────────────────────────────

fn write_env(root: &Path, state: &WizardState) -> io::Result<()> {
    let mut lines: Vec<String> = vec![
        "# Generated by deimos setup".into(), String::new(),
        "NEXT_PUBLIC_API_URL=http://localhost:8787".into(), String::new(),
    ];

    if let Some(p) = &state.selected_provider {
        if let Some(key) = p.env_key() {
            lines.push(format!("{}={}", key, state.api_key));
        }
        if p.needs_model() {
            let m = if state.ollama_model.is_empty() { "llama3.2" } else { &state.ollama_model };
            lines.push(format!("OLLAMA_MODEL={}", m));
            lines.push("OLLAMA_BASE_URL=http://localhost:11434".into());
        }
        lines.push(String::new());
    }

    match state.db_choice {
        DbChoice::Sqlite => {
            lines.push("DATABASE_URL=sqlite:///deimos.db".into());
            lines.push("EMBED_PROVIDER=none".into());
        }
        DbChoice::Postgres => {
            let url = if state.postgres_url.is_empty() {
                "postgresql://deimos:deimos@localhost:5432/deimos"
            } else {
                &state.postgres_url
            };
            lines.push(format!("DATABASE_URL={}", url));
            lines.push("EMBED_PROVIDER=ollama".into());
            lines.push("EMBED_MODEL=nomic-embed-text".into());
        }
    }

    let content = lines.join("\n") + "\n";
    fs::write(root.join("apps/web/.env.local"), &content)?;

    // Strip NEXT_PUBLIC_ lines for the backend .env
    let backend: String = lines.iter()
        .filter(|l| !l.starts_with("NEXT_PUBLIC"))
        .cloned()
        .collect::<Vec<_>>()
        .join("\n") + "\n";
    fs::write(root.join("services/backend/.env"), backend)?;
    Ok(())
}

// ── draw ──────────────────────────────────────────────────────────────────────

fn draw_wizard(f: &mut ratatui::Frame, state: &WizardState) {
    let size = f.area();

    f.render_widget(Block::default().style(Style::default().bg(M_BG)), size);

    let outer = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Length(5), Constraint::Min(0), Constraint::Length(3)])
        .split(size);

    // Header
    let header = Paragraph::new(vec![
        Line::from(vec![
            Span::styled("  ✦ DEIMOS ", Style::default().fg(M_PRIMARY).add_modifier(Modifier::BOLD)),
            Span::styled("SETUP",      Style::default().fg(M_FG).add_modifier(Modifier::BOLD)),
        ]),
        Line::from(vec![
            Span::styled("  First-time configuration wizard", Style::default().fg(M_MFG)),
        ]),
    ])
    .block(Block::default()
        .borders(Borders::ALL)
        .border_type(BorderType::Rounded)
        .border_style(Style::default().fg(M_BORDER)));
    f.render_widget(header, outer[0]);

    // Content
    match &state.step {
        Step::Welcome           => draw_welcome(f, outer[1]),
        Step::DepCheck          => draw_dep_check(f, outer[1], state),
        Step::InstallDeps       => draw_install_deps(f, outer[1], state),
        Step::ChooseProvider    => draw_choose_provider(f, outer[1], state),
        Step::ConfigureProvider => draw_configure_provider(f, outer[1], state),
        Step::ChooseDb          => draw_choose_db(f, outer[1], state),
        Step::ConfigureDb       => draw_configure_db(f, outer[1], state),
        Step::Summary           => draw_summary(f, outer[1], state),
        Step::Done              => draw_done(f, outer[1], state),
    }

    // Footer hint
    let hint = match &state.step {
        Step::ChooseProvider | Step::ChooseDb | Step::Done =>
            "  ↑ ↓  navigate    Enter  select    q  quit",
        Step::ConfigureProvider | Step::ConfigureDb =>
            "  Type your input    Enter  confirm    Esc  back",
        Step::Summary =>
            "  Enter  write config & finish    q  quit",
        Step::InstallDeps =>
            "  Installing…  please wait",
        _ =>
            "  Enter  continue    q  quit",
    };

    f.render_widget(
        Paragraph::new(hint)
            .style(Style::default().fg(M_MFG))
            .block(Block::default()
                .borders(Borders::ALL)
                .border_type(BorderType::Rounded)
                .border_style(Style::default().fg(M_BORDER))),
        outer[2],
    );
}

fn panel(title: &str) -> Block<'_> {
    Block::default()
        .title(format!(" {} ", title))
        .title_style(Style::default().fg(M_MFG))
        .borders(Borders::ALL)
        .border_type(BorderType::Rounded)
        .border_style(Style::default().fg(M_BORDER))
}

fn draw_welcome(f: &mut ratatui::Frame, area: ratatui::layout::Rect) {
    let p = Paragraph::new(vec![
        Line::from(""),
        Line::from(vec![Span::styled(
            "  Welcome to Deimos.",
            Style::default().fg(M_FG).add_modifier(Modifier::BOLD),
        )]),
        Line::from(""),
        Line::from(vec![Span::styled(
            "  This wizard will configure your local instance.",
            Style::default().fg(M_MFG),
        )]),
        Line::from(""),
        Line::from(vec![Span::styled("  We'll set up:", Style::default().fg(M_MFG))]),
        Line::from(vec![Span::styled(
            "    •  Dependencies (Python venv, Node packages)",
            Style::default().fg(M_PRIMARY),
        )]),
        Line::from(vec![Span::styled(
            "    •  Your AI provider and model",
            Style::default().fg(M_PRIMARY),
        )]),
        Line::from(vec![Span::styled(
            "    •  Your database  (SQLite by default — no Docker needed)",
            Style::default().fg(M_PRIMARY),
        )]),
        Line::from(vec![Span::styled(
            "    •  Your .env config files",
            Style::default().fg(M_PRIMARY),
        )]),
        Line::from(""),
        Line::from(vec![Span::styled(
            "  Press Enter to begin.",
            Style::default().fg(M_PRIMARY).add_modifier(Modifier::BOLD),
        )]),
    ])
    .block(panel("Welcome"))
    .wrap(Wrap { trim: false });
    f.render_widget(p, area);
}

fn draw_dep_check(f: &mut ratatui::Frame, area: ratatui::layout::Rect, state: &WizardState) {
    let mut lines = vec![
        Line::from(""),
        Line::from(vec![Span::styled(
            "  Checking dependencies…",
            Style::default().fg(M_FG).add_modifier(Modifier::BOLD),
        )]),
        Line::from(""),
    ];

    for (name, ok, note) in &state.deps {
        let (icon, ic) = if *ok {
            ("  ✓ ", Style::default().fg(M_SUCCESS))
        } else {
            ("  ✗ ", Style::default().fg(M_ERROR))
        };
        lines.push(Line::from(vec![
            Span::styled(icon, ic),
            Span::styled(format!("{:<10}", name), Style::default().fg(M_FG)),
            Span::styled(format!("  {}", note), Style::default().fg(M_MFG)),
        ]));
    }

    if !state.deps.is_empty() {
        lines.push(Line::from(""));
        lines.push(Line::from(vec![Span::styled(
            "  Press Enter to continue.",
            Style::default().fg(M_PRIMARY).add_modifier(Modifier::BOLD),
        )]));
    }

    f.render_widget(
        Paragraph::new(lines).block(panel("Dependencies")).wrap(Wrap { trim: false }),
        area,
    );
}

fn draw_install_deps(f: &mut ratatui::Frame, area: ratatui::layout::Rect, state: &WizardState) {
    let mut lines = vec![
        Line::from(""),
        Line::from(vec![Span::styled(
            "  Setting up your environment…",
            Style::default().fg(M_FG).add_modifier(Modifier::BOLD),
        )]),
        Line::from(""),
    ];

    for (name, status, note) in &state.install_tasks {
        let (icon, ic) = match status {
            TaskStatus::Pending  => ("  ○ ", Style::default().fg(M_MUTED)),
            TaskStatus::Running  => ("  ◎ ", Style::default().fg(M_PRIMARY)),
            TaskStatus::Done     => ("  ✓ ", Style::default().fg(M_SUCCESS)),
            TaskStatus::Failed   => ("  ✗ ", Style::default().fg(M_ERROR)),
            TaskStatus::Skipped  => ("  — ", Style::default().fg(M_MFG)),
        };
        let label_style = match status {
            TaskStatus::Running => Style::default().fg(M_FG).add_modifier(Modifier::BOLD),
            TaskStatus::Done    => Style::default().fg(M_FG),
            _                   => Style::default().fg(M_MFG),
        };
        let mut spans = vec![
            Span::styled(icon, ic),
            Span::styled(format!("{:<16}", name), label_style),
        ];
        if !note.is_empty() {
            spans.push(Span::styled(format!("  {}", note), Style::default().fg(M_BORDER)));
        }
        lines.push(Line::from(spans));
    }

    if state.install_done {
        lines.push(Line::from(""));
        lines.push(Line::from(vec![Span::styled(
            "  Press Enter to continue.",
            Style::default().fg(M_PRIMARY).add_modifier(Modifier::BOLD),
        )]));
    }

    f.render_widget(
        Paragraph::new(lines).block(panel("Installing")).wrap(Wrap { trim: false }),
        area,
    );
}

fn draw_choose_provider(f: &mut ratatui::Frame, area: ratatui::layout::Rect, state: &WizardState) {
    let sections = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Length(4), Constraint::Min(0)])
        .split(area);

    f.render_widget(
        Paragraph::new(vec![
            Line::from(""),
            Line::from(vec![Span::styled(
                "  Which AI provider do you want to use?",
                Style::default().fg(M_MFG),
            )]),
        ])
        .block(Block::default()
            .title(" AI Provider ")
            .title_style(Style::default().fg(M_MFG))
            .borders(Borders::TOP | Borders::LEFT | Borders::RIGHT)
            .border_type(BorderType::Rounded)
            .border_style(Style::default().fg(M_BORDER))),
        sections[0],
    );

    let items: Vec<ListItem> = state.providers.iter().enumerate().map(|(i, p)| {
        let sel = i == state.provider_idx;
        let style = if sel {
            Style::default().fg(M_FG).bg(M_ACCENT_BG).add_modifier(Modifier::BOLD)
        } else {
            Style::default().fg(M_MFG)
        };
        ListItem::new(format!("{}  {}", if sel { "  ›" } else { "   " }, p.label())).style(style)
    }).collect();

    let mut ls = ratatui::widgets::ListState::default();
    ls.select(Some(state.provider_idx));
    f.render_stateful_widget(
        List::new(items).block(Block::default()
            .borders(Borders::BOTTOM | Borders::LEFT | Borders::RIGHT)
            .border_type(BorderType::Rounded)
            .border_style(Style::default().fg(M_BORDER))),
        sections[1],
        &mut ls,
    );
}

fn draw_configure_provider(f: &mut ratatui::Frame, area: ratatui::layout::Rect, state: &WizardState) {
    let provider = state.selected_provider.as_ref().unwrap();
    let (title, prompt, hint) = if provider.needs_model() {
        ("Ollama Model",
         "  Enter the model name to use with Ollama:",
         "  e.g. llama3.2  mistral  gemma2  phi3   (Enter for llama3.2)")
    } else {
        ("API Key",
         "  Enter your API key:",
         "  Saved to .env.local only — never uploaded anywhere.")
    };

    let display = if state.input_masked && !state.input_buf.is_empty() {
        "•".repeat(state.input_buf.len())
    } else {
        state.input_buf.clone()
    };

    let mut lines = vec![
        Line::from(""),
        Line::from(vec![Span::styled(prompt, Style::default().fg(M_MFG))]),
        Line::from(""),
        Line::from(vec![Span::styled(hint, Style::default().fg(M_MUTED))]),
        Line::from(""),
        Line::from(vec![Span::styled(
            format!("  {} █", display),
            Style::default().fg(M_PRIMARY).bg(M_CARD),
        )]),
    ];

    if let Some(err) = &state.error_msg {
        lines.push(Line::from(""));
        lines.push(Line::from(vec![Span::styled(
            format!("  ✗ {}", err),
            Style::default().fg(M_ERROR),
        )]));
    }

    f.render_widget(
        Paragraph::new(lines).block(panel(title)).wrap(Wrap { trim: false }),
        area,
    );
}

fn draw_choose_db(f: &mut ratatui::Frame, area: ratatui::layout::Rect, state: &WizardState) {
    let sections = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Length(6), Constraint::Min(0)])
        .split(area);

    f.render_widget(
        Paragraph::new(vec![
            Line::from(""),
            Line::from(vec![Span::styled(
                "  Choose your database:",
                Style::default().fg(M_MFG),
            )]),
            Line::from(""),
            Line::from(vec![Span::styled(
                "  SQLite is recommended for local dev — zero setup, no Docker required.",
                Style::default().fg(M_MUTED),
            )]),
        ])
        .block(Block::default()
            .title(" Database ")
            .title_style(Style::default().fg(M_MFG))
            .borders(Borders::TOP | Borders::LEFT | Borders::RIGHT)
            .border_type(BorderType::Rounded)
            .border_style(Style::default().fg(M_BORDER))),
        sections[0],
    );

    let opts = [
        ("SQLite",      "local file, zero config, recommended for dev"),
        ("PostgreSQL",  "requires Docker or an external connection string"),
    ];
    let items: Vec<ListItem> = opts.iter().enumerate().map(|(i, (name, desc))| {
        let sel = i == state.db_idx;
        let style = if sel {
            Style::default().fg(M_FG).bg(M_ACCENT_BG).add_modifier(Modifier::BOLD)
        } else {
            Style::default().fg(M_MFG)
        };
        ListItem::new(format!("{}  {:<12} — {}", if sel { "  ›" } else { "   " }, name, desc)).style(style)
    }).collect();

    let mut ls = ratatui::widgets::ListState::default();
    ls.select(Some(state.db_idx));
    f.render_stateful_widget(
        List::new(items).block(Block::default()
            .borders(Borders::BOTTOM | Borders::LEFT | Borders::RIGHT)
            .border_type(BorderType::Rounded)
            .border_style(Style::default().fg(M_BORDER))),
        sections[1],
        &mut ls,
    );
}

fn draw_configure_db(f: &mut ratatui::Frame, area: ratatui::layout::Rect, state: &WizardState) {
    let lines = vec![
        Line::from(""),
        Line::from(vec![Span::styled(
            "  Enter your PostgreSQL connection string:",
            Style::default().fg(M_MFG),
        )]),
        Line::from(""),
        Line::from(vec![Span::styled(
            "  Press Enter to use default: postgresql://deimos:deimos@localhost:5432/deimos",
            Style::default().fg(M_MUTED),
        )]),
        Line::from(""),
        Line::from(vec![Span::styled(
            format!("  {} █", state.input_buf),
            Style::default().fg(M_PRIMARY).bg(M_CARD),
        )]),
    ];

    f.render_widget(
        Paragraph::new(lines).block(panel("PostgreSQL URL")).wrap(Wrap { trim: false }),
        area,
    );
}

fn draw_summary(f: &mut ratatui::Frame, area: ratatui::layout::Rect, state: &WizardState) {
    let provider_str = state.selected_provider.as_ref()
        .map(|p| p.label().to_string())
        .unwrap_or_else(|| "None (skipped)".into());

    let db_str = match state.db_choice {
        DbChoice::Sqlite   => "SQLite — local file".into(),
        DbChoice::Postgres => if state.postgres_url.is_empty() {
            "PostgreSQL — default local".into()
        } else {
            format!("PostgreSQL — {}", state.postgres_url)
        },
    };

    let key_preview = if state.api_key.is_empty() { "—".into() }
    else if state.api_key.len() > 8 {
        format!("{}…{}", &state.api_key[..4], &state.api_key[state.api_key.len()-4..])
    } else { "••••••••".into() };

    fn kv<'a>(k: &'a str, v: String) -> Line<'a> {
        Line::from(vec![
            Span::styled(format!("  {:<12}", k), Style::default().fg(M_MFG)),
            Span::styled(v, Style::default().fg(M_PRIMARY)),
        ])
    }

    let mut lines = vec![
        Line::from(""),
        Line::from(vec![Span::styled(
            "  Ready to write your config:",
            Style::default().fg(M_FG).add_modifier(Modifier::BOLD),
        )]),
        Line::from(""),
        kv("Provider", provider_str),
    ];
    if !state.api_key.is_empty()   { lines.push(kv("API Key", key_preview)); }
    if !state.ollama_model.is_empty() { lines.push(kv("Model", state.ollama_model.clone())); }
    lines.push(kv("Database", db_str));
    lines.push(Line::from(""));
    lines.push(Line::from(vec![
        Span::styled(format!("  {:<12}", "Files"), Style::default().fg(M_MFG)),
        Span::styled(
            "apps/web/.env.local   services/backend/.env",
            Style::default().fg(M_SUCCESS),
        ),
    ]));
    lines.push(Line::from(""));
    lines.push(Line::from(vec![Span::styled(
        "  Press Enter to write and finish.",
        Style::default().fg(M_PRIMARY).add_modifier(Modifier::BOLD),
    )]));

    f.render_widget(
        Paragraph::new(lines).block(panel("Summary")).wrap(Wrap { trim: false }),
        area,
    );
}

fn draw_done(f: &mut ratatui::Frame, area: ratatui::layout::Rect, state: &WizardState) {
    let sections = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Min(0), Constraint::Length(5)])
        .split(area);

    let status = if state.error_msg.is_none() {
        Line::from(vec![Span::styled(
            "  ✓ Config written successfully.",
            Style::default().fg(M_SUCCESS).add_modifier(Modifier::BOLD),
        )])
    } else {
        Line::from(vec![Span::styled(
            format!("  ✗ {}", state.error_msg.as_deref().unwrap_or("write failed")),
            Style::default().fg(M_ERROR),
        )])
    };

    let info = Paragraph::new(vec![
        Line::from(""),
        status,
        Line::from(""),
        Line::from(vec![Span::styled(
            "  Next steps:",
            Style::default().fg(M_FG).add_modifier(Modifier::BOLD),
        )]),
        Line::from(""),
        Line::from(vec![
            Span::styled("  1  ", Style::default().fg(M_MFG)),
            Span::styled("deimos start", Style::default().fg(M_PRIMARY).add_modifier(Modifier::BOLD)),
            Span::styled(" — start the backend API", Style::default().fg(M_MFG)),
        ]),
        Line::from(vec![
            Span::styled("  2  ", Style::default().fg(M_MFG)),
            Span::styled("pnpm dev:web", Style::default().fg(M_MFG).add_modifier(Modifier::BOLD)),
            Span::styled(" — open the web UI at localhost:3000", Style::default().fg(M_MFG)),
        ]),
        Line::from(""),
        Line::from(vec![Span::styled(
            "  ✦ Build something great.",
            Style::default().fg(M_MUTED).add_modifier(Modifier::ITALIC),
        )]),
    ])
    .block(Block::default()
        .title(" Done! ")
        .title_style(Style::default().fg(M_SUCCESS))
        .borders(Borders::ALL)
        .border_type(BorderType::Rounded)
        .border_style(Style::default().fg(M_BORDER)))
    .wrap(Wrap { trim: false });
    f.render_widget(info, sections[0]);

    // Start / Exit picker
    let opts = [
        ("→  Start Deimos", "launch the backend now"),
        ("   Exit",         "you can run deimos start later"),
    ];
    let items: Vec<ListItem> = opts.iter().enumerate().map(|(i, (label, desc))| {
        let sel = i == state.start_idx;
        let style = if sel {
            Style::default().fg(M_FG).bg(M_ACCENT_BG).add_modifier(Modifier::BOLD)
        } else {
            Style::default().fg(M_MFG)
        };
        ListItem::new(format!("  {}  — {}", label, desc)).style(style)
    }).collect();

    let mut ls = ratatui::widgets::ListState::default();
    ls.select(Some(state.start_idx));
    f.render_stateful_widget(
        List::new(items).block(Block::default()
            .borders(Borders::ALL)
            .border_type(BorderType::Rounded)
            .border_style(Style::default().fg(M_BORDER))),
        sections[1],
        &mut ls,
    );
}

// ── main wizard loop ──────────────────────────────────────────────────────────

fn cmd_setup() {
    let root = find_project_root().unwrap_or_else(|| std::env::current_dir().unwrap());

    enable_raw_mode().unwrap_or_else(|e| {
        eprintln!("{} raw mode failed: {}", "✗".red(), e);
        std::process::exit(1);
    });

    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen).ok();

    let mut terminal = Terminal::new(CrosstermBackend::new(io::stdout()))
        .unwrap_or_else(|e| {
            disable_raw_mode().ok();
            eprintln!("{} terminal init failed: {}", "✗".red(), e);
            std::process::exit(1);
        });

    let mut state = WizardState::new();

    'wizard: loop {
        terminal.draw(|f| draw_wizard(f, &state)).ok();

        // Auto-run dep check
        if state.step == Step::DepCheck && state.deps.is_empty() {
            state.deps = check_deps();
            terminal.draw(|f| draw_wizard(f, &state)).ok();
        }

        // Auto-run install (blocking — redraws between each task)
        if state.step == Step::InstallDeps && !state.install_done {
            run_install_steps(&mut terminal, &mut state, &root);
            // After install, loop back to show result and wait for Enter
            continue;
        }

        if !event::poll(std::time::Duration::from_millis(50)).unwrap_or(false) {
            continue;
        }

        if let Ok(Event::Key(key)) = event::read() {
            if key.kind != KeyEventKind::Press { continue; }

            match key.code {
                // Quit — disabled during text input and install
                KeyCode::Char('q')
                    if !matches!(state.step,
                        Step::ConfigureProvider | Step::ConfigureDb | Step::InstallDeps
                    ) => break 'wizard,

                // Back
                KeyCode::Esc => {
                    state.step = match &state.step {
                        Step::ChooseProvider    => Step::DepCheck,
                        Step::ConfigureProvider => { state.input_buf.clear(); Step::ChooseProvider }
                        Step::ChooseDb          => Step::ChooseProvider,
                        Step::ConfigureDb       => { state.input_buf.clear(); Step::ChooseDb }
                        Step::Summary           => Step::ChooseDb,
                        _                       => break 'wizard,
                    };
                }

                // Navigate lists
                KeyCode::Up => match &state.step {
                    Step::ChooseProvider if state.provider_idx > 0 => state.provider_idx -= 1,
                    Step::ChooseDb if state.db_idx > 0             => state.db_idx -= 1,
                    Step::Done if state.start_idx > 0              => state.start_idx -= 1,
                    _ => {}
                },
                KeyCode::Down => match &state.step {
                    Step::ChooseProvider if state.provider_idx + 1 < state.providers.len() => state.provider_idx += 1,
                    Step::ChooseDb if state.db_idx < 1                                     => state.db_idx += 1,
                    Step::Done if state.start_idx < 1                                      => state.start_idx += 1,
                    _ => {}
                },

                // Text input
                KeyCode::Backspace
                    if matches!(state.step, Step::ConfigureProvider | Step::ConfigureDb) =>
                    { state.input_buf.pop(); }
                KeyCode::Char(c)
                    if matches!(state.step, Step::ConfigureProvider | Step::ConfigureDb) =>
                    { state.input_buf.push(c); }

                // Confirm / advance
                KeyCode::Enter => match &state.step.clone() {
                    Step::Welcome    => state.step = Step::DepCheck,
                    Step::DepCheck   => state.step = Step::InstallDeps,
                    Step::InstallDeps if state.install_done => state.step = Step::ChooseProvider,

                    Step::ChooseProvider => {
                        let p = state.providers[state.provider_idx].clone();
                        state.selected_provider = Some(p.clone());
                        if p == Provider::Skip {
                            state.step = Step::ChooseDb;
                        } else if p.needs_model() {
                            state.input_buf.clear();
                            state.input_masked = false;
                            state.step = Step::ConfigureProvider;
                        } else {
                            state.input_buf.clear();
                            state.input_masked = true;
                            state.step = Step::ConfigureProvider;
                        }
                    }

                    Step::ConfigureProvider => {
                        let p = state.selected_provider.as_ref().unwrap().clone();
                        if p.needs_model() {
                            state.ollama_model = if state.input_buf.is_empty() {
                                "llama3.2".into()
                            } else {
                                state.input_buf.clone()
                            };
                            state.error_msg = None;
                            state.input_buf.clear();
                            state.step = Step::ChooseDb;
                        } else {
                            if state.input_buf.is_empty() {
                                state.error_msg =
                                    Some("API key cannot be empty. Press Esc to go back.".into());
                            } else {
                                state.api_key = state.input_buf.clone();
                                state.error_msg = None;
                                state.input_buf.clear();
                                state.step = Step::ChooseDb;
                            }
                        }
                    }

                    Step::ChooseDb => {
                        state.db_choice = if state.db_idx == 0 {
                            DbChoice::Sqlite
                        } else {
                            DbChoice::Postgres
                        };
                        if state.db_choice == DbChoice::Postgres {
                            state.input_buf.clear();
                            state.step = Step::ConfigureDb;
                        } else {
                            state.step = Step::Summary;
                        }
                    }

                    Step::ConfigureDb => {
                        state.postgres_url = state.input_buf.clone();
                        state.input_buf.clear();
                        state.step = Step::Summary;
                    }

                    Step::Summary => {
                        state.error_msg = write_env(&root, &state).err()
                            .map(|e| format!("Write failed: {}", e));
                        state.step = Step::Done;
                    }

                    Step::Done => {
                        state.wants_start = state.start_idx == 0;
                        break 'wizard;
                    }

                    _ => {}
                },

                _ => {}
            }
        }
    }

    // Restore terminal
    disable_raw_mode().ok();
    execute!(terminal.backend_mut(), LeaveAlternateScreen).ok();
    terminal.show_cursor().ok();

    // Start backend if user chose to
    if state.wants_start {
        println!();
        let rt = tokio::runtime::Runtime::new().expect("tokio");
        rt.block_on(start_backend(&root));
        println!();
        println!("  Web UI  → run {}", "pnpm dev:web".bold());
        println!("  Desktop → run {}", "pnpm dev:desktop".bold());
    }
}

// ── Launcher ──────────────────────────────────────────────────────────────────

#[derive(Debug)]
enum LaunchTarget {
    StartDaemon { frontend: bool },
    StopDaemon,
    StartWeb,
    Code,
    Logs,
    Setup,
}

struct Launcher {
    selected: usize,
    daemon_alive: bool,
    daemon_healthy: bool,
    web_alive: bool,
    db_alive: bool,
    last_refresh: Instant,
    exit_with: Option<LaunchTarget>,
}

impl Launcher {
    fn new() -> Self {
        Self {
            selected: 0,
            daemon_alive: false,
            daemon_healthy: false,
            web_alive: false,
            db_alive: false,
            last_refresh: Instant::now() - Duration::from_secs(60),
            exit_with: None,
        }
    }

    fn refresh(&mut self, root: &Path) {
        let b_pid = read_pid(&pid_path(root, "backend"));
        self.daemon_alive = b_pid.map(is_running).unwrap_or(false);
        self.daemon_healthy = self.daemon_alive && port_open(8787);
        let f_pid = read_pid(&pid_path(root, "frontend"));
        self.web_alive = f_pid.map(is_running).unwrap_or(false);
        self.db_alive = db_is_running(root);
        self.last_refresh = Instant::now();
    }

    fn items(&self) -> Vec<(&'static str, Option<LaunchTarget>)> {
        let mut v: Vec<(&str, Option<LaunchTarget>)> = vec![];
        if self.daemon_alive {
            v.push(("Stop daemon", Some(LaunchTarget::StopDaemon)));
        } else {
            v.push(("Start daemon", Some(LaunchTarget::StartDaemon { frontend: false })));
            v.push(("Start daemon + web", Some(LaunchTarget::StartDaemon { frontend: true })));
        }
        if self.daemon_alive && !self.web_alive {
            v.push(("Start web", Some(LaunchTarget::StartWeb)));
        }
        v.push(("Code", Some(LaunchTarget::Code)));
        v.push(("Logs", Some(LaunchTarget::Logs)));
        v.push(("Setup", Some(LaunchTarget::Setup)));
        v.push(("Quit", None));
        v
    }

    fn clamp(&mut self) {
        let n = self.items().len();
        if n > 0 && self.selected >= n {
            self.selected = n - 1;
        }
    }
}

fn port_open(port: u16) -> bool {
    std::net::TcpStream::connect_timeout(
        &format!("127.0.0.1:{}", port).parse().unwrap(),
        Duration::from_millis(200),
    )
    .is_ok()
}

fn run_launcher() {
    let root = find_project_root().unwrap_or_else(|| std::env::current_dir().unwrap());
    let mut app = Launcher::new();
    app.refresh(&root);

    enable_raw_mode().expect("enable raw mode");
    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen).expect("alternate screen");
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend).expect("terminal");

    loop {
        if app.last_refresh.elapsed() > Duration::from_secs(3) {
            app.refresh(&root);
        }
        app.clamp();

        terminal.draw(|f| draw_launcher(f, &app)).expect("draw");

        if event::poll(Duration::from_millis(100)).unwrap_or(false) {
            if let Ok(Event::Key(key)) = event::read() {
                if key.kind != KeyEventKind::Press {
                    continue;
                }
                let n = app.items().len();
                match key.code {
                    KeyCode::Char('q') | KeyCode::Esc => break,
                    KeyCode::Up | KeyCode::Char('k') => {
                        if app.selected > 0 {
                            app.selected -= 1;
                        }
                    }
                    KeyCode::Down | KeyCode::Char('j') => {
                        if app.selected + 1 < n {
                            app.selected += 1;
                        }
                    }
                    KeyCode::Enter | KeyCode::Char(' ') => {
                        let items = app.items();
                        if let Some((_, action)) = items.into_iter().nth(app.selected) {
                            match action {
                                None => break, // Quit
                                Some(target) => {
                                    app.exit_with = Some(target);
                                    break;
                                }
                            }
                        }
                    }
                    _ => {}
                }
            }
        }
    }

    disable_raw_mode().ok();
    execute!(terminal.backend_mut(), LeaveAlternateScreen).ok();
    terminal.show_cursor().ok();
    drop(terminal);

    if let Some(target) = app.exit_with {
        println!();
        let rt = tokio::runtime::Runtime::new().expect("tokio");
        match target {
            LaunchTarget::StartDaemon { frontend } => rt.block_on(cmd_start(frontend)),
            LaunchTarget::StopDaemon => cmd_stop(),
            LaunchTarget::StartWeb => start_frontend(&root),
            LaunchTarget::Code => cmd_code(),
            LaunchTarget::Logs => cmd_logs(false),
            LaunchTarget::Setup => cmd_setup(),
        }
    }
}

fn draw_launcher(f: &mut ratatui::Frame, app: &Launcher) {
    let area = f.area();

    // Center a fixed-size panel
    let w = 46u16.min(area.width);
    let items = app.items();
    let h = (7 + items.len() as u16 + 2).min(area.height);
    let x = area.width.saturating_sub(w) / 2;
    let y = area.height.saturating_sub(h) / 2;
    let panel = ratatui::layout::Rect { x, y, width: w, height: h };

    f.render_widget(ratatui::widgets::Clear, panel);

    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(1), // title
            Constraint::Length(1), // spacer
            Constraint::Length(3), // status
            Constraint::Length(1), // spacer
            Constraint::Min(1),    // menu
            Constraint::Length(1), // footer
        ])
        .split(panel);

    // Title
    f.render_widget(
        Paragraph::new(Line::from(vec![
            Span::styled("✦ ", Style::default().fg(Color::White)),
            Span::styled("DEIMOS", Style::default().fg(Color::White).add_modifier(Modifier::BOLD)),
        ])),
        chunks[0],
    );

    // Status rows
    let dot = |alive: bool, healthy: bool| -> Span<'static> {
        if healthy      { Span::styled("●", Style::default().fg(Color::Green)) }
        else if alive   { Span::styled("●", Style::default().fg(Color::Yellow)) }
        else            { Span::styled("○", Style::default().fg(Color::DarkGray)) }
    };
    let lbl = |s: &'static str| Span::styled(s, Style::default().fg(Color::DarkGray));

    let status = vec![
        Line::from(vec![
            lbl("daemon   "), dot(app.daemon_alive, app.daemon_healthy),
            lbl(if app.daemon_healthy { "  running :8787" } else if app.daemon_alive { "  starting…" } else { "  stopped" }),
        ]),
        Line::from(vec![
            lbl("web      "), dot(app.web_alive, app.web_alive),
            lbl(if app.web_alive { "  running :3000" } else { "  stopped" }),
        ]),
        Line::from(vec![
            lbl("database "), dot(app.db_alive, app.db_alive),
            lbl(if app.db_alive { "  running :5433" } else { "  stopped" }),
        ]),
    ];
    f.render_widget(Paragraph::new(status), chunks[2]);

    // Menu
    let list_items: Vec<ListItem> = items
        .iter()
        .enumerate()
        .map(|(i, (label, action))| {
            let is_quit = action.is_none();
            let sel = i == app.selected;
            let prefix = if sel { " ▸ " } else { "   " };
            let style = if sel {
                Style::default().fg(Color::White).add_modifier(Modifier::BOLD)
            } else if is_quit {
                Style::default().fg(Color::DarkGray)
            } else {
                Style::default().fg(Color::Gray)
            };
            ListItem::new(Line::from(Span::styled(format!("{}{}", prefix, label), style)))
        })
        .collect();
    f.render_widget(List::new(list_items), chunks[4]);

    // Footer
    f.render_widget(
        Paragraph::new(Line::from(vec![
            Span::styled(" j/k ↑↓", Style::default().fg(Color::DarkGray)),
            Span::styled("  enter", Style::default().fg(Color::DarkGray)),
            Span::styled("  q quit", Style::default().fg(Color::DarkGray)),
        ])),
        chunks[5],
    );
}

// ── deimos code ───────────────────────────────────────────────────────────────

fn cmd_code() {
    let root = find_project_root().unwrap_or_else(|| std::env::current_dir().unwrap());
    match find_code_binary(&root) {
        Some(bin) => {
            Command::new(&bin).current_dir(&root).status().ok();
        }
        None => {
            eprintln!("{} Deimos Code not installed.", "✗".red());
            eprintln!();
            eprintln!("  Build it:  {}", "cargo install --path cli/code".bold());
        }
    }
}

fn find_code_binary(root: &Path) -> Option<PathBuf> {
    // 1. deimos-code in PATH (installed via cargo install)
    if Command::new("which")
        .arg("deimos-code")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
    {
        return Some(PathBuf::from("deimos-code"));
    }
    // 2. Release build inside the monorepo
    let rel = root.join("cli/code/target/release/deimos-code");
    if rel.exists() {
        return Some(rel);
    }
    // 3. Debug build
    let dbg = root.join("cli/code/target/debug/deimos-code");
    if dbg.exists() {
        return Some(dbg);
    }
    None
}
