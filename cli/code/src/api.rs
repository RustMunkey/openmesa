use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

// ── Message (Anthropic-format for internal history) ───────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub role: String,
    pub content: Value,
}

impl Message {
    pub fn user(text: &str) -> Self {
        Self { role: "user".into(), content: Value::String(text.into()) }
    }
    pub fn user_blocks(blocks: Vec<Value>) -> Self {
        Self { role: "user".into(), content: Value::Array(blocks) }
    }
    pub fn assistant(blocks: Vec<Value>) -> Self {
        Self { role: "assistant".into(), content: Value::Array(blocks) }
    }
}

// ── Stream events ─────────────────────────────────────────────────────────────

#[derive(Debug)]
pub enum StreamEvent {
    Text(String),
    ToolStart { name: String },
    ToolArg(String),
    Finished,
}

#[derive(Debug)]
pub struct ToolCall {
    pub id: String,
    pub name: String,
    pub input: Value,
}

// ── Provider enum ─────────────────────────────────────────────────────────────

pub enum Provider {
    Anthropic(AnthropicClient),
    OpenAI(OpenAICompatClient),
}

impl Provider {
    pub async fn stream<F>(
        &self,
        system: &str,
        messages: &[Message],
        tools: &Value,
        on_event: F,
    ) -> anyhow::Result<(Vec<Value>, Vec<ToolCall>)>
    where
        F: FnMut(StreamEvent),
    {
        match self {
            Provider::Anthropic(c) => c.stream(system, messages, tools, on_event).await,
            Provider::OpenAI(c)    => c.stream(system, messages, tools, on_event).await,
        }
    }

    pub fn label(&self) -> &str {
        match self {
            Provider::Anthropic(_) => "anthropic",
            Provider::OpenAI(c)    => &c.label,
        }
    }

    pub fn model(&self) -> &str {
        match self {
            Provider::Anthropic(c) => &c.model,
            Provider::OpenAI(c)    => &c.model,
        }
    }
}

// ── Anthropic client ──────────────────────────────────────────────────────────

pub struct AnthropicClient {
    api_key: String,
    pub model: String,
    client: reqwest::Client,
}

impl AnthropicClient {
    pub fn new(api_key: String, model: String) -> Self {
        Self { api_key, model, client: reqwest::Client::new() }
    }

    pub async fn stream<F>(
        &self,
        system: &str,
        messages: &[Message],
        tools: &Value,
        mut on_event: F,
    ) -> anyhow::Result<(Vec<Value>, Vec<ToolCall>)>
    where
        F: FnMut(StreamEvent),
    {
        let body = json!({
            "model": self.model,
            "max_tokens": 8096,
            "system": system,
            "messages": messages,
            "tools": tools,
            "stream": true,
        });

        let resp = self.client
            .post("https://api.anthropic.com/v1/messages")
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", "2023-06-01")
            .header("content-type", "application/json")
            .json(&body)
            .send()
            .await?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(anyhow::anyhow!("Anthropic {} — {}", status, text));
        }

        let mut stream = resp.bytes_stream();
        let mut buf = String::new();
        let mut content_blocks: Vec<Value> = vec![];
        let mut tool_calls: Vec<ToolCall> = vec![];
        let mut cur_type = String::new();
        let mut cur_id = String::new();
        let mut cur_name = String::new();
        let mut cur_json = String::new();
        let mut cur_text = String::new();

        'outer: while let Some(chunk) = stream.next().await {
            buf.push_str(&String::from_utf8_lossy(&chunk?));
            loop {
                match buf.find('\n') {
                    None => break,
                    Some(pos) => {
                        let line = buf[..pos].trim_end_matches('\r').to_string();
                        buf = buf[pos + 1..].to_string();
                        let data = match line.strip_prefix("data: ") {
                            Some(d) => d.to_string(),
                            None => continue,
                        };
                        if data == "[DONE]" { break 'outer; }
                        let event: Value = match serde_json::from_str(&data) {
                            Ok(v) => v,
                            Err(_) => continue,
                        };
                        match event["type"].as_str().unwrap_or("") {
                            "content_block_start" => {
                                let b = &event["content_block"];
                                cur_type = b["type"].as_str().unwrap_or("").to_string();
                                cur_id   = b["id"].as_str().unwrap_or("").to_string();
                                cur_name = b["name"].as_str().unwrap_or("").to_string();
                                cur_json.clear(); cur_text.clear();
                                if cur_type == "tool_use" {
                                    on_event(StreamEvent::ToolStart { name: cur_name.clone() });
                                }
                            }
                            "content_block_delta" => {
                                let delta = &event["delta"];
                                match delta["type"].as_str().unwrap_or("") {
                                    "text_delta" => {
                                        if let Some(t) = delta["text"].as_str() {
                                            cur_text.push_str(t);
                                            on_event(StreamEvent::Text(t.to_string()));
                                        }
                                    }
                                    "input_json_delta" => {
                                        if let Some(p) = delta["partial_json"].as_str() {
                                            cur_json.push_str(p);
                                        }
                                    }
                                    _ => {}
                                }
                            }
                            "content_block_stop" => {
                                if cur_type == "tool_use" {
                                    let input: Value = serde_json::from_str(&cur_json)
                                        .unwrap_or(Value::Object(Default::default()));
                                    if let Some(obj) = input.as_object() {
                                        if let Some((_, v)) = obj.iter().next() {
                                            if let Some(s) = v.as_str() {
                                                on_event(StreamEvent::ToolArg(s.to_string()));
                                            }
                                        }
                                    }
                                    content_blocks.push(json!({
                                        "type": "tool_use", "id": cur_id,
                                        "name": cur_name, "input": input.clone(),
                                    }));
                                    tool_calls.push(ToolCall {
                                        id: cur_id.clone(), name: cur_name.clone(), input,
                                    });
                                } else if cur_type == "text" && !cur_text.is_empty() {
                                    content_blocks.push(json!({ "type": "text", "text": cur_text }));
                                }
                            }
                            "message_stop" => { on_event(StreamEvent::Finished); break 'outer; }
                            _ => {}
                        }
                    }
                }
            }
        }

        Ok((content_blocks, tool_calls))
    }
}

