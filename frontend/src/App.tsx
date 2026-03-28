import React, { useState, useEffect, useRef } from 'react';
import {
  Clock,
  Beaker, 
  LayoutDashboard, 
  History, 
  FileBarChart, 
  Settings, 
  Play, 
  Loader2, 
  XCircle, 
  ChevronDown, 
  ChevronRight,
  TerminalSquare, 
  Check, 
  Activity, 
  TestTube,
  ShieldCheck, 
  Code2,
  FileCode2,
  ListMinus,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Lightbulb,
  Download,
  GitBranch,
  Plus,
  FileJson,
  FileText
} from 'lucide-react';

interface Story {
  id: string;
  story: string;
  status: string;
  test_results: any;
  created_at: string;
}

interface LogEntry {
  id: number;
  time: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

const SIDEBAR_ITEMS = [
  { name: 'Dashboard', icon: LayoutDashboard, page: 'dashboard' },
  { name: 'Test Runs', icon: History, page: 'test-runs' },
  { name: 'Reports', icon: FileBarChart, page: 'reports' },
  { name: 'Settings', icon: Settings, page: 'settings' },
];

const MOCK_TEST_CASES = [
  "Verify successful login with valid credentials",
  "Ensure error message displays on invalid email format",
  "Check account lock after 5 failed attempts",
  "Validate empty password field validation"
];

function App() {
  const [activePage, setActivePage] = useState('dashboard');
  const [storyInput, setStoryInput] = useState('');
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [pipelineVisible, setPipelineVisible] = useState(false);
  const [pipelineSteps, setPipelineSteps] = useState({
    generation: 'pending',
    execution: 'pending',
    detection: 'pending',
    analysis: 'pending',
    history: 'pending',
    score: 'pending',
    improve: 'pending'
  });
  
  // Jira Integration State
  const [showJiraDialog, setShowJiraDialog] = useState(false);
  const [jiraInput, setJiraInput] = useState('');
  const [jiraLoading, setJiraLoading] = useState(false);
  
  // Report Export State
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [reportExporting, setReportExporting] = useState(false);
  const [selectedReportRun, setSelectedReportRun] = useState<Story | null>(null);
  const [reportFormat, setReportFormat] = useState<'json' | 'html' | 'csv'>('json');
  
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showTestCases, setShowTestCases] = useState(false);
  const [testsExpanded, setTestsExpanded] = useState(true);
  const [riskData, setRiskData] = useState<{
    module: string;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    reasons: string[];
    regressionTriggered?: boolean;
    aiActions?: string[];
  } | null>(null);

  const [testCases, setTestCases] = useState<string[]>(MOCK_TEST_CASES);

  const [failureDetails, setFailureDetails] = useState<{
    test: string;
    status: string;
    expected: string;
    actual: string;
    rootCause: string;
    suggestion: string;
  } | null>(null);
  const [executionResult, setExecutionResult] = useState<{
    testsGenerated: number;
    passed: number;
    failed: number;
    time: string;
  } | null>(null);

  const [executionMode, setExecutionMode] = useState<'playwright' | 'simulation' | null>(null);
  const [demoMode, setDemoMode] = useState<boolean | null>(null);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(true);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const expandedTestRunRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchStories();
    const interval = setInterval(fetchStories, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  useEffect(() => {
    if (activePage === 'test-runs' && expandedTestRunRef.current) {
      setTimeout(() => {
        expandedTestRunRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [activePage, expandedRun]);

  const fetchStories = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/stories/');
      if (res.ok) {
        const data = await res.json();
        setStories(data);
      }
    } catch (error) {
      console.error('Failed to fetch stories', error);
    }
  };

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    const now = new Date();
    const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    setLogs(prev => [...prev, { id: Date.now() + Math.random(), time: timeString, message, type }]);
  };

  const executeLivePipeline = async (story: string, demoToggle: boolean) => {
    setExecutionResult(null);
    setShowTestCases(false);
    setLogs([]);
    setRiskData(null);
    setFailureDetails(null);
    setTestCases([]);
    setExecutionMode(null);
    setDemoMode(null);
    
    addLog('System initialized. Connecting to remote API...', 'info');
    
    // Helper: determine log type from message content
    const getLogType = (msg: string): LogEntry['type'] => {
      if (msg.includes('✓') || msg.includes('successful') || msg.includes('passed') || msg.includes('compiled') || msg.includes('finalized')) return 'success';
      if (msg.includes('✗') || msg.includes('failed') || msg.includes('error') || msg.includes('Error')) return 'error';
      if (msg.includes('Failure') || msg.includes('Demo Mode') || msg.includes('HIGH') || msg.includes('MEDIUM') || msg.includes('Stop')) return 'warning';
      return 'info';
    };
    
    const controller = new AbortController();
    setAbortController(controller);

    try {
      // Stream SSE events from the backend in real-time
      const res = await fetch('http://localhost:8000/run-test-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_story: story, demo_mode: demoToggle }),
        signal: controller.signal
      });
      
      if (!res.body) throw new Error('No response body');
      
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';  // Keep incomplete line in buffer
        
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          
          try {
            const event = JSON.parse(line.slice(6));
            
            switch (event.type) {
              case 'log':
                addLog(event.message, getLogType(event.message));
                break;
                
              case 'phase':
                setPipelineSteps(s => ({
                  ...s,
                  [event.phase]: event.status === 'completed' ? 'completed' : 'running'
                }));
                break;
                
              case 'tests': {
                const builtTests = [
                  ...(event.data?.positive_tests || []),
                  ...(event.data?.negative_tests || []),
                  ...(event.data?.edge_cases || [])
                ];
                setTestCases(builtTests.length > 0 ? builtTests : MOCK_TEST_CASES);
                setShowTestCases(true);
                setTestsExpanded(true);
                break;
              }
                
              case 'execution':
                setExecutionMode(event.data?.execution_mode || 'simulation');
                setDemoMode(event.data?.demo_mode ?? null);
                setExecutionResult({
                  testsGenerated: event.data?.total || 0,
                  passed: event.data?.passed || 0,
                  failed: event.data?.failed || 0,
                  time: `${event.data?.execution_time}s`
                });
                break;
                
              case 'failure':
                setFailureDetails({
                  test: event.data?.test_name || 'Unknown test',
                  status: event.data?.status || 'FAILED',
                  expected: event.data?.expected || 'Process completed securely',
                  actual: event.data?.actual || 'Execution failed',
                  rootCause: event.data?.root_cause || 'System Error',
                  suggestion: event.data?.suggestion || 'Review code logic'
                });
                break;
                
              case 'risk':
                setRiskData(prev => ({
                  module: event.module || prev?.module || 'Unknown',
                  riskLevel: event.data?.level || 'LOW',
                  reasons: prev?.reasons || [],
                  regressionTriggered: prev?.regressionTriggered || false,
                  aiActions: prev?.aiActions || []
                }));
                break;
                
              case 'regression':
                setRiskData(prev => prev ? ({
                  ...prev,
                  regressionTriggered: event.data?.regression_triggered || false,
                  aiActions: event.data?.actions || [],
                  reasons: event.data?.regression_triggered ? ['Recent failures detected'] : ['No recent failures detected']
                }) : null);
                break;
                
              case 'complete':
                fetchStories();
                break;
            }
          } catch {
            // Skip malformed JSON lines
          }
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        addLog('Pipeline execution stopped by user.', 'warning');
      } else {
        addLog(`Critical Error reaching backend API: ${error}`, 'error');
      }
    } finally {
      setAbortController(null);
      setIsRunning(false);
      setLoading(false);
    }
  };

