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

    # openrouter (LLM + embeddings, OpenAI-compatible)
    openrouter_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    llm_model: str = "google/gemini-3.5-flash-lite"
    vision_model: str = "google/gemini-3.7-flash"
    embed_model: str = "openai/text-embedding-3-small"
    embed_dim: int = 1536

    # verifier (Featherless, OpenAI-compatible)
    featherless_api_key: str = ""
    featherless_base_url: str = "https://api.featherless.ai/v1"
    verify_provider: str = "featherless"
    verify_model: str = "Qwen/Qwen3-8B"

    # github
    github_token: str = ""
    repos_storage_path: str = "./repos_storage"


settings = Settings()
