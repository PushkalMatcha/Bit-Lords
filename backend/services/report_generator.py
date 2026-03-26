"""
Test Report Generation Service
Generates comprehensive test reports in multiple formats
"""

import json
from datetime import datetime
from typing import Dict, Any, Optional
import base64

def generate_test_report(test_results: Dict[str, Any], story: str) -> Dict[str, Any]:
    """
    Generate comprehensive test report
    
    Args:
        test_results: Dictionary containing test execution results
        story: Original user story
        
    Returns:
        Formatted test report
    """
    
    execution = test_results.get('execution', {})
    failure_analysis = test_results.get('failure_analysis', {})
    risk_analysis = test_results.get('risk_analysis', {})
    ai_action = test_results.get('ai_action', {})
    tests = test_results.get('tests', {})
    
    # Calculate metrics
    total_tests = execution.get('total', 0)
    passed_tests = execution.get('passed', 0)
    failed_tests = execution.get('failed', 0)
    success_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0
    
    # Compile test cases
    all_test_cases = [
        *tests.get('positive_tests', []),
        *tests.get('negative_tests', []),
        *tests.get('edge_cases', [])
    ]
    
    report = {
        "report_metadata": {
            "generated_at": datetime.now().isoformat(),
            "report_version": "1.0",
            "report_type": "AI-Generated Test Report"
        },
        "summary": {
            "user_story": story,
            "total_tests_generated": len(all_test_cases),
            "total_tests_executed": total_tests,
            "tests_passed": passed_tests,
            "tests_failed": failed_tests,
            "success_rate": f"{success_rate:.2f}%",
            "execution_mode": execution.get('execution_mode', 'unknown'),
            "execution_time_seconds": execution.get('execution_time', 0),
            "status": "PASSED" if failed_tests == 0 else "FAILED"
        },
        "test_generation": {
            "positive_test_cases": tests.get('positive_tests', []),
            "negative_test_cases": tests.get('negative_tests', []),
            "edge_case_scenarios": tests.get('edge_cases', []),
            "generation_timestamp": datetime.now().isoformat()
        },
        "execution_results": {
            "total": total_tests,
            "passed": passed_tests,
            "failed": failed_tests,
            "demo_mode": execution.get('demo_mode', False),
            "execution_logs": execution.get('logs', [])
        },
        "failure_analysis": {
            "failures_found": failed_tests > 0,
            "details": failure_analysis if failure_analysis else None
        },
        "risk_assessment": {
            "risk_level": risk_analysis.get('level', 'LOW'),
            "analysis": risk_analysis if risk_analysis else None
        },
        "recommendations": {
            "regression_triggered": ai_action.get('regression_triggered', False),
            "suggested_actions": ai_action.get('actions', [])
        },
        "raw_test_results": test_results
    }
    
    return report


def format_report_as_json(report: Dict[str, Any]) -> str:
    """Convert report to formatted JSON string"""
    return json.dumps(report, indent=2)


