import json
import re

# Pattern, human-readable label
_PATTERNS = [
    (r"sk-ant-api[\w\-]{20,}", "Anthropic API key"),
    (r"sk-[\w\-]{20,}", "OpenAI-style API key"),
    (r"ghp_[\w]{36}", "GitHub personal access token"),
    (r"ghs_[\w]{36}", "GitHub actions secret"),
    (r"xoxb-[\w\-]+", "Slack bot token"),
    (r"\.env(?:\b|$)", ".env file"),
    (r"~?/?\.ssh/", "SSH directory"),
    (r"\bid_rsa\b|\bid_ed25519\b|\bid_ecdsa\b", "SSH private key"),
    (r"\.pem(?:\b|$)", "PEM file"),
    (r"\.p12(?:\b|$)", "PKCS12 file"),
    (r"\bkeychain\b", "system keychain"),
    (r"password\s*=\s*\S{4,}", "password value"),
    (r"secret\s*=\s*[\"'][\w\-]{8,}[\"']", "secret value"),
    (r"token\s*=\s*[\"'][\w\-]{8,}[\"']", "token value"),
]


def detect(args: dict) -> list[str]:
    text = json.dumps(args)
    return [label for pattern, label in _PATTERNS if re.search(pattern, text, re.IGNORECASE)]
