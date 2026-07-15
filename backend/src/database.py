from motor.motor_asyncio import AsyncIOMotorClient
from .config import settings

# Global motor client and database instances
client: AsyncIOMotorClient = None
db = None

def get_database():
    global client, db
    if db is None:
        client = AsyncIOMotorClient(settings.MONGODB_URL)
        db = client[settings.DATABASE_NAME]
    return db

def get_users_collection():
    database = get_database()
    return database["users"]

def get_roles_collection():
    database = get_database()
    return database["roles"]

def get_api_keys_collection():
    database = get_database()
    return database["api_keys"]

def get_profiles_collection():
    database = get_database()
    return database["profiles"]

def get_applications_collection():
    database = get_database()
    return database["applications"]

def get_scraper_targets_collection():
    database = get_database()
    return database["scraper_targets"]

def get_scraped_jobs_collection():
    database = get_database()
    return database["scraped_jobs"]

def get_generated_docs_collection():
    database = get_database()
    return database["generated_docs"]

def get_gmail_connections_collection():
    database = get_database()
    return database["gmail_connections"]

def get_email_logs_collection():
    database = get_database()
    return database["email_logs"]

def get_general_sources_collection():
    database = get_database()
    return database["general_scraper_sources"]

def get_resume_versions_collection():
    database = get_database()
    return database["resume_versions"]

def get_notifications_collection():
    database = get_database()
    return database["notifications"]

def get_blacklisted_jobs_collection():
    """Collection of job URLs excluded due to high applicant count (100+)."""
    database = get_database()
    return database["blacklisted_jobs"]

def get_chat_conversations_collection():
    database = get_database()
    return database["chat_conversations"]

def get_chat_messages_collection():
    database = get_database()
    return database["chat_messages"]

def get_rag_documents_collection():
    """Per-user career knowledge base documents (RAG)."""
    database = get_database()
    return database["rag_documents"]

def get_rag_index_meta_collection():
    """Per-user RAG index metadata (fingerprint, doc count, embedding provider)."""
    database = get_database()
    return database["rag_index_meta"]