// ── OpenAI-compatible client (OpenAI + Ollama + any OpenAI-compat API) ────────

pub struct OpenAICompatClient {
    api_key: Option<String>,
    pub model: String,
    pub label: String,
    base_url: String,
    client: reqwest::Client,
}

impl OpenAICompatClient {
    pub fn new(api_key: Option<String>, model: String, label: String, base_url: String) -> Self {
        Self { api_key, model, label, base_url, client: reqwest::Client::new() }
    }

    pub fn openai(api_key: String, model: String) -> Self {
        Self::new(Some(api_key), model, "openai".into(), "https://api.openai.com/v1".into())
    }

    pub fn ollama(model: String) -> Self {
        let base = std::env::var("OLLAMA_HOST")
            .unwrap_or_else(|_| "http://localhost:11434/v1".into());
        Self::new(None, model, "ollama".into(), base)
    }

    pub async fn stream<F>(
        &self,
        system: &str,
        messages: &[Message],
        tools: &Value,
        mut on_event: F,
    ) -> anyhow::Result<(Vec<Value>, Vec<ToolCall>)>
    where
        F: FnMut(StreamEvent),
    {
        let oai_messages = to_openai_messages(system, messages);
        let oai_tools = to_openai_tools(tools);

        let mut body = json!({
            "model": self.model,
            "messages": oai_messages,
            "stream": true,
        });

        if !oai_tools.as_array().map(|a| a.is_empty()).unwrap_or(true) {
            body["tools"] = oai_tools;
            body["tool_choice"] = json!("auto");
        }

        let mut req = self.client
            .post(format!("{}/chat/completions", self.base_url))
            .header("content-type", "application/json")
            .json(&body);

        if let Some(key) = &self.api_key {
            req = req.bearer_auth(key);
        }

        let resp = req.send().await?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(anyhow::anyhow!("{} {} — {}", self.label, status, text));
        }

        let mut stream = resp.bytes_stream();
        let mut buf = String::new();

        // Per-tool-call state (indexed by tool call index)
        let mut tc_id:   std::collections::HashMap<usize, String> = Default::default();
        let mut tc_name: std::collections::HashMap<usize, String> = Default::default();
        let mut tc_args: std::collections::HashMap<usize, String> = Default::default();

        let mut text_buf = String::new();
        let mut content_blocks: Vec<Value> = vec![];
        let mut tool_calls: Vec<ToolCall> = vec![];

        'outer: while let Some(chunk) = stream.next().await {
            buf.push_str(&String::from_utf8_lossy(&chunk?));
            loop {
                match buf.find('\n') {
                    None => break,
                    Some(pos) => {
                        let line = buf[..pos].trim_end_matches('\r').to_string();
                        buf = buf[pos + 1..].to_string();

                        let data = match line.strip_prefix("data: ") {
                            Some(d) => d.trim().to_string(),
                            None => continue,
                        };
                        if data == "[DONE]" { break 'outer; }
                        if data.is_empty() { continue; }

                        let event: Value = match serde_json::from_str(&data) {
                            Ok(v) => v,
                            Err(_) => continue,
                        };

                        let delta = &event["choices"][0]["delta"];
                        if delta.is_null() { continue; }

                        // Text content
                        if let Some(t) = delta["content"].as_str() {
                            if !t.is_empty() {
                                text_buf.push_str(t);
                                on_event(StreamEvent::Text(t.to_string()));
                            }
                        }

                        // Tool calls
                        if let Some(tcs) = delta["tool_calls"].as_array() {
                            for tc in tcs {
                                let idx = tc["index"].as_u64().unwrap_or(0) as usize;
                                if let Some(id) = tc["id"].as_str() {
                                    tc_id.insert(idx, id.to_string());
                                }
                                if let Some(name) = tc["function"]["name"].as_str() {
                                    tc_name.insert(idx, name.to_string());
                                    on_event(StreamEvent::ToolStart { name: name.to_string() });
                                }
                                if let Some(args) = tc["function"]["arguments"].as_str() {
                                    tc_args.entry(idx).or_default().push_str(args);
                                }
                            }
                        }

                        // Finish reason
                        let finish = event["choices"][0]["finish_reason"].as_str().unwrap_or("");
                        if finish == "stop" || finish == "tool_calls" {
                            on_event(StreamEvent::Finished);
                        }
                    }
                }
            }
        }

