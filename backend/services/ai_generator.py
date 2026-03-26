from typing import Dict, List
from backend.services.llm_client import call_llm, safe_parse

def generate_tests(user_story: str) -> Dict[str, List[str]]:
    """
    Passes the user story to a Groq LLM to intelligently generate true contextual test coverage mapped cleanly to positive, negative, and edge variables.
    """
    prompt = f"""Generate realistic and detailed software test cases for the following user story.

User Story:
{user_story}

Requirements:
- Include real-world scenarios
- Avoid generic names like "basic test"
- Be specific (mention actions, inputs, expected behavior) inside a single condensed sentence per test.
- Structure exactly matching the examples below. Each array MUST contain ONLY plain strings, absolutely NO deeply nested objects.
- Structure exactly matching the examples below

Example Mapping context:
Positive:
- Verify user can log out successfully from settings page
Negative:
- Attempt logout when session is already expired
- Logout request with invalid session token
Edge Cases:
- Logout during network interruption
- Multiple logout clicks rapidly

Return ONLY valid JSON:
{{
  "positive_tests": [],
  "negative_tests": [],
  "edge_cases": []
}}"""

    # Hit Groq LLM
    response_text = call_llm(prompt=prompt, temperature=0.7)

    # Protected fallback mapping layer matching schema natively 
    fallback = {
        "positive_tests": ["Basic valid test"],
        "negative_tests": ["Invalid input test"],
        "edge_cases": ["Empty input test"]
    }
    
    return safe_parse(response_text, fallback)
