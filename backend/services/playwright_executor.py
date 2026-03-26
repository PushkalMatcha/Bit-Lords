import os
from typing import Optional
from playwright.sync_api import sync_playwright
from backend.services.risk_engine import detect_module

# Resolve the path to local test target HTML page (zero network dependency)
TEST_PAGE = "file:///" + os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "test_target", "login.html"
).replace("\\", "/")


def _build_checkout_page_html() -> str:
        return """
        <html>
            <head>
                <title>Checkout Demo</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 24px; }
                    .row { margin-bottom: 10px; }
                    #status { margin-top: 14px; font-weight: 700; }
                </style>
            </head>
            <body>
                <h1>Checkout</h1>
                <div class="row"><input id="item-qty" value="1" /></div>
                <div class="row"><input id="card-number" placeholder="Card number" /></div>
                <div class="row"><button id="pay-btn">Pay Now</button></div>
                <div id="status"></div>
                <script>
                    document.getElementById('pay-btn').addEventListener('click', function () {
                        const qty = parseInt(document.getElementById('item-qty').value || '0', 10);
                        const card = document.getElementById('card-number').value || '';
                        const status = document.getElementById('status');
                        if (qty <= 0) {
                            status.textContent = 'Invalid quantity';
                            return;
                        }
                        if (card === '4111111111111111') {
                            status.textContent = 'Order placed';
                        } else {
                            status.textContent = 'Payment failed';
                        }
                    });
                </script>
            </body>
        </html>
        """


def _build_profile_page_html() -> str:
        return """
        <html>
            <head>
                <title>Profile Demo</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 24px; }
                    .row { margin-bottom: 10px; }
                    #status { margin-top: 14px; font-weight: 700; }
                </style>
            </head>
            <body>
                <h1>User Profile</h1>
                <div class="row"><input id="name" placeholder="Full name" /></div>
                <div class="row"><input id="email" placeholder="Email" /></div>
                <div class="row"><button id="save-btn">Save Profile</button></div>
                <div id="status"></div>
                <script>
                    document.getElementById('save-btn').addEventListener('click', function () {
                        const name = document.getElementById('name').value || '';
                        const email = document.getElementById('email').value || '';
                        const status = document.getElementById('status');
                        if (!name || email.indexOf('@') < 0) {
                            status.textContent = 'Validation error';
                            return;
                        }
                        status.textContent = 'Profile updated';
                    });
                </script>
            </body>
        </html>
        """


def _build_core_page_html() -> str:
        return """
        <html>
            <head>
                <title>Core System Demo</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 24px; }
                    .row { margin-bottom: 10px; }
                    #results { margin-top: 14px; }
                </style>
            </head>
            <body>
                <h1>Core Search</h1>
                <div class="row"><input id="query" placeholder="Search" /></div>
                <div class="row"><button id="search-btn">Search</button></div>
                <div id="results"></div>
                <script>
                    const data = ['order', 'profile', 'checkout', 'dashboard'];
                    document.getElementById('search-btn').addEventListener('click', function () {
                        const q = (document.getElementById('query').value || '').toLowerCase();
                        const results = document.getElementById('results');
                        if (!q) {
                            results.textContent = 'No query provided';
                            return;
                        }
                        const match = data.filter(x => x.indexOf(q) >= 0);
                        if (match.length === 0) {
                            results.textContent = 'No results';
                            return;
                        }
                        results.textContent = 'Results: ' + match.join(', ');
                    });
                </script>
            </body>
        </html>
        """

def run_logout_test(demo_mode: bool = True, on_step=None) -> dict:
    """
    Executes a controlled login/logout test flow using Playwright.
    In Demo Mode: uses WRONG credentials so login visibly fails (real bug simulation).
    In Live Mode: uses correct credentials for a full pass flow.
    """
    steps = []
    
    def emit(msg):
        steps.append(msg)
        if on_step:
            on_step(msg)
    
    emit("[AI] Executing test via Playwright (Real Browser)")
    emit("[AI] Launching Chromium browser")
    
    if demo_mode:
        emit("[AI] Running in Demo Mode (browser visible)")
    else:
        emit("[AI] Running in Live Mode (Headless Execution)")
        
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=not demo_mode,
                args=["--start-maximized", "--window-position=0,0"]
            )
            context = browser.new_context(no_viewport=True)
            page = context.new_page()
            
            emit("[AI] Opening target URL (SecureAuth Portal)")
            page.goto(TEST_PAGE, wait_until="domcontentloaded")
            if demo_mode:
                page.wait_for_timeout(2000)
            
            # --- Credentials: wrong in demo mode to trigger a real visible failure ---
            username = "admin"
            password = "password123" if not demo_mode else "wrongpassword"
            
            emit("[AI] Performing UI action: Filling Username field")
            page.fill('#username', username)
            if demo_mode:
                page.wait_for_timeout(1500)
            
            emit(f"[AI] Performing UI action: Filling Password field")
            page.fill('#password', password)
            if demo_mode:
                page.wait_for_timeout(1500)
            
            emit("[AI] Performing UI action: Clicking Login button")
            page.click('#login-btn')
            if demo_mode:
                page.wait_for_timeout(2500)
            
            # --- Validate login result ---
            emit("[AI] Validating expected behavior: Checking dashboard loaded")
            page.wait_for_timeout(1200)
            dashboard_visible = page.is_visible('#dashboard-view')
            error_visible = page.is_visible('#error-msg')
            
            status = "passed"
            error_msg = None
            login_visible = True  # default for live mode pass path
            
            if dashboard_visible:
                emit("[AI] ✓ Login successful — dashboard view confirmed")
                
                emit("[AI] Performing UI action: Clicking Logout button")
                page.click('#logout-btn')
                if demo_mode:
                    page.wait_for_timeout(2000)
                
                emit("[AI] Validating expected behavior: Checking return to login view")
                page.wait_for_timeout(1200)
                login_visible = page.is_visible('#login-view')
                
                if login_visible:
                    emit("[AI] ✓ Logout successful — login view restored")
                else:
                    emit("[AI] ✗ Logout failed — login view not restored")
                    status = "failed"
                    error_msg = "Logout did not redirect to login view"
            else:
                # Login FAILED — this is the demo mode path
                emit("[AI] ✗ Login FAILED — dashboard view not loaded")
                if error_visible:
                    emit("[AI] ✗ Error message detected: 'Invalid credentials. Access denied.'")
                emit("[AI] ✗ Authentication assertion failed — expected dashboard, got error state")
                status = "failed"
                error_msg = "Login failed: Invalid credentials returned 'Access denied' error. Dashboard never loaded."
            
            if demo_mode:
                page.wait_for_timeout(2000)  # Let judges see the error state
            
            browser.close()
            
            if status == "passed":
                emit("[AI] All assertions passed — test completed successfully")
            
            return {
                "status": status,
                "error": error_msg,
                "steps": steps,
                "execution_mode": "playwright",
                "demo_mode": demo_mode
            }
            
    except Exception as e:
        emit(f"[AI] Playwright execution failed, switching to simulation: {repr(e)}")
        return {
            "status": "error",
            "error": repr(e),
            "steps": steps,
            "execution_mode": "simulation",
            "demo_mode": demo_mode
        }


