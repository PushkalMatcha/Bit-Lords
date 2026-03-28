"""
Jira Integration Service
Fetches user stories directly from Jira
"""

import requests
import os
from typing import Dict, Optional
import json

class JiraClient:
    def __init__(self, jira_url: str, username: str, api_token: str):
        """
        Initialize Jira client
        
        Args:
            jira_url: Base URL of Jira instance (e.g., https://company.atlassian.net)
            username: Jira username/email
            api_token: Jira API token (from account settings)
        """
        self.jira_url = jira_url.rstrip('/')
        self.username = username
        self.api_token = api_token
        self.auth = (username, api_token)
        
    def validate_credentials(self) -> bool:
        """Test if Jira credentials are valid"""
        try:
            response = requests.get(
                f"{self.jira_url}/rest/api/3/myself",
                auth=self.auth,
                timeout=5
            )
            return response.status_code == 200
        except Exception as e:
            print(f"Jira credential validation failed: {e}")
            return False
    
    def fetch_issue(self, issue_key: str) -> Optional[Dict]:
        """
        Fetch issue details from Jira
        
        Args:
            issue_key: Jira issue key (e.g., PROJ-123)
            
        Returns:
            Issue data or None if failed
        """
        try:
            response = requests.get(
                f"{self.jira_url}/rest/api/3/issue/{issue_key}",
                auth=self.auth,
                timeout=10,
                params={"expand": "changelog"}
            )
            
            if response.status_code != 200:
                print(f"Failed to fetch issue {issue_key}: {response.status_code}")
                return None
                
            data = response.json()
            
            # Extract relevant fields
            fields = data.get('fields', {})

            def nested_name(value):
                if isinstance(value, dict):
                    return value.get("name", "")
                return ""

            def nested_display_name(value):
                if isinstance(value, dict):
                    return value.get("displayName", "")
                return ""

            def adf_to_text(node):
                if not isinstance(node, dict):
                    if isinstance(node, str):
                        return node
                    return ""
                
                node_type = node.get("type")
                
                if node_type == "text":
                    return node.get("text", "")
                elif node_type == "hardBreak":
                    return "\n"
                
                content_text = ""
                if "content" in node:
                    for child in node["content"]:
                        child_text = adf_to_text(child)
                        if child.get("type") == "listItem":
                            content_text += f"- {child_text.lstrip()}"
                        else:
                            content_text += child_text
                            
                    if node_type in ("paragraph", "bulletList", "orderedList"):
                        content_text += "\n"
                
                return content_text

            raw_desc = fields.get('description', '')
            parsed_desc = adf_to_text(raw_desc).strip() if isinstance(raw_desc, dict) else str(raw_desc)

            issue_data = {
                "key": data.get('key'),
                "summary": fields.get('summary', ''),
                "description": parsed_desc,
                "issue_type": nested_name(fields.get('issuetype')),
                "status": nested_name(fields.get('status')),
                "priority": nested_name(fields.get('priority')),
                "assignee": nested_display_name(fields.get('assignee')),
                "created": fields.get('created', ''),
                "updated": fields.get('updated', ''),
                "url": f"{self.jira_url}/browse/{data.get('key')}"
            }
            
            return issue_data
            
        except requests.exceptions.RequestException as e:
            print(f"Error fetching Jira issue: {e}")
            return None
    
    def get_user_story_text(self, issue_key: str) -> Optional[str]:
        """
        Extract user story text from Jira issue
        
        Args:
            issue_key: Jira issue key
            
        Returns:
            Formatted user story text
        """
        issue = self.fetch_issue(issue_key)
        if not issue:
            return None
        
        # Format as user story
        story_text = f"""
{issue['summary']}

Description:
{issue['description']}

Type: {issue['issue_type']}
Priority: {issue['priority']}
Status: {issue['status']}
Assignee: {issue['assignee']}

Jira Link: {issue['url']}
"""
        return story_text.strip()


def get_jira_client(jira_url: str, username: str, api_token: str) -> Optional[JiraClient]:
    """
    Create and validate Jira client
    
    Returns:
        JiraClient or None if credentials invalid
    """
    client = JiraClient(jira_url, username, api_token)
    if client.validate_credentials():
        return client
    return None


def parse_jira_url(jira_input: str) -> Optional[tuple]:
    """
    Parse Jira URL or issue key
    
    Supports:
    - Full URL: https://company.atlassian.net/browse/PROJ-123
    - Issue key: PROJ-123
    
    Returns:
        (jira_url, issue_key) or None
    """
    try:
        if jira_input.startswith("http"):
            # Full URL format
            if "/browse/" in jira_input:
                parts = jira_input.split("/browse/")
                jira_url = parts[0]
                issue_key = parts[1]
                return (jira_url, issue_key)
        else:
            # Assume it's just the issue key
            # User needs to have configured Jira URL separately
            return (None, jira_input)
    except Exception as e:
        print(f"Error parsing Jira URL: {e}")
    
    return None
