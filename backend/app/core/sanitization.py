import re
from typing import List, Optional

# Patterns commonly used in prompt injection / role jailbreaks
INJECTION_PATTERNS = [
    re.compile(r"(?i)\bignore\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts|directives)\b"),
    re.compile(r"(?i)\bdisregard\s+(all\s+)?(previous|prior|above)\b"),
    re.compile(r"(?i)\byou\s+are\s+now\s+(an?\s+)?(unrestricted|developer|system|dan|new\s+ai)\b"),
    re.compile(r"(?i)\b(system|assistant|human|admin)\s*:\s*"),
    re.compile(r"(?i)\[/?(system|instruction|prompt)\]"),
    re.compile(r"</?user_data[^>]*>"),
    re.compile(r"```"),
]


def sanitize_user_input(text: Optional[str], max_length: int = 500) -> str:
    """Sanitizes user input to mitigate prompt injection, jailbreaks, and structural escapes.
    Treats user input strictly as inert planning data, neutralizing instruction-hijacking markers.
    """
    if not text:
        return ""

    sanitized = text.strip()

    # Strip null bytes and non-printable control characters
    sanitized = "".join(c for c in sanitized if c.isprintable() or c in ("\n", "\r", "\t"))

    # Neutralize injection / jailbreak patterns by replacing them with [redacted]
    for pattern in INJECTION_PATTERNS:
        sanitized = pattern.sub("[filtered]", sanitized)

    # Truncate to maximum permissible length to prevent memory/token bombing
    if len(sanitized) > max_length:
        sanitized = sanitized[:max_length].rstrip() + "..."

    return sanitized


def sanitize_string_list(items: Optional[List[str]], max_items: int = 15, max_item_len: int = 100) -> List[str]:
    """Sanitizes a list of strings (e.g. interests, must-include spots, avoid items)."""
    if not items:
        return []

    cleaned = []
    for item in items[:max_items]:
        s = sanitize_user_input(item, max_length=max_item_len)
        if s and s != "[filtered]":
            cleaned.append(s)
    return cleaned


def wrap_user_data(label: str, content: str) -> str:
    """Encloses user input within explicit semantic data tags so LLM treats it strictly as data."""
    clean_label = re.sub(r"[^a-zA-Z0-9_-]", "", label)
    return f"<{clean_label}_data>\n{content}\n</{clean_label}_data>"