def run_story_driven_test(user_story: str, demo_mode: bool = True, on_step=None) -> dict:
    """
    Executes real-browser tests based on the detected story module.
    Authentication uses the existing login/logout page.
    Checkout, User Profile, and Core System use dedicated browser flows.
    """
    module = detect_module(user_story)

    # Keep the mature authentication flow for auth stories.
    if module == "Authentication":
        if on_step:
            on_step("[AI] Story classified as Authentication. Running auth browser flow.")
        result = run_logout_test(demo_mode=demo_mode, on_step=on_step)
        result["module"] = module
        return result

    steps = []

    def emit(msg: str):
        steps.append(msg)
        if on_step:
            on_step(msg)

    emit("[AI] Executing test via Playwright (Story-driven Real Browser)")
    emit(f"[AI] Story classified as {module}")

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=not demo_mode,
                args=["--start-maximized", "--window-position=0,0"]
            )
            context = browser.new_context(no_viewport=True)
            page = context.new_page()

            status = "passed"
            error_msg: Optional[str] = None
            scenario = "generic"

            if module == "Checkout":
                scenario = "checkout_payment"
                emit("[AI] Opening checkout workflow page")
                page.set_content(_build_checkout_page_html())
                if demo_mode:
                    page.wait_for_timeout(600)

                emit("[AI] Filling quantity and payment details")
                page.fill("#item-qty", "1")
                card = "0000000000000000" if demo_mode else "4111111111111111"
                page.fill("#card-number", card)

                emit("[AI] Submitting checkout")
                page.click("#pay-btn")
                page.wait_for_timeout(500)

                result_text = page.inner_text("#status")
                expected = "Order placed"
                if expected in result_text:
                    emit("[AI] ✓ Checkout completed successfully")
                else:
                    emit(f"[AI] ✗ Checkout assertion failed (actual: {result_text})")
                    status = "failed"
                    error_msg = "Checkout flow did not produce a successful order confirmation"

            elif module == "User Profile":
                scenario = "profile_update"
                emit("[AI] Opening profile workflow page")
                page.set_content(_build_profile_page_html())
                if demo_mode:
                    page.wait_for_timeout(600)

                emit("[AI] Editing profile fields")
                page.fill("#name", "Demo User")
                email = "invalid-email" if demo_mode else "demo.user@example.com"
                page.fill("#email", email)

                emit("[AI] Saving profile")
                page.click("#save-btn")
                page.wait_for_timeout(500)

                result_text = page.inner_text("#status")
                expected = "Profile updated"
                if expected in result_text:
                    emit("[AI] ✓ Profile update completed successfully")
                else:
                    emit(f"[AI] ✗ Profile assertion failed (actual: {result_text})")
                    status = "failed"
                    error_msg = "Profile update did not complete with success status"

            else:
                scenario = "core_search"
                emit("[AI] Opening core system workflow page")
                page.set_content(_build_core_page_html())
                if demo_mode:
                    page.wait_for_timeout(600)

                emit("[AI] Running core search workflow")
                query = "unknown" if demo_mode else "dash"
                page.fill("#query", query)
                page.click("#search-btn")
                page.wait_for_timeout(500)

                result_text = page.inner_text("#results")
                expected_fragment = "Results:"
                if expected_fragment in result_text:
                    emit("[AI] ✓ Core workflow returned expected search results")
                else:
                    emit(f"[AI] ✗ Core assertion failed (actual: {result_text})")
                    status = "failed"
                    error_msg = "Core workflow did not return expected results"

            browser.close()

            if status == "passed":
                emit("[AI] All assertions passed - story-driven test completed successfully")

            return {
                "status": status,
                "error": error_msg,
                "steps": steps,
                "execution_mode": "playwright",
                "demo_mode": demo_mode,
                "module": module,
                "scenario": scenario
            }

    except Exception as e:
        emit(f"[AI] Playwright execution failed, switching to simulation: {repr(e)}")
        return {
            "status": "error",
            "error": repr(e),
            "steps": steps,
            "execution_mode": "simulation",
            "demo_mode": demo_mode,
            "module": module
        }

