from cryptography.fernet import Fernet, InvalidToken
from ..config import settings
from .logging_service import get_logger

logger = get_logger("encryption_service")

_fernet: Fernet | None = None


def _get_fernet() -> Fernet:
    """Lazily initialise the Fernet cipher from the config encryption key."""
    global _fernet
    if _fernet is None:
        key = settings.ENCRYPTION_KEY
        if not key:
            raise RuntimeError(
                "ENCRYPTION_KEY is not configured. "
                "It should have been auto-generated on startup."
            )
        _fernet = Fernet(key.encode("utf-8") if isinstance(key, str) else key)
    return _fernet


def encrypt_value(plaintext: str) -> str:
    """Encrypt a plaintext string and return the base64-encoded ciphertext."""
    f = _get_fernet()
    return f.encrypt(plaintext.encode("utf-8")).decode("utf-8")


def decrypt_value(ciphertext: str) -> str:
    """Decrypt a base64-encoded ciphertext and return the original plaintext."""
    f = _get_fernet()
    try:
        return f.decrypt(ciphertext.encode("utf-8")).decode("utf-8")
    except InvalidToken:
        logger.error("Failed to decrypt value — invalid token or corrupted data")
        raise ValueError("Decryption failed: invalid or corrupted data")
