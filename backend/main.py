from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core.config import get_settings
from api.routes import router

settings = get_settings()
app = FastAPI(title="Research Brief Agent API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.frontend_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"service": "Research Brief Agent API", "docs": "/docs"}

app.include_router(router, prefix="/api")