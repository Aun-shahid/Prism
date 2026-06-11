from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import get_database, client
from .routers import auth, users, api_keys, profile, applications, resume, scraper, gmail, jobs
from .services.logging_service import get_logger

logger = get_logger("main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing Prism API backend startup...")
    try:
        db = get_database()
        # Verify MongoDB is reachable
        await db.command("ping")
        logger.info("Database connection successfully verified via ping!")
    except Exception as e:
        logger.error(f"Database connection verification failed: {e}")
        raise e
    yield
    logger.info("Shutting down Prism API backend...")
    if client:
        client.close()
        logger.info("Database connection gracefully closed.")

app = FastAPI(
    title="Prism API",
    description="FastAPI Backend for Prism with MongoDB and Authentication",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Middleware setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this to specific frontend URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(api_keys.router)
app.include_router(profile.router)
app.include_router(applications.router)
app.include_router(resume.router)
app.include_router(scraper.router)
app.include_router(gmail.router)
app.include_router(jobs.router)

@app.get("/")
async def root():
    return {"message": "Welcome to the Prism API backend!"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
