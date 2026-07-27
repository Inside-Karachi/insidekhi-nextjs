import csv
import json
import os
import sys
import urllib.request
import urllib.error
import argparse
from typing import Dict, Any

# Try importing SYSTEM_PROMPT from local module, fallback if defined inline
try:
    from ollama_system_prompt import SYSTEM_PROMPT
except ImportError:
    SYSTEM_PROMPT = """
You are an expert taxonomy and classification AI for Inside Karachi (insidekhi), a local business directory platform in Karachi, Pakistan.
Analyze listing metadata (Name, Slug, Description, Address, Custom Attributes/Tags) and classify into official Inside Karachi taxonomy.
Return ONLY valid JSON.
"""

def clean_json_response(raw_text: str) -> str:
    """Removes markdown code fences and whitespace from LLM output."""
    raw = raw_text.strip()
    if raw.startswith("```json"):
        raw = raw[7:]
    elif raw.startswith("```"):
        raw = raw[3:]
    if raw.endswith("```"):
        raw = raw[:-3]
    return raw.strip()

def call_openai_compatible_api(endpoint: str, api_key: str, model: str, system_prompt: str, user_prompt: str) -> str:
    """Calls OpenAI-compatible endpoints (OpenAI, OpenRouter, Groq)."""
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    payload = {
        "model": model,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "temperature": 0.1
    }
    req = urllib.request.Request(endpoint, data=json.dumps(payload).encode('utf-8'), headers=headers)
    with urllib.request.urlopen(req, timeout=60) as resp:
        res_data = json.loads(resp.read().decode('utf-8'))
        return res_data['choices'][0]['message']['content']

def call_gemini_api(api_key: str, model: str, system_prompt: str, user_prompt: str) -> str:
    """Calls Google Gemini API generateContent endpoint."""
    endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    headers = {"Content-Type": "application/json"}
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": f"{system_prompt}\n\nUser Input:\n{user_prompt}"}
                ]
            }
        ],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.1
        }
    }
    req = urllib.request.Request(endpoint, data=json.dumps(payload).encode('utf-8'), headers=headers)
    with urllib.request.urlopen(req, timeout=60) as resp:
        res_data = json.loads(resp.read().decode('utf-8'))
        return res_data['candidates'][0]['content']['parts'][0]['text']

def call_ollama_api(endpoint: str, model: str, system_prompt: str, user_prompt: str) -> str:
    """Calls local Ollama API."""
    headers = {"Content-Type": "application/json"}
    payload = {
        "model": model,
        "prompt": f"{system_prompt}\n\n{user_prompt}",
        "format": "json",
        "stream": False
    }
    req = urllib.request.Request(endpoint, data=json.dumps(payload).encode('utf-8'), headers=headers)
    with urllib.request.urlopen(req, timeout=60) as resp:
        res_data = json.loads(resp.read().decode('utf-8'))
        return res_data.get('response', '{}')

def classify_single_listing(row: Dict[str, Any], provider: str, api_key: str, model: str, endpoint: str) -> Dict[str, Any]:
    """Sends a listing to the chosen LLM provider and parses the JSON response."""
    user_content = f"""
LISTING METADATA:
- ID: {row.get('id', '')}
- Name: {row.get('name', '')}
- Slug: {row.get('slug', '')}
- Description: {row.get('description', '')}
- Address: {row.get('address', '')}
- Attributes / Tags: {row.get('custom_attributes', '') or row.get('peekaboo_tags', '')}
"""
    try:
        if provider == "openai":
            raw_res = call_openai_compatible_api(
                endpoint or "https://api.openai.com/v1/chat/completions",
                api_key or os.getenv("OPENAI_API_KEY", ""),
                model or "gpt-4o-mini",
                SYSTEM_PROMPT,
                user_content
            )
        elif provider == "openrouter":
            raw_res = call_openai_compatible_api(
                endpoint or "https://openrouter.ai/api/v1/chat/completions",
                api_key or os.getenv("OPENROUTER_API_KEY", ""),
                model or "openai/gpt-4o-mini",
                SYSTEM_PROMPT,
                user_content
            )
        elif provider == "groq":
            raw_res = call_openai_compatible_api(
                endpoint or "https://api.groq.com/openai/v1/chat/completions",
                api_key or os.getenv("GROQ_API_KEY", ""),
                model or "llama-3.1-70b-versatile",
                SYSTEM_PROMPT,
                user_content
            )
        elif provider == "gemini":
            raw_res = call_gemini_api(
                api_key or os.getenv("GEMINI_API_KEY", ""),
                model or "gemini-1.5-flash",
                SYSTEM_PROMPT,
                user_content
            )
        elif provider == "ollama":
            raw_res = call_ollama_api(
                endpoint or "http://localhost:11434/api/generate",
                model or "llama3",
                SYSTEM_PROMPT,
                user_content
            )
        else:
            raise ValueError(f"Unsupported provider: {provider}")

        cleaned = clean_json_response(raw_res)
        return json.loads(cleaned)

    except Exception as e:
        return {
            "listing_id": row.get('id', ''),
            "primary_pair_id": "FLAGGED_ERROR",
            "primary_category": "Uncategorized",
            "primary_subcategory": "Uncategorized",
            "primary_relevance_score": 0.0,
            "flagged": True,
            "secondary_pairs": [],
            "all_pair_scores": {},
            "reasoning": f"LLM API Call Failed ({provider}): {str(e)}"
        }

