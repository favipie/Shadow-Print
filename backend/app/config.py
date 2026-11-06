from pathlib import Path
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="SHADOWPRINT_", env_file=Path(__file__).parents[1] / ".env", extra="ignore"
    )
    server: str = r"favipie\SQLEXPRESS"
    database: str = "shadowprint_db"
    driver: str = "ODBC Driver 18 for SQL Server"
    trust_certificate: bool = True
    reviewer: str = "DEMO-ANALYST"
    origins: list[str] = ["http://127.0.0.1:3000", "http://localhost:3000"]
    snapshot_limit: int = Field(default=10000, ge=100, le=100000)


settings = Settings()
