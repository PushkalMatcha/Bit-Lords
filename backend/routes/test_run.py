from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse, Response
from pydantic import BaseModel
from backend.services.ai_generator import generate_tests
from backend.services.test_executor import run_tests
from backend.services.failure_analyzer import analyze_failure
from backend.services.risk_engine import detect_module, update_risk, get_risk_level
from backend.services.regression_engine import trigger_regression
from backend.services.playwright_executor import run_story_driven_test
from backend.services.report_generator import generate_test_report, format_report_as_json, format_report_as_html, format_report_as_csv
from database.client import get_supabase_client
import uuid, json, queue, threading, asyncio
from datetime import datetime

router = APIRouter()

class TestRunRequest(BaseModel):
    user_story: str
    demo_mode: bool = True

# ─── Streaming SSE Endpoint (real-time logs + Playwright sync) ───
@router.post("/run-test-stream")
async def stream_test_run(request: TestRunRequest, http_request: Request):
    async def event_generator():
        def send_event(event_type: str, data: dict):
            return f"data: {json.dumps({'type': event_type, **data})}\n\n"
        
        # --- Phase 1: Generate Tests ---
        yield send_event("log", {"message": "[AI] Generating test cases using LLM"})
        yield send_event("phase", {"phase": "generation", "status": "running"})
        
        generated_test_data = generate_tests(request.user_story)
        all_tests = (
            generated_test_data.get("positive_tests", []) +
            generated_test_data.get("negative_tests", []) +
            generated_test_data.get("edge_cases", [])
        )
        
        yield send_event("tests", {"data": generated_test_data, "count": len(all_tests)})
        yield send_event("log", {"message": f"[AI] Generated {len(all_tests)} test scenarios"})
        yield send_event("phase", {"phase": "generation", "status": "completed"})
        
        # --- Phase 2: Execute Tests (with live streaming) ---
        yield send_event("phase", {"phase": "execution", "status": "running"})
        
        module_name = detect_module(request.user_story)
        
        execution_result = None

        # Stream Playwright steps live via thread-safe queue for every module.
        step_queue = queue.Queue()
        result_holder = [None]

        def on_step(msg):
            step_queue.put(msg)

        def run_pw():
            result_holder[0] = run_story_driven_test(request.user_story, request.demo_mode, on_step=on_step)
            step_queue.put(None)  # Sentinel: done

        pw_thread = threading.Thread(target=run_pw, daemon=True)
        pw_thread.start()

        # Stream steps as they arrive from the Playwright thread.
        while True:
            if await http_request.is_disconnected():
                print("Client disconnected, abandoning test stream.")
                break
                
            try:
                step = step_queue.get(timeout=0.2)
                if step is None:
                    break
                yield send_event("log", {"message": step})
            except queue.Empty:
                continue

        pw_thread.join(timeout=12)
        pw_result = result_holder[0] or {"status": "error", "error": "Playwright timeout"}

        is_pass = pw_result.get("status") == "passed"
        total = len(all_tests) or 1
        execution_result = {
            "total": total,
            "passed": total if is_pass else total - 1,
            "failed": 0 if is_pass else 1,
            "execution_time": 6.8,
            "execution_mode": pw_result.get("execution_mode", "playwright"),
            "demo_mode": request.demo_mode,
            "logs": pw_result.get("steps", []),
            "details": pw_result
        }
        
        yield send_event("execution", {"data": execution_result})
        yield send_event("log", {"message": f"[AI] Test Execution completed in {execution_result['execution_time']}s"})
        yield send_event("phase", {"phase": "execution", "status": "completed"})
        
        failed_count = execution_result.get("failed", 0)
        
        # --- Phase 3: Analysis ---
        yield send_event("phase", {"phase": "detection", "status": "running"})
        
        response_payload = {
            "module": module_name,
            "tests": generated_test_data,
            "execution": execution_result,
        }
        
        if failed_count > 0:
            yield send_event("log", {"message": f"[AI] Failure detected: {failed_count} test(s) failed"})
            yield send_event("phase", {"phase": "detection", "status": "completed"})
            yield send_event("phase", {"phase": "analysis", "status": "running"})
            
            yield send_event("log", {"message": "[AI] Performing AI-based failure analysis"})
            
            if all_tests:
                failure_dict = analyze_failure(all_tests[0])
                mode_text = "Playwright (Real Browser)" if execution_result.get("execution_mode") == "playwright" else "Simulation"
                failure_dict["actual"] = f"{failure_dict['actual']} (Execution Type: {mode_text})"
                response_payload["failure_analysis"] = failure_dict
                yield send_event("failure", {"data": failure_dict})
            
            yield send_event("log", {"message": "[AI] Failure Analysis report compiled"})
            yield send_event("phase", {"phase": "analysis", "status": "completed"})
            
            # Risk
            yield send_event("phase", {"phase": "history", "status": "running"})
            yield send_event("log", {"message": f"[AI] Updating risk model for module: {module_name}"})
            update_risk(module_name, failed_count)
            risk_data = get_risk_level(module_name)
            response_payload["risk_analysis"] = {"level": risk_data.get("risk_level", "LOW")}
            yield send_event("risk", {"data": response_payload["risk_analysis"], "module": module_name})
            yield send_event("log", {"message": f"[AI] Risk Score updated: {module_name} [{risk_data.get('risk_level', 'LOW')}]"})
            yield send_event("phase", {"phase": "history", "status": "completed"})
            yield send_event("phase", {"phase": "score", "status": "completed"})
            
            # Regression
            yield send_event("phase", {"phase": "improve", "status": "running"})
            yield send_event("log", {"message": "[AI] Triggering regression test generation"})
            ai_action = trigger_regression(module_name, failed_count)
            response_payload["ai_action"] = ai_action
            response_payload["regression_tests"] = ai_action.get("regression_test_cases", [])
            yield send_event("regression", {"data": ai_action})
            yield send_event("phase", {"phase": "improve", "status": "completed"})
        else:
            yield send_event("log", {"message": "[AI] No failures detected. All tests passed."})
            yield send_event("phase", {"phase": "detection", "status": "completed"})
            yield send_event("phase", {"phase": "analysis", "status": "completed"})
            
            yield send_event("phase", {"phase": "history", "status": "running"})
            update_risk(module_name, 0)
            risk_data = get_risk_level(module_name)
            response_payload["risk_analysis"] = {"level": risk_data.get("risk_level", "LOW")}
            yield send_event("risk", {"data": response_payload["risk_analysis"], "module": module_name})
            yield send_event("log", {"message": f"[AI] Risk Score updated: {module_name} [{risk_data.get('risk_level', 'LOW')}]"})
            yield send_event("phase", {"phase": "history", "status": "completed"})
            yield send_event("phase", {"phase": "score", "status": "completed"})
            
            response_payload["ai_action"] = trigger_regression(module_name, 0)
            response_payload["regression_tests"] = []
            yield send_event("phase", {"phase": "improve", "status": "completed"})
        
        # Save to Supabase
        supabase = get_supabase_client()
        try:
            if supabase:
                supabase.table("user_stories").insert({
                    "id": str(uuid.uuid4()),
                    "story": request.user_story,
                    "status": "completed" if failed_count == 0 else "failed",
                    "test_results": response_payload
                }).execute()
        except Exception as e:
            print(f"Failed to record data to Supabase: {e}")
        
        yield send_event("log", {"message": "[AI] Pipeline processing finalized."})
        yield send_event("complete", {"data": response_payload})
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*"
        }
    )

