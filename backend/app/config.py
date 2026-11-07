from pathlib import Path
from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url
from sqlalchemy.exc import ArgumentError


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="SHADOWPRINT_", env_file=Path(__file__).resolve().parents[1] / ".env", extra="ignore", hide_input_in_errors=True
    )
    database_url: SecretStr | None = None
    api_key: SecretStr | None = None
    investigator_id: str = Field(default="DEMO-ANALYST", min_length=1, max_length=64)
    cors_origins: list[str] = ["http://127.0.0.1:3000", "http://localhost:3000"]

    @field_validator("database_url")
    @classmethod
    def sqlserver_only(cls, value: SecretStr | None) -> SecretStr | None:
        if value:
            try:
                url = make_url(value.get_secret_value())
                valid = url.drivername == "mssql+pyodbc" and bool(url.database)
            except (ArgumentError, ValueError):
                valid = False
            if not valid:
                raise ValueError("Use mssql+pyodbc with an explicit database")
        return value

    @field_validator("api_key")
    @classmethod
    def strong_key(cls, value: SecretStr | None) -> SecretStr | None:
        if value is not None:
            key = value.get_secret_value()
            if len(key.strip()) < 32 or key.startswith("replace-with-"):
                raise ValueError("Configure a generated API key with at least 32 characters")
        return value
