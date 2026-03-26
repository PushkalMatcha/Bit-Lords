from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class UserStoryCreate(BaseModel):
    story: str

class UserStory(BaseModel):
    id: str
    story: str
    status: str
    test_results: Optional[str] = None
    created_at: datetime