  const handleStop = () => {
    if (abortController) {
      addLog('Stopping test pipeline...', 'warning');
      abortController.abort();
    }
  };

  const handleNewStory = () => {
    setStoryInput('');
    setPipelineVisible(false);
    setLogs([]);
    setExecutionResult(null);
    setShowTestCases(false);
    setRiskData(null);
    setFailureDetails(null);
    setTestCases(MOCK_TEST_CASES);
    setExecutionMode(null);
    setDemoMode(null);
    setPipelineSteps({
      generation: 'pending',
      execution: 'pending',
      detection: 'pending',
      analysis: 'pending',
      history: 'pending',
      score: 'pending',
      improve: 'pending'
    });
    if (abortController) {
      abortController.abort();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storyInput.trim()) return;
    
    setIsRunning(true);
    setPipelineVisible(true);
    setPipelineSteps({
      generation: 'running',
      execution: 'pending',
      detection: 'pending',
      analysis: 'pending',
      history: 'pending',
      score: 'pending',
      improve: 'pending'
    });
    setLoading(true);
    // Execute live sequence immediately
    // Wait for the pipeline visual stream to end, bypassing the legacy secondary POST endpoint
    executeLivePipeline(storyInput, isDemoMode);
  };

  const handleJiraImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jiraInput.trim()) return;
    
    setJiraLoading(true);
    try {
      const response = await fetch('http://localhost:8000/api/stories/import-from-jira', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issue_key: jiraInput.trim().toUpperCase(),
          jira_url: '', // Uses env var
          username: '', // Uses env var
          api_token: '' // Uses env var
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        addLog(`✓ Successfully imported Jira issue ${data.jira_issue}!`, 'success');
        setJiraInput('');
        setShowJiraDialog(false);
        // Only load the story into the input box instead of auto-running
        setStoryInput(data.story);
        await fetchStories();
      } else {
        const error = await response.json();
        addLog(`✗ Jira import failed: ${error.detail}`, 'error');
      }
    } catch (error) {
      addLog(`✗ Jira import error: ${error}`, 'error');
    } finally {
      setJiraLoading(false);
    }
  };

  const handleExportReport = async (format: 'json' | 'html' | 'csv') => {
    if (!selectedReportRun?.test_results) return;
    
    setReportExporting(true);
    try {
      const response = await fetch(`http://localhost:8000/download-report/${format}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          test_results: selectedReportRun.test_results,
          user_story: selectedReportRun.story,
          format: format
        })
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `test_report_${new Date().toISOString().slice(0, 10)}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        addLog(`✓ Report exported as ${format.toUpperCase()}`, 'success');
        setShowReportDialog(false);
      }
    } catch (error) {
      addLog(`✗ Report export failed: ${error}`, 'error');
    } finally {
      setReportExporting(false);
    }
  };

  // Quick stat calculations
  const totalRuns = stories.length;
  const testsGenerated = stories.reduce((acc, s) => {
    return acc + (s.test_results?.execution?.total || 0);
  }, 0);
  const passedTests = stories.reduce((acc, s) => {
    return acc + (s.test_results?.execution?.passed || 0);
  }, 0);
  // Calculate a precise success rate natively
  const successRate = testsGenerated > 0 ? Math.round((passedTests / testsGenerated) * 100) : 0;

  return (
    <div className="flex h-screen bg-[#0f0f0f] text-[#fafafa] font-sans overflow-hidden selection:bg-[#10b981]/30 selection:text-white">
      
      {/* LEFT SIDEBAR */}
      <aside className="w-64 bg-[#0f0f0f] border-r border-[#27272a] flex flex-col shrink-0">
        <div className="h-14 px-5 border-b border-[#27272a] flex items-center gap-3 shrink-0">
          <div className="bg-[#18181b] border border-[#27272a] p-1.5 rounded-md text-[#fafafa]">
            <Beaker className="w-4 h-4" />
          </div>
          <span className="font-semibold text-[#fafafa] text-sm tracking-tight">AI Tester Agent</span>
        </div>
        
        <div className="flex-1 py-4 px-3 flex flex-col gap-1 overflow-y-auto">
          {SIDEBAR_ITEMS.map((item, idx) => {
            const isActive = activePage === item.page;
            return (
              <button 
                key={idx}
                onClick={() => setActivePage(item.page)}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all duration-150 relative ${
                  isActive 
                    ? 'bg-[#18181b] text-[#fafafa] font-medium border border-[#27272a]' 
                    : 'text-[#a1a1aa] hover:bg-[#18181b]/50 hover:text-[#fafafa] border border-transparent'
                }`}
              >
                {isActive && (
                  <div className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-[#10b981]"></div>
                )}
                <item.icon className={`w-4 h-4 ${isActive ? 'text-[#10b981]' : ''}`} />
                {item.name}
              </button>
            );
          })}
        </div>
        
        <div className="p-4 border-t border-[#27272a] flex items-center gap-3 hover:bg-[#18181b]/50 cursor-pointer transition-colors">
          <div className="w-8 h-8 rounded-full bg-[#18181b] flex items-center justify-center text-xs font-bold text-[#fafafa] border border-[#27272a]">
            QA
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-medium text-[#fafafa]">Bit Lords</span>
            <span className="text-[10px] text-[#a1a1aa]">Engineering</span>
          </div>
        </div>
      </aside>

      {/* MAIN WORKSPACE */}
      <main className="flex-1 flex flex-col h-full bg-[#0f0f0f] relative">
        <header className="h-14 border-b border-[#27272a] flex items-center justify-between px-8 shrink-0 bg-[#0f0f0f] z-10">
          <h1 className="text-sm font-semibold text-[#fafafa]">{activePage === 'dashboard' ? 'Dashboard' : activePage === 'test-runs' ? 'Test Runs' : activePage === 'reports' ? 'Reports' : 'Settings'}</h1>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#a1a1aa] font-mono">{totalRuns} runs</span>
            <div className="h-4 w-px bg-[#27272a]"></div>
            <span className="text-xs text-[#a1a1aa] font-mono">{testsGenerated} tests</span>
          </div>
        </header>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar p-8">

          {/* ──── TEST RUNS PAGE ──── */}
          {activePage === 'test-runs' && (
            <div className="max-w-5xl mx-auto space-y-4 pb-10">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold text-[#fafafa] flex items-center gap-2"><History className="w-5 h-5 text-[#a1a1aa]" /> All Test Runs</h2>
                <span className="text-xs text-[#a1a1aa] font-mono">{stories.length} total runs</span>
              </div>

              {stories.length === 0 ? (
                <div className="bg-[#18181b] border border-[#27272a] rounded-lg p-12 text-center">
                  <TerminalSquare className="w-10 h-10 text-[#a1a1aa] mx-auto mb-4 opacity-40" />
                  <p className="text-sm text-[#a1a1aa]">No test runs yet. Go to the Dashboard to create your first run.</p>
                  <button onClick={() => setActivePage('dashboard')} className="mt-4 px-4 py-2 bg-[#10b981] text-white text-xs font-semibold rounded-md hover:bg-[#059669] transition-colors">Go to Dashboard</button>
                </div>
              ) : (
                stories.map((story) => {
                  const exec = story.test_results?.execution;
                  const failure = story.test_results?.failure_analysis;
                  const risk = story.test_results?.risk_analysis;
                  const aiAction = story.test_results?.ai_action;
                  const regressionTests = story.test_results?.regression_tests || aiAction?.regression_test_cases || [];
                  const isExpanded = expandedRun === story.id;
                  const isFailed = story.status === 'failed';
                  const execMode = exec?.execution_mode === 'playwright' ? 'Playwright' : 'Simulation';
                  const execTime = exec?.execution_time ? `${exec.execution_time}s` : '-';
                  const testData = story.test_results?.tests;
                  const allTests = [
                    ...(testData?.positive_tests || []),
                    ...(testData?.negative_tests || []),
                    ...(testData?.edge_cases || [])
                  ];
                  const createdDate = story.created_at ? new Date(story.created_at) : null;
                  const timeStr = createdDate ? createdDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '-';
                  const dateStr = createdDate ? createdDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-';

                  return (
                    <div 
                      key={story.id}
                      ref={isExpanded ? expandedTestRunRef : null}
                      className={`bg-[#18181b] border rounded-lg transition-all duration-200 ${
                        isExpanded ? 'border-[#10b981]/40 shadow-[0_0_20px_rgba(16,185,129,0.05)]' : 'border-[#27272a] hover:border-[#3f3f46]'
                      }`}
                    >
                      {/* Run Header Row */}
                      <button
                        onClick={() => setExpandedRun(isExpanded ? null : story.id)}
                        className="w-full px-5 py-4 flex items-center gap-4 text-left"
                      >
                        <div className="shrink-0">
                          {isExpanded ? <ChevronDown className="w-4 h-4 text-[#10b981]" /> : <ChevronRight className="w-4 h-4 text-[#a1a1aa]" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-[10px] text-[#6b7280]">{story.id.split('-')[0]}</span>
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide ${
                              isFailed ? 'bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/20' : 'bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/20'
                            }`}>
                              {isFailed ? <XCircle className="w-2.5 h-2.5" /> : <CheckCircle2 className="w-2.5 h-2.5" />}
                              {isFailed ? 'Failed' : 'Passed'}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase ${
                              execMode === 'Playwright' ? 'bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/20' : 'bg-[#a78bfa]/10 text-[#a78bfa] border border-[#a78bfa]/20'
                            }`}>{execMode}</span>
                          </div>
                          <p className="text-sm text-[#fafafa] truncate">{story.story}</p>
                        </div>
                        <div className="flex items-center gap-6 shrink-0 text-xs text-[#a1a1aa]">
                          <div className="flex items-center gap-1.5"><TestTube className="w-3.5 h-3.5" />{exec?.total || 0} tests</div>
                          <div className="flex items-center gap-1.5 text-[#10b981]">{exec?.passed || 0} passed</div>
                          <div className="flex items-center gap-1.5 text-[#ef4444]">{exec?.failed || 0} failed</div>
                          <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{execTime}</div>
                          <div className="text-[#6b7280] text-[10px] font-mono">{dateStr} {timeStr}</div>
                        </div>
                      </button>

                      {/* Expanded Detail Panel */}
                      {isExpanded && (
                        <div className="border-t border-[#27272a] px-5 py-5 space-y-5">
                          {/* Test Cases */}
                          {allTests.length > 0 && (
                            <div>
                              <h4 className="text-[11px] font-bold text-[#a1a1aa] uppercase tracking-wider mb-3 flex items-center gap-2"><ListMinus className="w-3.5 h-3.5"/>Generated Test Cases</h4>
                              <div className="grid grid-cols-2 gap-2">
                                {allTests.map((tc: string, i: number) => (
                                  <div key={i} className="bg-[#0f0f0f] border border-[#27272a] rounded-md px-3 py-2 text-xs text-[#d4d4d8] flex items-start gap-2">
                                    <span className="text-[#6b7280] font-mono shrink-0">T{i+1}</span>
                                    <span className="truncate">{tc}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Execution Summary */}
                          <div className="flex gap-4">
                            <div className="flex-1 bg-[#0f0f0f] border border-[#27272a] rounded-lg p-4">
                              <h4 className="text-[11px] font-bold text-[#a1a1aa] uppercase tracking-wider mb-3">Execution Summary</h4>
                              <div className="grid grid-cols-4 gap-4 text-center">
                                <div><div className="text-lg font-bold text-[#fafafa]">{exec?.total || 0}</div><div className="text-[10px] text-[#6b7280] uppercase">Total</div></div>
                                <div><div className="text-lg font-bold text-[#10b981]">{exec?.passed || 0}</div><div className="text-[10px] text-[#6b7280] uppercase">Passed</div></div>
                                <div><div className="text-lg font-bold text-[#ef4444]">{exec?.failed || 0}</div><div className="text-[10px] text-[#6b7280] uppercase">Failed</div></div>
                                <div><div className="text-lg font-bold text-[#fafafa]">{execTime}</div><div className="text-[10px] text-[#6b7280] uppercase">Duration</div></div>
                              </div>
                            </div>
                            <div className="w-48 bg-[#0f0f0f] border border-[#27272a] rounded-lg p-4">
                              <h4 className="text-[11px] font-bold text-[#a1a1aa] uppercase tracking-wider mb-3">Risk Level</h4>
                              <div className="text-center">
                                <div className={`text-xl font-bold ${
                                  risk?.level === 'HIGH' ? 'text-[#ef4444]' : risk?.level === 'MEDIUM' ? 'text-[#f59e0b]' : 'text-[#10b981]'
                                }`}>{risk?.level || 'LOW'}</div>
                                <div className="text-[10px] text-[#6b7280] uppercase mt-1">{story.test_results?.module || 'Module'}</div>
                              </div>
                            </div>
                          </div>

                          {/* Failure Analysis */}
                          {failure && (
                            <div className="bg-[#ef4444]/5 border border-[#ef4444]/20 rounded-lg p-4">
                              <h4 className="text-[11px] font-bold text-[#ef4444] uppercase tracking-wider mb-3 flex items-center gap-2"><AlertTriangle className="w-3.5 h-3.5"/>Failure Analysis</h4>
                              <div className="grid grid-cols-2 gap-3 text-xs">
                                <div><span className="text-[#6b7280]">Test:</span> <span className="text-[#fafafa] ml-1">{failure.test_name}</span></div>
                                <div><span className="text-[#6b7280]">Status:</span> <span className="text-[#ef4444] font-semibold ml-1">{failure.status}</span></div>
                                <div><span className="text-[#6b7280]">Expected:</span> <span className="text-[#d4d4d8] ml-1">{failure.expected}</span></div>
                                <div><span className="text-[#6b7280]">Actual:</span> <span className="text-[#d4d4d8] ml-1">{failure.actual}</span></div>
                                <div className="col-span-2"><span className="text-[#6b7280]">Root Cause:</span> <span className="text-[#f59e0b] ml-1">{failure.root_cause}</span></div>
                                <div className="col-span-2 flex items-start gap-1.5"><Lightbulb className="w-3.5 h-3.5 text-[#10b981] shrink-0 mt-0.5"/><span className="text-[#10b981]">{failure.suggestion}</span></div>
                              </div>
                            </div>
                          )}

                          {/* AI Regression Actions */}
                          {aiAction?.regression_triggered && aiAction?.actions?.length > 0 && (
                            <div className="bg-[#f59e0b]/5 border border-[#f59e0b]/20 rounded-lg p-4">
                              <h4 className="text-[11px] font-bold text-[#f59e0b] uppercase tracking-wider mb-2 flex items-center gap-2"><ShieldCheck className="w-3.5 h-3.5"/>AI Regression Actions</h4>
                              <ul className="space-y-1">
                                {aiAction.actions.map((a: string, i: number) => (
                                  <li key={i} className="text-xs text-[#d4d4d8] flex items-start gap-2">
                                    <span className="text-[#f59e0b]">→</span>{a}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Generated Regression Test Cases */}
                          {regressionTests.length > 0 && (
                            <div className="bg-[#3b82f6]/5 border border-[#3b82f6]/20 rounded-lg p-4">
                              <h4 className="text-[11px] font-bold text-[#3b82f6] uppercase tracking-wider mb-3 flex items-center gap-2"><TestTube className="w-3.5 h-3.5"/>Generated Regression Test Cases</h4>
                              <div className="space-y-2">
                                {regressionTests.map((tc: any, i: number) => (
                                  <div key={tc.id || i} className="bg-[#0f0f0f] border border-[#27272a] rounded-md p-3">
                                    <div className="flex items-center justify-between gap-2 mb-1.5">
                                      <span className="text-xs font-semibold text-[#fafafa] truncate">{tc.title || `Regression Case ${i + 1}`}</span>
                                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/20">{tc.priority || 'P2'}</span>
                                    </div>
                                    <div className="text-[11px] text-[#a1a1aa]">Expected: <span className="text-[#d4d4d8]">{tc.expected_result || 'No regressions in targeted workflow'}</span></div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Execution Trace */}
                          {exec?.logs?.length > 0 && (
                            <div>
                              <h4 className="text-[11px] font-bold text-[#a1a1aa] uppercase tracking-wider mb-2 flex items-center gap-2"><TerminalSquare className="w-3.5 h-3.5"/>Execution Trace</h4>
                              <div className="bg-[#0b0b0c] border border-[#27272a] rounded-lg p-3 max-h-48 overflow-y-auto custom-scrollbar font-mono text-[10px] space-y-0.5">
                                {exec.logs.map((log: string, i: number) => (
                                  <div key={i} className={`${
                                    log.includes('✓') || log.includes('successful') ? 'text-emerald-400' :
                                    log.includes('✗') || log.includes('FAILED') || log.includes('Error') ? 'text-red-400' :
                                    log.includes('Demo Mode') || log.includes('Failure') ? 'text-[#f59e0b]' :
                                    'text-[#6b7280]'
                                  }`}>{log}</div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Export Report Button */}
                          <div className="flex gap-2 pt-2 border-t border-[#27272a]">
                            <button
                              onClick={() => {
                                setSelectedReportRun(story);
                                setShowReportDialog(true);
                              }}
                              className="flex-1 px-4 py-2 bg-[#10b981]/10 hover:bg-[#10b981]/20 border border-[#10b981]/30 hover:border-[#10b981]/50 text-[#10b981] rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                            >
                              <Download className="w-4 h-4" />
                              Download Report
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ──── REPORTS / SETTINGS PLACEHOLDER ──── */}
          {(activePage === 'reports' || activePage === 'settings') && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-12">
                {activePage === 'reports' ? <FileBarChart className="w-12 h-12 text-[#a1a1aa] mx-auto mb-4 opacity-40" /> : <Settings className="w-12 h-12 text-[#a1a1aa] mx-auto mb-4 opacity-40" />}
                <h2 className="text-lg font-semibold text-[#fafafa] mb-2">{activePage === 'reports' ? 'Reports' : 'Settings'}</h2>
                <p className="text-sm text-[#a1a1aa] max-w-sm">This section is coming soon. AI-powered test reports and configuration options will be available in the next release.</p>
              </div>
            </div>
          )}

          {/* ──── DASHBOARD PAGE ──── */}
          {activePage === 'dashboard' && (
          <div className="max-w-4xl mx-auto flex flex-col gap-6 pb-10">
            
            {/* Top Metrics Row */}
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-[#18181b] border border-[#27272a] rounded-lg p-5 transition-colors hover:border-[#3f3f46] flex flex-col justify-between">
                <div>
                  <div className="text-[#a1a1aa] text-[11px] font-semibold uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5" /> Total Runs
                  </div>
                  <div className="text-2xl font-semibold text-[#fafafa]">{totalRuns}</div>
                </div>
                <div className="text-xs text-[#9ca3af] mt-3">+6 today</div>
              </div>
              <div className="bg-[#18181b] border border-[#27272a] rounded-lg p-5 transition-colors hover:border-[#3f3f46] flex flex-col justify-between">
                <div>
                  <div className="text-[#a1a1aa] text-[11px] font-semibold uppercase tracking-wider mb-2 flex items-center gap-2">
                    <TestTube className="w-3.5 h-3.5" /> Tests Generated
                  </div>
                  <div className="text-2xl font-semibold text-[#fafafa]">{testsGenerated}</div>
                </div>
                <div className="text-xs text-[#9ca3af] mt-3">Last run: 4 tests</div>
              </div>
              <div className="bg-[#18181b] border border-[#27272a] rounded-lg p-5 transition-colors hover:border-[#3f3f46] flex flex-col justify-between">
                <div>
                  <div className="text-[#a1a1aa] text-[11px] font-semibold uppercase tracking-wider mb-2 flex items-center gap-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#10b981]" /> Passed
                  </div>
                  <div className="text-2xl font-semibold text-[#10b981]">{passedTests}</div>
                </div>
                <div className="text-xs text-[#9ca3af] mt-3">Success trend ↑</div>
              </div>
              <div className="bg-[#18181b] border border-[#27272a] rounded-lg p-5 transition-colors hover:border-[#3f3f46] flex flex-col justify-between">
                <div>
                  <div className="text-[#a1a1aa] text-[11px] font-semibold uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5" /> Success Rate</span>
                  </div>
                  <div className="text-2xl font-semibold text-[#fafafa]">{successRate}%</div>
                </div>
                <div className="text-xs text-[#9ca3af] mt-3">Last execution: 3 passed / 1 failed</div>
              </div>
            </div>

            {/* Input Section */}
            <section className="bg-[#18181b] border border-[#27272a] rounded-lg">
              <div className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-semibold text-[#fafafa] flex items-center gap-2">
                    <FileCode2 className="w-4 h-4 text-[#a1a1aa]" />
                    Create Test Run
                  </h2>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleNewStory}
                      className="text-xs font-semibold px-3 py-1.5 border border-[#27272a] hover:bg-[#27272a] text-[#a1a1aa] rounded-md transition-colors flex items-center gap-2"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      New Story
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowJiraDialog(true)}
                      className="text-xs font-semibold px-3 py-1.5 bg-[#27272a] hover:bg-[#3f3f46] text-[#a1a1aa] rounded-md transition-colors flex items-center gap-2"
                    >
                      <GitBranch className="w-3.5 h-3.5" />
                      Import from Jira
                    </button>
                  </div>
                </div>
                
                <form onSubmit={handleSubmit}>
                  <div className="mb-4">
                    <label className="block text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-widest mb-2">User Story</label>
                    <textarea
                      value={storyInput}
                      onChange={(e) => setStoryInput(e.target.value)}
                      placeholder="As a user, I want to reset my password..."
                      className="w-full h-32 bg-[#0f0f0f] border border-[#27272a] rounded-lg p-4 text-sm text-[#fafafa] placeholder-[#a1a1aa]/50 focus:outline-none focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981] transition-colors resize-none font-mono"
                      disabled={loading || isRunning}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#a1a1aa] font-mono">{storyInput.length} chars</span>
                    <div className="flex items-center gap-5">
                      <label className="flex items-center gap-2.5 cursor-pointer group">
                        <div className="relative flex items-center">
                          <input type="checkbox" className="sr-only" checked={isDemoMode} onChange={() => setIsDemoMode(!isDemoMode)} disabled={loading || isRunning} />
                          <div className={`block w-9 h-5 rounded-full transition-colors ${isDemoMode ? 'bg-[#f59e0b]' : 'bg-[#27272a]'}`}></div>
                          <div className={`absolute left-0.5 top-0.5 bg-[#fafafa] w-4 h-4 rounded-full transition-transform ${isDemoMode ? 'translate-x-4' : ''}`}></div>
                        </div>
                        <span className="text-xs font-semibold uppercase tracking-wider text-[#a1a1aa] group-hover:text-[#fafafa] transition-colors flex items-center gap-1.5"><Activity className="w-3.5 h-3.5" /> Demo Mode</span>
                      </label>
                      {isRunning && (
                        <button
                          type="button"
                          onClick={handleStop}
                          className="bg-[#ef4444]/10 border border-[#ef4444]/20 hover:bg-[#ef4444]/20 text-[#ef4444] text-sm font-medium px-5 py-2 rounded-lg flex items-center gap-2 transition-colors"
                        >
                          <XCircle className="w-4 h-4" /> Stop
                        </button>
                      )}
                      {!isRunning && (
                        <button
                          type="submit"
                          disabled={loading || !storyInput.trim()}
                          className="bg-[#10b981] hover:bg-[#059669] active:bg-[#047857] text-white text-sm font-medium px-5 py-2 rounded-lg flex items-center gap-2 transition-colors disabled:bg-[#27272a] disabled:text-[#a1a1aa] disabled:cursor-not-allowed"
                        >
                          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                          {loading ? 'Running Pipeline' : 'Start Test Run'}
                        </button>
                      )}
                    </div>
                  </div>
                </form>
              </div>
            </section>

            {/* Execution / Result Section */}
            {pipelineVisible && (
              <section className={`bg-[#18181b] border rounded-lg overflow-hidden animate-fade-in transition-all duration-700 ${
                executionMode === 'playwright' ? 'border-[#10b981]/50 shadow-[0_0_25px_rgba(16,185,129,0.05)]' : 'border-[#27272a]'
              }`}>
                <div className="border-b border-[#27272a] px-6 py-3 flex items-center justify-between bg-[#18181b]">
                  <div className="flex items-center gap-4">
                    <h3 className="text-sm font-semibold text-[#fafafa] flex items-center gap-2">
                      <Activity className="w-4 h-4 text-[#a1a1aa]" />
                      Pipeline Execution
                    </h3>
                    {executionMode && (
                      <span className={`px-2.5 py-1 text-[10px] uppercase font-bold tracking-widest rounded-md border flex items-center gap-1.5 ${
                        executionMode === 'playwright' 
                          ? 'bg-[#10b981]/10 text-[#10b981] border-[#10b981]/30 shadow-[0_0_10px_rgba(16,185,129,0.1)]' 
                          : 'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/30'
                      }`}>
                        {executionMode === 'playwright' ? '🟢 Execution Mode: Real (Playwright)' : '🟡 Execution Mode: Simulation'}
                      </span>
                    )}
                    {demoMode !== null && (
                      <span className={`px-2.5 py-1 text-[10px] uppercase font-bold tracking-widest rounded-md border flex items-center gap-1.5 ${
                        demoMode 
                          ? 'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/30' 
                          : 'bg-[#10b981]/10 text-[#10b981] border-[#10b981]/30 shadow-[0_0_10px_rgba(16,185,129,0.1)]'
                      }`}>
                        {demoMode ? '🟡 Demo Mode Enabled' : '🟢 Live Mode (Real Execution)'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {isRunning && (
                      <span className="flex items-center gap-1.5 text-xs font-medium text-[#f59e0b] bg-[#f59e0b]/10 px-2.5 py-1 rounded-md">
                        <Loader2 className="w-3 h-3 animate-spin" /> Running
                      </span>
                    )}
                    {executionResult && (
                      <span className="flex items-center gap-1.5 text-xs font-medium text-[#10b981] bg-[#10b981]/10 px-2.5 py-1 rounded-md">
                        <CheckCircle2 className="w-3 h-3" /> Complete
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-6">
                  {/* Pipeline Steps Horizontal */}
                  <div className="flex items-center justify-between mb-8 px-2">
                    {[
                      { key: 'generation', name: 'AI Test Generation' },
                      { key: 'execution', name: executionMode === 'playwright' ? 'Test Execution (Playwright)' : 'Test Execution' },
                      { key: 'detection', name: 'Failure Detected' },
                      { key: 'analysis', name: 'Failure Analysis' },
                      { key: 'history', name: 'Store Defect History' },
                      { key: 'score', name: 'Update Risk Score' },
                      { key: 'improve', name: 'Improve Future Tests' }
                    ].map((step, idx, arr) => {
                      const stepNumber = idx + 1;
                      const status = pipelineSteps[step.key as keyof typeof pipelineSteps];
                      const isComplete = status === 'completed';
                      const isActive = status === 'running';
                      const isError = status === 'error';
                      
                      return (
                        <React.Fragment key={idx}>
                          <div className="flex flex-col items-center gap-2 relative z-10 w-16 px-1 text-center">
                            <div className={`w-7 h-7 shrink-0 rounded-lg flex items-center justify-center border text-[10px] font-bold transition-all duration-300 ${
                              isComplete && step.key === 'improve' && riskData?.regressionTriggered ? 'bg-[#f59e0b]/20 border-[#f59e0b] text-[#f59e0b] shadow-[0_0_15px_rgba(245,158,11,0.2)]' :
                              isComplete ? 'bg-[#10b981]/10 border-[#10b981] text-[#10b981]' :
                              isActive ? 'bg-[#f59e0b]/10 border-[#f59e0b] text-[#f59e0b] animate-pulse ring-1 ring-[#f59e0b]/50' :
                              isError ? 'bg-[#ef4444]/10 border-[#ef4444] text-[#ef4444] ring-1 ring-[#ef4444]/50' :
                              'bg-[#0f0f0f] border-[#27272a] text-[#6b7280]'
                            }`}>
                              {isActive ? <Loader2 className="w-4 h-4 animate-spin"/> : isComplete ? <Check className="w-4 h-4" /> : isError ? <XCircle className="w-4 h-4" /> : stepNumber}
                            </div>
                            <span className={`text-[9px] font-semibold uppercase tracking-wide leading-tight mt-1 ${
                              isActive ? 'text-[#fafafa]' :
                              isComplete && step.key === 'improve' && riskData?.regressionTriggered ? 'text-[#f59e0b]' :
                              isComplete ? 'text-[#a1a1aa]' :
                              isError ? 'text-[#ef4444]' : 'text-[#6b7280]'
                            }`}>{step.key === 'improve' && riskData?.regressionTriggered && isComplete ? 'Regression Triggered' : step.name}</span>
                          </div>
                          
                          {/* Connector */}
                          {idx < 6 && (
                            <div className={`flex-1 h-[2px] rounded-full mx-1 transition-colors duration-500 ${
                              pipelineSteps[arr[idx + 1].key as keyof typeof pipelineSteps] === 'completed' ? 'bg-[#10b981]' : 
                              pipelineSteps[arr[idx + 1].key as keyof typeof pipelineSteps] === 'running' ? 'bg-[#f59e0b]' : 
                              pipelineSteps[arr[idx + 1].key as keyof typeof pipelineSteps] === 'error' ? 'bg-[#ef4444]' : 
                              'bg-[#27272a]'
                            }`} />
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>

                  {/* AI Risk Analysis Panel */}
                  {riskData && (
                    <div className="mt-6 border border-[#27272a] rounded-lg overflow-hidden bg-[#0f0f0f] animate-fade-in text-sm">
                      <div className="px-4 py-3 border-b border-[#27272a] bg-[#18181b] flex items-center justify-between">
                        <span className="font-semibold text-[#fafafa] flex items-center gap-2">
                          <Activity className="w-4 h-4 text-[#a1a1aa]" />
                          AI Risk Analysis
                        </span>
                      </div>
                      <div className="p-4 flex flex-col gap-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] text-[#a1a1aa] uppercase tracking-widest font-semibold">Module</span>
                            <span className="text-[#fafafa] font-medium">{riskData.module}</span>
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] text-[#a1a1aa] uppercase tracking-widest font-semibold">Risk Level</span>
                            <span className={`font-bold inline-flex items-center gap-1.5 ${
                              riskData.riskLevel === 'HIGH' ? 'text-[#ef4444]' :
                              riskData.riskLevel === 'MEDIUM' ? 'text-[#f59e0b]' :
                              'text-[#10b981]'
                            }`}>
                              {riskData.riskLevel}
                            </span>
                          </div>
                        </div>
                        <div className="pt-4 border-t border-[#27272a]">
                          <span className="text-[10px] text-[#a1a1aa] uppercase tracking-widest font-semibold mb-2 block">Reasons</span>
                          <ul className="space-y-1.5 text-[#e5e7eb] text-sm flex flex-col">
                            {riskData.reasons.map((r, i) => (
                              <li key={i} className="flex gap-2.5 items-start">
                                <span className="text-[#a1a1aa] mt-0.5">•</span>
                                <span>{r}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        
                        {riskData.regressionTriggered && riskData.aiActions && (
                          <div className="pt-4 border-t border-[#27272a] bg-[#f59e0b]/5 -mx-4 -mb-4 p-4 border-b-0 rounded-b-lg">
                            <span className="text-[10px] text-[#f59e0b] uppercase tracking-widest font-semibold mb-2 block flex items-center gap-1.5">
                              <Activity className="w-3 h-3" /> AI Action
                            </span>
                            <ul className="space-y-1.5 text-[#e5e7eb] text-sm flex flex-col">
                              {riskData.aiActions.map((action, i) => (
                                <li key={i} className="flex gap-2.5 items-start">
                                  <span className="text-[#f59e0b] mt-0.5">•</span>
                                  <span>{action}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Collapsible Generated Scenarios section */}
                  {showTestCases && (
                    <div className="mt-6 border border-[#27272a] rounded-lg overflow-hidden bg-[#0f0f0f]">
                      <button 
                        className="w-full px-4 py-3 flex items-center justify-between text-sm font-medium text-[#fafafa] hover:bg-[#18181b] transition-colors focus:outline-none"
                        onClick={() => setTestsExpanded(!testsExpanded)}
                      >
                        <span className="flex items-center gap-2">
                          <ListMinus className="w-4 h-4 text-[#a1a1aa]" />
                          Test Generation Scenarios ({testCases.length})
                        </span>
                        {testsExpanded ? <ChevronDown className="w-4 h-4 text-[#a1a1aa]" /> : <ChevronRight className="w-4 h-4 text-[#a1a1aa]" />}
                      </button>
                      
                      {testsExpanded && (
                        <div className="border-t border-[#27272a] p-4 text-[#fafafa] bg-[#18181b]/50 max-h-96 overflow-y-auto custom-scrollbar">
                          <ul className="space-y-3">
                            {testCases.map((tc, idx) => {
                              const isFailedTest = failureDetails?.status === 'FAILED' && tc === failureDetails?.test;
                              return (
                                <li key={idx} className={`flex gap-3 items-start p-3 rounded-md border ${isFailedTest ? 'bg-[#ef4444]/10 border-[#ef4444]/30' : 'bg-[#0f0f0f] border-[#27272a]'}`}>
                                  <div className={`mt-0.5 flex items-center justify-center w-5 h-5 rounded-full font-semibold text-[10px] shrink-0 ${isFailedTest ? 'bg-[#ef4444]/20 text-[#ef4444]' : 'bg-[#10b981]/10 text-[#10b981]'}`}>
                                    {isFailedTest ? <XCircle className="w-3 h-3" /> : idx + 1}
                                  </div>
                                  <span className={`text-sm leading-relaxed whitespace-pre-wrap break-all ${isFailedTest ? 'text-[#ef4444]' : 'text-[#e5e7eb]'}`}>
                                    {typeof tc === 'string' ? tc : JSON.stringify(tc, null, 2)}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Failure Details Panel */}
                  {failureDetails && (
                    <div className="mt-8 border border-[#27272a] rounded-lg overflow-hidden bg-[#0f0f0f] animate-fade-in text-sm">
                      <div className="px-4 py-3 border-b border-[#27272a] bg-[#18181b] flex items-center justify-between">
                        <span className="font-semibold text-[#fafafa] flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-[#ef4444]" />
                          Failure Analysis
                        </span>
                      </div>
                      <div className="p-4 flex flex-col gap-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] text-[#a1a1aa] uppercase tracking-widest font-semibold flex items-center gap-1.5"><Code2 className="w-3 h-3"/> Test Name</span>
                            <span className="text-[#fafafa] font-medium">{typeof failureDetails.test === 'string' ? failureDetails.test : JSON.stringify(failureDetails.test)}</span>
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] text-[#a1a1aa] uppercase tracking-widest font-semibold flex items-center gap-1.5"><Activity className="w-3 h-3"/> Status</span>
                            <span className="font-bold text-[#ef4444] inline-flex items-center gap-1.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-[#ef4444] animate-pulse"></span>
                              {failureDetails.status}
                            </span>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[#27272a]">
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] text-[#a1a1aa] uppercase tracking-widest font-semibold">Expected</span>
                            <span className="text-[#10b981]">{failureDetails.expected}</span>
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] text-[#a1a1aa] uppercase tracking-widest font-semibold">Actual</span>
                            <span className="text-[#ef4444]">{failureDetails.actual}</span>
                          </div>
                        </div>

                        <div className="pt-4 border-t border-[#27272a] flex flex-col gap-3">
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] text-[#a1a1aa] uppercase tracking-widest font-semibold flex items-center gap-1.5"><AlertCircle className="w-3 h-3"/> Root Cause</span>
                            <span className="text-[#e5e7eb]">{failureDetails.rootCause}</span>
                          </div>
                          
                          <div className="flex flex-col gap-1 p-3 bg-[#10b981]/5 border border-[#10b981]/20 rounded-md">
                            <span className="text-[10px] text-[#10b981] uppercase tracking-widest font-semibold flex items-center gap-1.5"><Lightbulb className="w-3 h-3"/> AI Suggestion</span>
                            <span className="text-[#fafafa] italic">"{failureDetails.suggestion}"</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Final Results Data */}
                  {executionResult && (
                    <div className="mt-8 grid grid-cols-4 gap-4 border-t border-[#27272a] pt-6">
                      <div className="bg-[#0f0f0f] border border-[#27272a] p-4 rounded-lg">
                        <div className="text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-wider mb-1">Generated</div>
                        <div className="text-xl font-semibold text-[#fafafa]">{executionResult.testsGenerated}</div>
                      </div>
                      <div className="bg-[#0f0f0f] border border-[#27272a] p-4 rounded-lg">
                        <div className="text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-wider mb-1">Passed</div>
                        <div className="text-xl font-semibold text-[#10b981]">{executionResult.passed}</div>
                      </div>
                      <div className="bg-[#0f0f0f] border border-[#27272a] p-4 rounded-lg">
                        <div className="text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-wider mb-1">Failed</div>
                        <div className="text-xl font-semibold text-[#ef4444]">{executionResult.failed}</div>
                      </div>
                      <div className="bg-[#0f0f0f] border border-[#27272a] p-4 rounded-lg">
                        <div className="text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-wider mb-1">Time</div>
                        <div className="text-xl font-semibold text-[#fafafa] font-mono">{executionResult.time}</div>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Test Runs History Overview */}
            <section className="bg-[#18181b] border border-[#27272a] rounded-lg overflow-hidden">
               <div className="border-b border-[#27272a] px-6 py-4 flex items-center justify-between">
                 <h3 className="text-lg font-semibold text-[#fafafa] flex items-center gap-2 cursor-pointer hover:text-[#10b981] transition-colors" onClick={() => setActivePage('test-runs')}>
                   <History className="w-4 h-4 text-[#a1a1aa]" />
                   Recent Test Runs
                 </h3>
                 <button 
                   onClick={() => setActivePage('test-runs')}
                   className="text-xs font-semibold text-[#10b981] hover:text-[#059669] transition-colors flex items-center gap-1"
                 >
                   View All <ChevronRight className="w-3.5 h-3.5" />
                 </button>
               </div>
               
               {stories.length === 0 ? (
                 <div className="p-10 text-center bg-[#0f0f0f]">
                   <TerminalSquare className="w-8 h-8 text-[#a1a1aa] mx-auto mb-3 opacity-50" />
                   <p className="text-sm text-[#a1a1aa]">No test runs found. Start a run to see results here.</p>
                 </div>
               ) : (
                 <table className="w-full text-sm text-left align-middle">
                   <thead className="bg-[#0f0f0f] text-[#a1a1aa] text-[11px] uppercase tracking-wider font-semibold border-b border-[#27272a]">
                     <tr>
                       <th className="px-6 py-3 font-medium w-1/2">Request</th>
                       <th className="px-4 py-3 font-medium">Status</th>
                       <th className="px-4 py-3 font-medium">Time</th>
                       <th className="px-4 py-3 text-right"></th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-[#27272a] bg-[#18181b]">
                     {stories.slice(0, 5).map((story) => (
                       <tr 
                         key={story.id} 
                         className="hover:bg-[#27272a]/50 transition-colors group cursor-pointer"
                         onClick={() => {
                           setActivePage('test-runs');
                           setExpandedRun(story.id);
                         }}
                       >
                         <td className="px-6 py-3.5">
                           <div className="flex flex-col gap-1">
                             <span className="font-mono text-[10px] text-[#a1a1aa]">{story.id.split('-')[0]}</span>
                             <span className="text-[#fafafa] truncate max-w-md">{story.story}</span>
                           </div>
                         </td>
                         <td className="px-4 py-3.5">
                            {story.status === 'completed' ? (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#10b981]/10 text-[#10b981] text-[11px] font-medium border border-[#10b981]/20">
                                <CheckCircle2 className="w-3 h-3" /> Passed
                              </span>
                            ) : story.status === 'failed' ? (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#ef4444]/10 text-[#ef4444] text-[11px] font-medium border border-[#ef4444]/20">
                                <XCircle className="w-3 h-3" /> Failed
                              </span>
                            ) : null}
                            {(story.status === 'pending' || story.status === 'running') && (
                             <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#f59e0b]/10 text-[#f59e0b] text-[11px] font-medium border border-[#f59e0b]/20">
                               <Loader2 className="w-3 h-3 animate-spin" /> Running
                             </span>
                           )}
                         </td>
                         <td className="px-4 py-3.5 font-mono text-xs text-[#a1a1aa]">
                           {story.status === 'completed' ? '4.2s' : '-'}
                         </td>
                         <td className="px-4 py-3.5 text-right">
                           <button className="text-[#a1a1aa] hover:text-[#fafafa] transition-colors opacity-0 group-hover:opacity-100">
                             <ChevronRight className="w-4 h-4" />
                           </button>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               )}
            </section>

          </div>
          )}
        </div>
      </main>

      {/* RIGHT ACTIVITY PANEL */}
      <aside className="w-[300px] bg-[#0f0f0f] border-l border-[#27272a] flex flex-col shrink-0">
        <div className="h-14 px-4 border-b border-[#27272a] flex items-center justify-between shrink-0 bg-[#0f0f0f]">
          <span className="font-medium text-[#fafafa] text-sm flex items-center gap-2">
            <TerminalSquare className="w-4 h-4 text-[#a1a1aa]" />
            Agent Logs
          </span>
          <div className="flex items-center gap-2">
            {isRunning && <span className="flex h-1.5 w-1.5 rounded-full bg-[#10b981] animate-pulse"></span>}
            <span className="text-[9px] font-bold text-[#10b981] uppercase tracking-widest">LIVE LOG STREAM</span>
          </div>
        </div>
        
        <div className="flex-1 relative bg-[#0b0b0c] flex flex-col overflow-hidden">
          {/* Subtle vertical scanline effect */}
          <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(90deg,rgba(0,0,0,0)_50%,rgba(0,0,0,0.1)_50%)] bg-[length:4px_100%] z-10 opacity-70"></div>
          
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar font-mono text-[10px] leading-tight relative z-0">
            {logs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-[#a1a1aa]">
                <Code2 className="w-6 h-6 mb-2 opacity-30" />
                <span className="opacity-50">Waiting for execution logs...</span>
              </div>
            ) : (
              <div className="space-y-1">
                {logs.map((log) => (
                  <div key={log.id} className="flex items-start gap-2.5">
                    <span className="text-[#6b7280] shrink-0">[{log.time}]</span>
                    <span className={`flex-1 break-words ${
                      log.type === 'success' ? 'text-emerald-400' :
                      log.type === 'error' ? 'text-red-400' :
                      log.type === 'warning' ? 'text-[#f59e0b]' :
                      'text-gray-400'
                    }`}>
                      {log.type === 'success' && <span className="mr-1.5 font-bold">✓</span>}
                      {log.type === 'error' && <span className="mr-1.5 font-bold">✗</span>}
                      {log.message}
                    </span>
                  </div>
                ))}
                <div ref={logsEndRef} className="h-2" />
              </div>
            )}
          </div>
        </div>
        
        <div className="px-4 py-3 border-t border-[#27272a] bg-[#18181b] flex items-center justify-between text-[10px] uppercase tracking-widest text-[#a1a1aa] font-semibold">
           <span>Status</span>
           {isRunning ? <span className="text-[#f59e0b] flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin"/> Executing</span> : <span>Idle</span>}
        </div>
      </aside>

      {/* JIRA IMPORT DIALOG */}
      {showJiraDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#18181b] border border-[#27272a] rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center gap-2 mb-4">
              <GitBranch className="w-5 h-5 text-[#10b981]" />
              <h3 className="text-lg font-semibold text-[#fafafa]">Import from Jira</h3>
              <button onClick={() => setShowJiraDialog(false)} className="ml-auto text-[#a1a1aa] hover:text-[#fafafa]">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-[#a1a1aa] mb-4">
              Import a user story directly from Jira. Requires JIRA_URL, JIRA_USERNAME, and JIRA_API_TOKEN environment variables.
            </p>
            <form onSubmit={handleJiraImport}>
              <input
                type="text"
                placeholder="e.g., PROJ-123"
                value={jiraInput}
                onChange={(e) => setJiraInput(e.target.value)}
                className="w-full bg-[#0f0f0f] border border-[#27272a] rounded-lg p-3 text-sm text-[#fafafa] placeholder-[#a1a1aa]/50 focus:outline-none focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981] mb-4"
                disabled={jiraLoading}
              />
              <div className="text-xs text-[#a1a1aa] mb-4 bg-[#0f0f0f] border border-[#27272a] rounded p-2">
                💡 Tip: Enter the Jira issue key (e.g., PROJ-123) and the system will load the story for you to review.
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowJiraDialog(false)}
                  className="flex-1 px-4 py-2 bg-[#27272a] hover:bg-[#3f3f46] text-[#fafafa] rounded-lg text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!jiraInput.trim() || jiraLoading}
                  className="flex-1 px-4 py-2 bg-[#10b981] hover:bg-[#059669] text-white rounded-lg text-sm font-medium transition-colors disabled:bg-[#27272a] disabled:text-[#a1a1aa] flex items-center justify-center gap-2"
                >
                  {jiraLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitBranch className="w-4 h-4" />}
                  {jiraLoading ? 'Importing...' : 'Import Story'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REPORT EXPORT DIALOG */}
      {showReportDialog && selectedReportRun && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#18181b] border border-[#27272a] rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center gap-2 mb-4">
              <Download className="w-5 h-5 text-[#10b981]" />
              <h3 className="text-lg font-semibold text-[#fafafa]">Export Test Report</h3>
              <button onClick={() => setShowReportDialog(false)} className="ml-auto text-[#a1a1aa] hover:text-[#fafafa]">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-[#a1a1aa] mb-4">
              Download test results as a comprehensive report.
            </p>
            <div className="space-y-2 mb-4">
              <label className="block text-xs font-semibold text-[#a1a1aa] uppercase">Report Format</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { format: 'json' as const, label: 'JSON', icon: FileJson },
                  { format: 'html' as const, label: 'HTML', icon: FileText },
                  { format: 'csv' as const, label: 'CSV', icon: FileBarChart }
                ].map(({ format, label, icon: Icon }) => (
                  <button
                    key={format}
                    onClick={() => setReportFormat(format)}
                    className={`p-3 rounded-lg border transition-colors flex flex-col items-center gap-1.5 ${
                      reportFormat === format
                        ? 'bg-[#10b981]/20 border-[#10b981]/50 text-[#10b981]'
                        : 'bg-[#0f0f0f] border-[#27272a] text-[#a1a1aa] hover:border-[#3f3f46]'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-xs font-medium">{label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowReportDialog(false)}
                className="flex-1 px-4 py-2 bg-[#27272a] hover:bg-[#3f3f46] text-[#fafafa] rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleExportReport(reportFormat)}
                disabled={reportExporting}
                className="flex-1 px-4 py-2 bg-[#10b981] hover:bg-[#059669] text-white rounded-lg text-sm font-medium transition-colors disabled:bg-[#27272a] disabled:text-[#a1a1aa] flex items-center justify-center gap-2"
              >
                {reportExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {reportExporting ? 'Exporting...' : 'Download Report'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
