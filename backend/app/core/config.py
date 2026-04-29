from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    openrouter_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    groq_api_key: str = ""
    groq_base_url: str = "https://api.groq.com/openai/v1"
    database_url: str = "postgresql://user:pass@localhost:5432/agentfaceoff"
    app_env: str = "development"
    allowed_origins: str = "http://localhost:3000"
    max_concurrent_battles: int = 5
    per_ip_daily_limit: int = 20
    sentry_dsn: str = ""
    tavily_api_key: str = ""
    jwt_secret: str = "dev-secret-change-in-production"
    jwt_algorithm: str = "HS256"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