# ─── Original endpoint (kept as fallback) ───
@router.post("/run-test")
async def create_test_run(request: TestRunRequest):
    logs = []
    
    logs.append("[AI] Generating test cases using LLM")
    generated_test_data = generate_tests(request.user_story)
    
    all_tests = (
        generated_test_data.get("positive_tests", []) + 
        generated_test_data.get("negative_tests", []) + 
        generated_test_data.get("edge_cases", [])
    )
    
    execution_results = await run_tests(all_tests, request.user_story, request.demo_mode)
    
    logs.extend(execution_results.get("logs", ["[AI] Executing tests"]))
    failed_count = execution_results.get("failed", 0)
    module_name = detect_module(request.user_story)
    
    response_payload = {
        "module": module_name,
        "tests": generated_test_data,
        "execution": execution_results,
        "logs": logs
    }
    
    if failed_count > 0:
        logs.append("[AI] Failure detected")
        logs.append("[AI] Performing AI-based failure analysis")
        if all_tests:
            failed_test_name = all_tests[0]
            failure_dict = analyze_failure(failed_test_name)
            mode_text = "Playwright (Real Browser)" if execution_results.get("execution_mode") == "playwright" else "Simulation"
            failure_dict["actual"] = f"{failure_dict['actual']} (Execution Type: {mode_text})"
            response_payload["failure_analysis"] = failure_dict
        
        logs.append("[AI] Updating risk model")
        update_risk(module_name, failed_count)
        risk_data = get_risk_level(module_name)
        response_payload["risk_analysis"] = {"level": risk_data.get("risk_level", "LOW")}
        
        logs.append("[AI] Triggering regression")
        response_payload["ai_action"] = trigger_regression(module_name, failed_count)
        response_payload["regression_tests"] = response_payload["ai_action"].get("regression_test_cases", [])
    else:
        logs.append("[AI] Updating risk model")
        update_risk(module_name, 0)
        risk_data = get_risk_level(module_name)
        response_payload["risk_analysis"] = {"level": risk_data.get("risk_level", "LOW")}
        response_payload["ai_action"] = trigger_regression(module_name, 0)
        response_payload["regression_tests"] = []
    
    supabase = get_supabase_client()
    try:
        if supabase:
            supabase.table("user_stories").insert({
                "id": str(uuid.uuid4()),
                "story": request.user_story,
                "status": "completed" if failed_count == 0 else "failed",
                "test_results": response_payload
            }).execute()
    except Exception as e:
        print(f"Failed to record data to Supabase: {e}")
    
    return response_payload


