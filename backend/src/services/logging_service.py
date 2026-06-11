import logging
import sys

# Configure standard formatting and output target
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout)
    ],
    force=True  # Overwrites any default basicConfig setup
)

def get_logger(name: str) -> logging.Logger:
    """Retrieve a configured logger instance."""
    return logging.getLogger(name)
