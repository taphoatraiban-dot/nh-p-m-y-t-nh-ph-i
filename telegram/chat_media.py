"""Photo attachment helpers for CUNCUN Telegram Chat (feature branch).

This module deliberately does not use public Storage URLs.
The caller must authenticate before requesting short-lived signed URLs.
"""
import base64
import binascii

ALLOWED_MIME = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
MAX_IMAGE_BYTES = 10 * 1024 * 1024


def decode_image(payload, mime):
    """Validate encoded photo size and actual file signature."""
    if mime not in ALLOWED_MIME or not isinstance(payload, str):
        raise ValueError("Unsupported image type")
    if len(payload) > (MAX_IMAGE_BYTES * 4 // 3 + 16):
        raise ValueError("Image too large")
    try:
        raw = base64.b64decode(payload, validate=True)
    except (ValueError, binascii.Error) as exc:
        raise ValueError("Invalid base64 image") from exc
    if not raw or len(raw) > MAX_IMAGE_BYTES:
        raise ValueError("Image too large or empty")
    signatures = {
        "image/jpeg": raw.startswith(b"\\xff\\xd8\\xff"),
        "image/png": raw.startswith(b"\\x89PNG\\r\\n\\x1a\\n"),
        "image/webp": raw.startswith(b"RIFF") and raw[8:12] == b"WEBP",
    }
    if not signatures[mime]:
        raise ValueError("Image content does not match MIME type")
    return raw