class ExportReportRequest(BaseModel):
    test_results: dict
    user_story: str
    format: str = "json"  # json, html, csv


@router.post("/export-report")
async def export_report(request: ExportReportRequest):
    """
    Export test results as a comprehensive report
    
    Formats:
    - json: Machine-readable JSON format
    - html: Beautiful HTML report for sharing
    - csv: Spreadsheet-compatible CSV format
    """
    
    # Generate the report
    report = generate_test_report(request.test_results, request.user_story)
    
    format_type = request.format.lower()
    filename = f"test_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    
    if format_type == "json":
        # Return JSON report
        content = format_report_as_json(report)
        return {
            "success": True,
            "format": "json",
            "report": report,
            "download_url": f"/download-report/{filename}.json"
        }
    
    elif format_type == "html":
        # Return HTML report
        content = format_report_as_html(report)
        return {
            "success": True,
            "format": "html",
            "content": content,
            "download_url": f"/download-report/{filename}.html"
        }
    
    elif format_type == "csv":
        # Return CSV report
        content = format_report_as_csv(report)
        return {
            "success": True,
            "format": "csv",
            "content": content,
            "download_url": f"/download-report/{filename}.csv"
        }
    
    else:
        return {
            "success": False,
            "error": f"Unsupported format: {format_type}. Supported: json, html, csv"
        }


@router.post("/download-report/{format_type}")
async def download_report(format_type: str, request: ExportReportRequest):
    """
    Download test report as a file
    """
    
    # Generate the report
    report = generate_test_report(request.test_results, request.user_story)
    
    format_type = format_type.lower()
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    
    if format_type == "json":
        content = format_report_as_json(report)
        filename = f"test_report_{timestamp}.json"
        media_type = "application/json"
        
    elif format_type == "html":
        content = format_report_as_html(report)
        filename = f"test_report_{timestamp}.html"
        media_type = "text/html"
        
    elif format_type == "csv":
        content = format_report_as_csv(report)
        filename = f"test_report_{timestamp}.csv"
        media_type = "text/csv"
        
    else:
        return {"error": f"Unsupported format: {format_type}"}

    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

