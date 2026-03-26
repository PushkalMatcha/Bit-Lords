import os
import json
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

def get_groq_client():
    if not GROQ_API_KEY:
        return None
    try:
        return Groq(api_key=GROQ_API_KEY)
    except Exception as e:
        print(f"Failed to initialize Groq client: {e}")
        return None

def call_llm(prompt: str, temperature: float = 0.7) -> str:
    """
    Calls the Groq chat completion API using llama3-70b-8192.
    Returns the response text safely.
    """
    client = get_groq_client()
    if not client:
        print("Groq Client unavailable. Make sure GROQ_API_KEY is set.")
        return ""
        
    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You are a senior software quality assurance engineer AI. Output ONLY pure valid JSON, absolutely no conversational text or markdown formatting headers."},
                {"role": "user", "content": prompt}
            ],
            temperature=temperature,
        )
        # Return only the response text
        return response.choices[0].message.content or ""
    except Exception as e:
        print(f"LLM Call failed: {e}")
        return ""

def safe_parse(response_text: str, fallback_object: dict) -> dict:
    """
    Safely attempts to parse a string into JSON.
    Returns the fallback_object if parsing fails to prevent backend crashes.
    """
    if not response_text:
        return fallback_object
        
    try:
        # Strip potential markdown codeblocks natively returned by LLMs
        clean_text = response_text.strip()
        if clean_text.startswith("```json"):
            clean_text = clean_text[7:]
        if clean_text.startswith("```"):
            clean_text = clean_text[3:]
        if clean_text.endswith("```"):
            clean_text = clean_text[:-3]
            
        return json.loads(clean_text.strip())
    except json.JSONDecodeError as e:
        print(f"JSON Parsing failed: {e}\\nReceived Text: {response_text}")
        return fallback_object
