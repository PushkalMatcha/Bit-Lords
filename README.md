# 🚀 AI Tester Agent (Bit-Lords)

AI Tester Agent is an end-to-end intelligent testing system that converts user stories into executable test workflows, runs them on a real browser using Playwright, and continuously improves testing through AI-driven failure analysis and regression intelligence.

---

## 🧠 1. Problem Statement Fit

This project directly addresses the hackathon requirement:

- Ingest user stories from Jira/Azure DevOps  
- Automatically generate test scenarios  
- Execute tests and detect failures  
- Analyze root causes and suggest fixes  
- Trigger regression strategies  
- Produce downloadable test reports  

---

## ✅ What is Implemented

- Jira story import (API + UI)
- AI-based test generation (LLM)
- Real browser execution using Playwright
- Failure analysis engine
- Risk scoring and regression planning
- Downloadable reports (JSON, HTML, CSV)

---

## ⚡ 2. Core Features

## 🔹 2.1 Jira Story Import

- Import stories using issue key (e.g., `DEV-1`)
- Uses Jira REST API with authentication
- Converts issue into testable input
- Automatically triggers test pipeline

---

## 🔹 2.2 AI Test Generation

- Uses LLM (Groq / LLaMA 3.3)
- Generates:
  - Positive test cases
  - Negative test cases
  - Edge cases
- Produces realistic, context-aware scenarios

---

## 🔹 2.3 ⚡ Real Browser Execution (Playwright)

- Executes tests on a live Chromium browser
- Simulates real user actions (click, type, navigate)
- Validates actual UI behavior (not simulation)
- Supports:
  - **Live Mode (real execution)**
  - **Demo Mode (controlled failure injection)**

---

## 🔹 2.4 Story-Driven Execution Engine

- Detects module from user story:
  - Authentication
  - Checkout
  - User Profile
  - Core System
- Routes execution accordingly

---

## 🔹 2.5 Failure & Risk Intelligence

- Detects failed scenarios
- AI generates:
  - Expected vs Actual behavior
  - Root cause
  - Suggestions
- Updates module risk:
  - LOW / MEDIUM / HIGH

---

## 🔹 2.6 Regression Intelligence

- Automatically triggered on failures
- Generates structured regression test cases:
  - id
  - title
  - priority
  - steps
  - expected result

---

## 🔹 2.7 Reports

Downloadable formats:

- JSON
- HTML
- CSV

Includes:

- Test summary
- Execution results
- Failures
- Risk analysis
- Recommendations

---

## 🔹 2.8 Demo Mode (Smart Feature)

- Ensures at least one failure for demo visibility
- Uses real execution + controlled failure injection  
- Can be disabled for fully real results

---

## 🏗️ 3. Architecture Overview

```text
User Story (Manual / Jira)
  -> AI Test Generation (LLM)
  -> Playwright Execution (Real Browser)
  -> Failure Detection
  -> AI Failure Analysis
  -> Risk Scoring Engine
  -> Regression Trigger
  -> Report Generation
```

---

## 🛠️ 4. Tech Stack

## Backend

- Python 3.10+
- FastAPI
- Playwright
- Groq LLM API
- Supabase (PostgreSQL)

## Frontend

- React
- TypeScript
- Vite
- Tailwind CSS

## Integrations

- Supabase (data persistence)
- Jira Cloud API

---

## 📁 5. Repository Structure

```text
backend/
  main.py
  routes/
    stories.py
    test_run.py
  services/
    ai_generator.py
    test_executor.py
    playwright_executor.py
    failure_analyzer.py
    risk_engine.py
    regression_engine.py
    report_generator.py
    jira_integration.py

frontend/
  src/
    App.tsx

database/
  schema.sql
  client.py
```

---

## ⚙️ 6. Setup Instructions

## Prerequisites

- Python 3.10+
- Node.js 18+
- Supabase project
- Groq API key
- Jira API token (optional)

---

## Environment Variables

Create `.env`:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
```
GROQ_API_KEY=your_groq_api_key


```powershell
JIRA_URL=https://your-domain.atlassian.net
JIRA_USERNAME=your_jira_email
JIRA_API_TOKEN=your_jira_api_token

## Run Backend

```
cd backend
python -m venv venv

```powershell
venv\Scripts\activate
pip install -r requirements.txt
playwright install
```
uvicorn main:app --reload


- Frontend: http://localhost:5173
- Backend: http://localhost:8000
## Run Frontend
---
cd frontend
## ▶️ 7. How to Use
npm run dev
### Option A: Manual Input
Frontend → http://localhost:5173
1. Enter user story
2. Click Start Test Run
3. View pipeline execution
4. Check logs and results
5. Download report
Backend → http://localhost:8000
### Option B: Jira Import
▶️ 7. How to Use
1. Click Import from Jira
2. Enter issue key (e.g., DEV-1)
3. Run pipeline automatically
Enter user story
---
Click Start Test Run
## 🔌 8. API Endpoints

### Stories & Jira

- POST /api/stories/
- GET /api/stories/
- POST /api/stories/import-from-jira

### Execution
Enter issue key (e.g., DEV-1)
- POST /run-test
- POST /run-test-stream
Run pipeline automatically
### Reports
🔌 8. API Endpoints
- POST /export-report
- POST /download-report/{format}

### Health

- GET /health
Reports
POST /export-report

POST /download-report/{format}

Health
GET /health

