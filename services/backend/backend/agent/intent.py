"""
Determines whether a message requires tool use.
Conservative by design — only triggers on patterns that unambiguously
mean "do something on my computer", not natural language that happens
to contain common words.
"""

import re

# File/path reference: /path, ~/path, ./path, ../path
_PATH_RE = re.compile(r"(?:^|[\s\"'`(])([~/\.][/\w\-\.]+)")

# Inline code or commands: `something`
_CODE_RE = re.compile(r"`[^`]+`")

# Explicit computer-action phrases — action verb + computer noun/context
_PATTERNS = [
    r"\blist\s+(my|the|all|your)?\s*(files?|dirs?|directories|folder|folders|repo|cwd|directory)\b",
    r"\bread\s+(the|this|that|a)?\s*file\b",
    r"\b(run|execute|bash)\s+.{0,60}(command|script|this|it)\b",
    r"\brun\s+`",
    r"\b(write|create|make)\s+(a|the|this)?\s*(new\s+)?(file|script|config)\b",
    r"\bwrite\s+.{0,30}\bto\s+(the\s+)?file\b",
    r"\bsearch\s+(for\s+.{1,40}\s+)?(in|through|across)\s+(my|the)\s*(code|files?|repo|project|codebase)\b",
    r"\b(fetch|curl|get|request)\s+https?://",
    r"\bwhat'?s?\s+in\s+[~/\.]",
    r"\bshow\s+(me\s+)?(my|the)?\s*(files?|directory|folder|contents?|output)\b",
    r"\b(delete|remove|rename|move|copy)\s+(the|this|a)?\s*(file|folder|directory)\b",
    r"\bgit\s+(status|diff|log|commit|push|pull|add|clone)\b",
    r"\b(npm|pnpm|pip|python|node|cargo|go)\s+\w",
    r"\bopen\s+(the\s+)?(file|folder|directory)\b",
    r"\bcheck\s+(my\s+)?(git|files?|disk|memory|cpu|processes?|logs?)\b",
]

_COMPILED = [re.compile(p, re.IGNORECASE) for p in _PATTERNS]


def needs_tools(messages: list[dict]) -> bool:
    for msg in reversed(messages):
        if msg.get("role") == "user":
            text = msg.get("content", "")
            if _PATH_RE.search(text):
                return True
            if _CODE_RE.search(text):
                return True
            return any(p.search(text) for p in _COMPILED)
    return False
