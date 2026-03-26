from typing import Dict, Any

# Simple In-Memory DB
_failure_history: Dict[str, int] = {}

def detect_module(user_story: str) -> str:
    """Helper to classify module context out of the raw user story payload string."""
    s = user_story.lower()
    if "login" in s or "password" in s or "auth" in s:
        return "Authentication"
    if "cart" in s or "checkout" in s or "payment" in s:
        return "Checkout"
    if "profile" in s or "user" in s:
        return "User Profile"
    return "Core System"

def update_risk(module: str, failed: int):
    """
    Increases the historical failure count for a specific module natively in memory.
    """
    if module not in _failure_history:
        _failure_history[module] = 0
        
    _failure_history[module] += failed
    
    # Floor to zero if needed implicitly
    if _failure_history[module] < 0:
        _failure_history[module] = 0

def get_risk_level(module: str) -> Dict[str, Any]:
    """
    Evaluates the historical risk heuristic for a module mapped against its defect counts.
    Returns: HIGH (3+), MEDIUM (1-2), LOW (0)
    """
    failures = _failure_history.get(module, 0)
    
    risk_level = "LOW"
    reasons = ["No recent failures detected"]
    regression_triggered = False
    ai_actions = []
    
    if failures >= 3:
        risk_level = "HIGH"
        regression_triggered = True
        reasons = [
            "Multiple failures detected in previous runs",
            f"Regression risk in {module} functionality",
            "Applying automated countermeasures"
        ]
        ai_actions = [
            f"Regression tests added for {module} module",
            "Increased edge case coverage",
            "Prioritized failed scenarios for re-testing"
        ]
    elif failures > 0:
        risk_level = "MEDIUM"
        regression_triggered = True
        reasons = [
            "Minor failures detected previously",
            "Adding targeted regression checks"
        ]
        ai_actions = [
            f"Regression tests added for {module} module",
            "Increased edge case coverage"
        ]

    result = {
        "module": module,
        "risk_level": risk_level,
        "reasons": reasons
    }
    
    if regression_triggered:
        result["regression_triggered"] = True
        result["ai_actions"] = ai_actions
        
    return result
