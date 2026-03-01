pub struct Renderer;

impl Renderer {
    pub fn new() -> Self { Self }

    pub fn show_tool_result(&self, name: &str, output: &str) {
        // Only show a brief summary for large outputs
        let preview: String = output.lines().take(5).collect::<Vec<_>>().join("\n");
        if output.lines().count() > 5 {
            // already shown inline during tool execution
        }
        let _ = (name, preview); // handled inline in tools.rs
    }
}
