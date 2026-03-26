from backend.services.llm_client import call_llm, safe_parse

def analyze_failure(failed_test: str) -> dict:
    """
    Simulates AI analyzing the root cause of a specific failed test scenario using LLM generation tracking actual logical flow mapping natively yielding expected vs actual string descriptions.
    """
    prompt = f"""Analyze this failed test scenario to deduce its explicit expected state, its failed actual state, the root cause, and a suggestion.

Test: {failed_test}

Return ONLY valid JSON exactly matching this structure:
{{
  "expected": "User should be redirected to login page and session terminated",
  "actual": "User remains on settings page and session persists",
  "root_cause": "",
  "suggestion": ""
}}"""

    # Trigger Groq analysis block securely 
    response_text = call_llm(prompt=prompt, temperature=0.5)

    fallback = {
        "expected": "System resolves logic block and successfully navigates state.",
        "actual": f"Failure captured during execution trace of: '{failed_test}'",
        "root_cause": "System Error",
        "suggestion": "Review code logic"
    }
    
    analysis_json = safe_parse(response_text, fallback)

    return {
        "test_name": failed_test,
        "expected": analysis_json.get("expected", fallback["expected"]),
        "actual": analysis_json.get("actual", fallback["actual"]),
        "root_cause": analysis_json.get("root_cause", fallback["root_cause"]),
        "suggestion": analysis_json.get("suggestion", fallback["suggestion"])
    }