def process_csv(input_csv_path: str, output_csv_path: str, provider: str, api_key: str, model: str, endpoint: str):
    print(f"Reading listings from {input_csv_path}...")
    results = []

    if not os.path.exists(input_csv_path):
        print(f"Error: Input file does not exist: {input_csv_path}")
        sys.exit(1)

    with open(input_csv_path, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    print(f"Total rows to classify: {len(rows)}")

    for i, row in enumerate(rows, 1):
        name = row.get("name") or ""
        listing_id = row.get("id") or i
        print(f"[{i}/{len(rows)}] Classifying listing ID {listing_id}: {name[:40]}...")

        classified = classify_single_listing(row, provider, api_key, model, endpoint)

        all_scores = classified.get('all_pair_scores', {})
        secondary_list = classified.get('secondary_pairs', [])

        results.append({
            "id": row.get('id', listing_id),
            "name": row.get('name', ''),
            "primary_pair_id": classified.get('primary_pair_id', ''),
            "primary_category": classified.get('primary_category', ''),
            "primary_subcategory": classified.get('primary_subcategory', ''),
            "primary_relevance_score": classified.get('primary_relevance_score', 0.0),
            "flagged": classified.get('flagged', False),
            "secondary_pairs": ", ".join(secondary_list) if isinstance(secondary_list, list) else str(secondary_list),
            "all_pair_scores_json": json.dumps(all_scores),
            "reasoning": classified.get('reasoning', '')
        })

    # Prepare output directory if it doesn't exist
    os.makedirs(os.path.dirname(os.path.abspath(output_csv_path)), exist_ok=True)

    fieldnames = [
        "id", "name", "primary_pair_id", "primary_category", 
        "primary_subcategory", "primary_relevance_score", "flagged", 
        "secondary_pairs", "all_pair_scores_json", "reasoning"
    ]
    with open(output_csv_path, mode="w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(results)

    print(f"\nDone! Successfully classified {len(results)} listings and exported strictly to CSV at: {output_csv_path}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Classify Inside Karachi listings using Cloud or Local LLMs.")
    parser.add_argument("input_csv", nargs="?", help="Path to input listing CSV file")
    parser.add_argument("output_csv", nargs="?", help="Path to output classified CSV file")
    parser.add_argument("--provider", choices=["openai", "gemini", "openrouter", "groq", "ollama"], default="openai", help="LLM Provider")
    parser.add_argument("--key", help="API Key for the chosen provider")
    parser.add_argument("--model", help="Model name (e.g. gpt-4o-mini, gemini-1.5-flash)")
    parser.add_argument("--endpoint", help="Custom API endpoint URL")

    args = parser.parse_args()

    input_file = args.input_csv or "/Users/aawaizali/Desktop/insidekhi/data/50-listings.csv"
    output_file = args.output_csv or "/Users/aawaizali/Desktop/insidekhi/data/classified_llm_output.csv"

    process_csv(
        input_csv_path=input_file,
        output_csv_path=output_file,
        provider=args.provider,
        api_key=args.key or "",
        model=args.model or "",
        endpoint=args.endpoint or ""
    )
