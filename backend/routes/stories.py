from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel
from database.client import get_supabase_client
from database.models import UserStoryCreate
from backend.services.ai_tester import run_test_for_story
from backend.services.jira_integration import get_jira_client
import uuid
import os

router = APIRouter()

async def process_story(story_id: str, story: str):
    # Run the playwright test
    result = await run_test_for_story(story)
    
    # Update Supabase
    supabase = get_supabase_client()
    try:
        if supabase:
            supabase.table("user_stories").update({
                "status": "completed",
                "test_results": result
            }).eq("id", story_id).execute()
        else:
            print(f"Mock update for {story_id}: {result}")
    except Exception as e:
        print(f"Error updating supabase: {e}")

@router.post("/")
async def create_and_test_story(story_data: UserStoryCreate, background_tasks: BackgroundTasks):
    supabase = get_supabase_client()
    story_id = str(uuid.uuid4())
    
    # Store in Supabase initially as pending
    try:
        if supabase:
            supabase.table("user_stories").insert({
                "id": story_id,
                "story": story_data.story,
                "status": "pending"
            }).execute()
    except Exception as e:
        print("Supabase insert failed. Make sure SUPABASE_URL and SUPABASE_KEY are set.", e)
    
    # Run test in background
    background_tasks.add_task(process_story, story_id, story_data.story)
    
    return {"message": "Story received and testing started", "id": story_id}

@router.get("/")
async def get_stories():
    supabase = get_supabase_client()
    try:
        if supabase:
            response = supabase.table("user_stories").select("*").order("created_at", desc=True).execute()
            return response.data
    except Exception as e:
        print("Supabase select failed", e)
        
    return []


class JiraImportRequest(BaseModel):
    issue_key: str
    jira_url: str = ""
    username: str = ""
    api_token: str = ""


@router.post("/import-from-jira")
async def import_from_jira(request: JiraImportRequest, background_tasks: BackgroundTasks):
    """
    Import a user story directly from Jira
    
    Supports:
    - issue_key: Jira issue key (e.g., PROJ-123)
    - jira_url: Base Jira URL (can be from env JIRA_URL)
    - username: Jira username (can be from env JIRA_USERNAME)
    - api_token: Jira API token (can be from env JIRA_API_TOKEN)
    """
    
    # Use environment variables if credentials not provided
    jira_url = request.jira_url or os.getenv("JIRA_URL", "")
    username = request.username or os.getenv("JIRA_USERNAME", "")
    api_token = request.api_token or os.getenv("JIRA_API_TOKEN", "")
    
    # Validate credentials
    if not all([jira_url, username, api_token]):
        raise HTTPException(
            status_code=400,
            detail="Missing Jira credentials. Provide jira_url, username, and api_token, or set JIRA_URL, JIRA_USERNAME, JIRA_API_TOKEN environment variables."
        )
    
    # Get Jira client
    jira_client = get_jira_client(jira_url, username, api_token)
    if not jira_client:
        raise HTTPException(
            status_code=401,
            detail="Invalid Jira credentials. Unable to authenticate with Jira."
        )
    
    # Fetch story from Jira
    story_text = jira_client.get_user_story_text(request.issue_key)
    if not story_text:
        raise HTTPException(
            status_code=404,
            detail=f"Jira issue {request.issue_key} not found or unable to retrieve."
        )
    
    # Create story entry in database
    story_id = str(uuid.uuid4())
    supabase = get_supabase_client()
    
    try:
        if supabase:
            supabase.table("user_stories").insert({
                "id": story_id,
                "story": story_text,
                "status": "pending"
            }).execute()
    except Exception as e:
        print(f"Supabase insert failed: {e}")
    
    # Start testing in background
    background_tasks.add_task(process_story, story_id, story_text)
    
    return {
        "message": f"Story imported from Jira issue {request.issue_key}",
        "id": story_id,
        "story": story_text,
        "jira_issue": request.issue_key
    }
