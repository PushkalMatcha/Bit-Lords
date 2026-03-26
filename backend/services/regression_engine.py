from typing import Dict, Any

# Module-specific regression strategies
MODULE_STRATEGIES = {
    "Authentication": {
        "high_risk": [
            "Generate brute-force attack scenarios",
            "Add multi-factor authentication flow tests",
            "Test session timeout edge cases",
            "Validate password reset security",
            "Test concurrent login scenarios"
        ],
        "medium_risk": [
            "Add cross-browser login tests",
            "Test remember-me functionality",
            "Validate error message handling"
        ],
        "low_risk": [
            "Verify login form accessibility",
            "Test UI responsiveness"
        ]
    },
    "Checkout": {
        "high_risk": [
            "Test payment gateway integration",
            "Validate order state transitions",
            "Check for race conditions",
            "Test insufficient inventory scenarios"
        ],
        "medium_risk": [
            "Verify discount code application",
            "Test shipping calculation",
            "Validate tax computation"
        ],
        "low_risk": [
            "Check UI consistency",
            "Verify data formatting"
        ]
    },
    "User Profile": {
        "high_risk": [
            "Test data privacy controls",
            "Validate account deletion flow",
            "Check permission boundaries"
        ],
        "medium_risk": [
            "Test profile update validations",
            "Verify notification preferences"
        ],
        "low_risk": [
            "Check UI layout",
            "Verify form field labels"
        ]
    },
    "Core System": {
        "high_risk": [
            "Test database transaction integrity",
            "Validate error recovery mechanisms",
            "Check system failover scenarios"
        ],
        "medium_risk": [
            "Test performance under load",
            "Verify logging consistency"
        ],
        "low_risk": [
            "Check API response formats",
            "Verify documentation accuracy"
        ]
    }
}


def _format_priority(risk_level: str) -> str:
    if risk_level == "high_risk":
        return "P1"
    if risk_level == "medium_risk":
        return "P2"
    return "P3"


def generate_regression_test_cases(module: str, risk_level: str, actions: list) -> list:
    """
    Build concrete regression test cases from selected actions.
    Returns a compact structured suite suitable for storage and UI rendering.
    """
    if not actions:
        return []

    priority = _format_priority(risk_level)
    test_cases = []

    # Keep suite concise for MVP runs.
    for idx, action in enumerate(actions[:3], start=1):
        test_cases.append({
            "id": f"RG-{module[:3].upper()}-{idx}",
            "title": f"{module} Regression: {action}",
            "module": module,
            "priority": priority,
            "source_action": action,
            "steps": [
                f"Open {module} workflow",
                f"Execute scenario for: {action}",
                "Capture observed output and status",
                "Compare observed behavior with expected outcome"
            ],
            "expected_result": "Scenario completes without functional regressions or security violations"
        })

    return test_cases

def trigger_regression(module: str, failed: int) -> Dict[str, Any]:
    """
    Determines if regression testing logic should be triggered based on failure counts.
    Returns module-specific automated QA countermeasures with risk-based prioritization.
    """
    if failed == 0:
        return {
            "regression_triggered": False,
            "actions": []
        }
    
    # Determine risk level based on failure count
    if failed >= 3:
        risk_level = "high_risk"
    elif failed >= 1:
        risk_level = "medium_risk"
    else:
        risk_level = "low_risk"
    
    # Get module-specific actions, fallback to generic if module not found
    strategies = MODULE_STRATEGIES.get(module, MODULE_STRATEGIES["Core System"])
    actions = strategies.get(risk_level, strategies["low_risk"])
    regression_test_cases = generate_regression_test_cases(module, risk_level, actions)
    
    return {
        "regression_triggered": True,
        "risk_level": risk_level.replace("_", " ").title(),
        "module": module,
        "failure_count": failed,
        "actions": actions,
        "regression_test_cases": regression_test_cases
    }
