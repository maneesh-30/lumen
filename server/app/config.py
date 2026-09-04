"""Application settings, loaded from environment / .env file."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    secret_key: str = "change-me"

    # data stores
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_user: str = "lumen"
    postgres_password: str = "lumen"
    postgres_db: str = "lumen"
    qdrant_host: str = "localhost"
    qdrant_port: int = 6333

    # llm + embeddings
    openrouter_api_key: str = ""
    gemini_api_key: str = ""
    featherless_api_key: str = ""
    verify_provider: str = "featherless"

    # github
    github_token: str = ""
    repos_storage_path: str = "./repos_storage"


settings = Settings()
