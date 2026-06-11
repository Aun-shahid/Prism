from pydantic import BaseModel
from typing import Optional

class ExternalSearchRequest(BaseModel):
    title: str
    location: Optional[str] = "Remote"

class JobImportRequest(BaseModel):
    status: Optional[str] = "wishlist"
    notes: Optional[str] = None