        // Flush text block
        if !text_buf.is_empty() {
            content_blocks.push(json!({ "type": "text", "text": text_buf }));
        }

        // Flush tool calls — convert back to Anthropic format for history
        let mut indices: Vec<usize> = tc_id.keys().cloned().collect();
        indices.sort();
        for idx in indices {
            let id   = tc_id.get(&idx).cloned().unwrap_or_default();
            let name = tc_name.get(&idx).cloned().unwrap_or_default();
            let args = tc_args.get(&idx).cloned().unwrap_or_default();
            let input: Value = serde_json::from_str(&args)
                .unwrap_or(Value::Object(Default::default()));

            if let Some(obj) = input.as_object() {
                if let Some((_, v)) = obj.iter().next() {
                    if let Some(s) = v.as_str() {
                        on_event(StreamEvent::ToolArg(s.to_string()));
                    }
                }
            }

            content_blocks.push(json!({
                "type": "tool_use", "id": id, "name": name, "input": input.clone(),
            }));
            tool_calls.push(ToolCall { id, name, input });
        }

        Ok((content_blocks, tool_calls))
    }
}

// ── Format conversion helpers ─────────────────────────────────────────────────

/// Convert Anthropic tool definitions → OpenAI tool definitions
fn to_openai_tools(tools: &Value) -> Value {
    let arr = match tools.as_array() {
        Some(a) => a,
        None => return json!([]),
    };
    let converted: Vec<Value> = arr.iter().map(|t| {
        json!({
            "type": "function",
            "function": {
                "name": t["name"],
                "description": t["description"],
                "parameters": t["input_schema"],
            }
        })
    }).collect();
    Value::Array(converted)
}

/// Convert internal Anthropic-format message history → OpenAI messages array
fn to_openai_messages(system: &str, messages: &[Message]) -> Value {
    let mut out: Vec<Value> = vec![
        json!({ "role": "system", "content": system }),
    ];

    for msg in messages {
        match msg.content {
            // Simple string message
            Value::String(ref text) => {
                out.push(json!({ "role": msg.role, "content": text }));
            }

            // Array of content blocks
            Value::Array(ref blocks) => {
                if msg.role == "assistant" {
                    // Split into text + tool_calls
                    let mut text_parts: Vec<&str> = vec![];
                    let mut tool_calls: Vec<Value> = vec![];

                    for b in blocks {
                        match b["type"].as_str().unwrap_or("") {
                            "text" => {
                                if let Some(t) = b["text"].as_str() {
                                    text_parts.push(t);
                                }
                            }
                            "tool_use" => {
                                tool_calls.push(json!({
                                    "id": b["id"],
                                    "type": "function",
                                    "function": {
                                        "name": b["name"],
                                        "arguments": serde_json::to_string(&b["input"])
                                            .unwrap_or_else(|_| "{}".into()),
                                    }
                                }));
                            }
                            _ => {}
                        }
                    }

                    let content = if text_parts.is_empty() {
                        Value::Null
                    } else {
                        Value::String(text_parts.join(""))
                    };

                    let mut m = json!({ "role": "assistant", "content": content });
                    if !tool_calls.is_empty() {
                        m["tool_calls"] = Value::Array(tool_calls);
                    }
                    out.push(m);

                } else if msg.role == "user" {
                    // Tool results: { type: "tool_result", tool_use_id, content }
                    // → separate "tool" role messages in OpenAI format
                    let mut has_tool_results = false;
                    for b in blocks {
                        if b["type"].as_str() == Some("tool_result") {
                            has_tool_results = true;
                            let content = match &b["content"] {
                                Value::String(s) => s.clone(),
                                other => serde_json::to_string(other).unwrap_or_default(),
                            };
                            out.push(json!({
                                "role": "tool",
                                "tool_call_id": b["tool_use_id"],
                                "content": content,
                            }));
                        }
                    }
                    // If not tool results, treat as regular user message
                    if !has_tool_results {
                        let text: String = blocks.iter()
                            .filter_map(|b| b["text"].as_str())
                            .collect::<Vec<_>>()
                            .join("");
                        out.push(json!({ "role": "user", "content": text }));
                    }
                }
            }

            _ => {}
        }
    }

    Value::Array(out)
}