def format_report_as_html(report: Dict[str, Any]) -> str:
    """Convert report to HTML format"""
    
    summary = report['summary']
    test_gen = report['test_generation']
    execution = report['execution_results']
    risk = report['risk_assessment']
    recommendations = report['recommendations']
    
    # Determine status color
    status_color = "#10b981" if execution['failed'] == 0 else "#ef4444"
    
    html = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>AI Tester Agent - Test Report</title>
        <style>
            body {{
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
                color: #333;
                background: #f5f5f5;
                padding: 20px;
                margin: 0;
            }}
            .container {{
                max-width: 900px;
                margin: 0 auto;
                background: white;
                border-radius: 8px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                padding: 30px;
            }}
            h1 {{
                color: #0f0f0f;
                border-bottom: 3px solid #10b981;
                padding-bottom: 10px;
                margin-bottom: 20px;
            }}
            h2 {{
                color: #0f0f0f;
                margin-top: 25px;
                margin-bottom: 15px;
                font-size: 18px;
            }}
            .metrics {{
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                gap: 15px;
                margin: 20px 0;
            }}
            .metric-card {{
                background: #f8f8f8;
                border-left: 4px solid #10b981;
                padding: 15px;
                border-radius: 4px;
            }}
            .metric-label {{
                font-size: 12px;
                color: #666;
                text-transform: uppercase;
                margin-bottom: 5px;
            }}
            .metric-value {{
                font-size: 24px;
                font-weight: bold;
                color: #0f0f0f;
            }}
            .status {{
                display: inline-block;
                padding: 8px 16px;
                border-radius: 4px;
                font-weight: bold;
                color: white;
                background: {status_color};
            }}
            .test-case {{
                background: #f8f8f8;
                padding: 12px;
                margin: 10px 0;
                border-radius: 4px;
                border-left: 3px solid #3b82f6;
            }}
            .test-case-type {{
                font-size: 11px;
                text-transform: uppercase;
                color: #666;
                margin-bottom: 5px;
            }}
            .failure {{
                background: #fef2f2;
                border-left: 3px solid #ef4444;
                padding: 12px;
                margin: 10px 0;
                border-radius: 4px;
            }}
            .risk-high {{
                color: #ef4444;
                font-weight: bold;
            }}
            .risk-medium {{
                color: #f59e0b;
                font-weight: bold;
            }}
            .risk-low {{
                color: #10b981;
                font-weight: bold;
            }}
            .recommendation {{
                background: #eff6ff;
                border-left: 3px solid #3b82f6;
                padding: 12px;
                margin: 10px 0;
                border-radius: 4px;
            }}
            .timestamp {{
                color: #999;
                font-size: 12px;
            }}
            table {{
                width: 100%;
                border-collapse: collapse;
                margin: 15px 0;
            }}
            th, td {{
                padding: 10px;
                text-align: left;
                border-bottom: 1px solid #ddd;
            }}
            th {{
                background: #f8f8f8;
                font-weight: bold;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🤖 AI Tester Agent - Test Report</h1>
            
            <p class="timestamp">Generated: {report['report_metadata']['generated_at']}</p>
            
            <h2>Executive Summary</h2>
            <p><strong>User Story:</strong> {summary['user_story']}</p>
            <p><strong>Status:</strong> <span class="status">{summary['status']}</span></p>
            
            <div class="metrics">
                <div class="metric-card">
                    <div class="metric-label">Total Tests</div>
                    <div class="metric-value">{execution['total']}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Passed</div>
                    <div class="metric-value" style="color: #10b981;">{execution['passed']}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Failed</div>
                    <div class="metric-value" style="color: #ef4444;">{execution['failed']}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Success Rate</div>
                    <div class="metric-value">{summary['success_rate']}</div>
                </div>
            </div>
            
            <h2>Test Scenarios Generated ({len(test_gen['positive_test_cases'])} Positive + {len(test_gen['negative_test_cases'])} Negative + {len(test_gen['edge_case_scenarios'])} Edge Cases)</h2>
            
            <h3>Positive Test Cases</h3>
            {''.join([f'<div class="test-case"><div class="test-case-type">Positive</div>{tc}</div>' for tc in test_gen['positive_test_cases']])}
            
            <h3>Negative Test Cases</h3>
            {''.join([f'<div class="test-case"><div class="test-case-type">Negative</div>{tc}</div>' for tc in test_gen['negative_test_cases']])}
            
            <h3>Edge Case Scenarios</h3>
            {''.join([f'<div class="test-case"><div class="test-case-type">Edge Case</div>{tc}</div>' for tc in test_gen['edge_case_scenarios']])}
            
            <h2>Execution Details</h2>
            <table>
                <tr>
                    <th>Metric</th>
                    <th>Value</th>
                </tr>
                <tr>
                    <td>Execution Mode</td>
                    <td>{summary['execution_mode'].title()}</td>
                </tr>
                <tr>
                    <td>Execution Time</td>
                    <td>{summary['execution_time_seconds']}s</td>
                </tr>
                <tr>
                    <td>Demo Mode</td>
                    <td>{'Yes' if execution['demo_mode'] else 'No'}</td>
                </tr>
            </table>
            
            <h2>Risk Assessment</h2>
            <p><strong>Risk Level:</strong> <span class="risk-{risk['risk_level'].lower()}">{risk['risk_level']}</span></p>
            
            {f'<h2>Failure Analysis</h2><div class="failure"><strong>Test:</strong> {report["failure_analysis"]["details"]["test_name"]}<br/><strong>Issue:</strong> {report["failure_analysis"]["details"]["root_cause"]}<br/><strong>Suggestion:</strong> {report["failure_analysis"]["details"]["suggestion"]}</div>' if report['failure_analysis']['failures_found'] else '<h2>✅ All Tests Passed</h2><p>No failures detected during execution.</p>'}
            
            <h2>AI Recommendations</h2>
            {''.join([f'<div class="recommendation">→ {action}</div>' for action in recommendations['suggested_actions']])}
            
            <hr style="margin-top: 30px;">
            <p class="timestamp">Report generated by AI Tester Agent v1.0</p>
        </div>
    </body>
    </html>
    """
    
    return html


def format_report_as_csv(report: Dict[str, Any]) -> str:
    """Convert report to CSV format"""
    
    lines = []
    summary = report['summary']
    
    lines.append("AI Tester Agent - Test Report")
    lines.append(f"Generated: {report['report_metadata']['generated_at']}")
    lines.append("")
    
    lines.append("SUMMARY")
    lines.append(f"User Story,{summary['user_story']}")
    lines.append(f"Status,{summary['status']}")
    lines.append(f"Total Tests,{summary['total_tests_executed']}")
    lines.append(f"Passed,{summary['tests_passed']}")
    lines.append(f"Failed,{summary['tests_failed']}")
    lines.append(f"Success Rate,{summary['success_rate']}")
    lines.append("")
    
    lines.append("TEST CASES")
    lines.append("Type,Test Case")
    for tc in report['test_generation']['positive_test_cases']:
        lines.append(f"Positive,{tc}")
    for tc in report['test_generation']['negative_test_cases']:
        lines.append(f"Negative,{tc}")
    for tc in report['test_generation']['edge_case_scenarios']:
        lines.append(f"Edge Case,{tc}")
    
    return "\n".join(lines)
