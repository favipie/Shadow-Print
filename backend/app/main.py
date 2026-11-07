"""Canonical entrypoint; compatibility routes are mounted by the factory."""
from .api import create_app

app = create_app()
