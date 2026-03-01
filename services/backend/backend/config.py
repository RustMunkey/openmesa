from dotenv import load_dotenv
import os

load_dotenv()


class Settings:
    port: int = int(os.getenv("PORT", "8787"))
    anthropic_api_key: str = os.getenv("ANTHROPIC_API_KEY", "")
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
    ollama_base_url: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    openclaw_base_url: str = os.getenv("OPENCLAW_BASE_URL", "http://localhost:18789")
    database_url: str = os.getenv("DATABASE_URL", "postgresql://deimos:deimos@localhost:5432/deimos")
    # Embedding provider for vector memory (ollama | openai)
    embed_provider: str = os.getenv("EMBED_PROVIDER", "ollama")
    embed_model: str = os.getenv("EMBED_MODEL", "nomic-embed-text")


settings = Settings()
