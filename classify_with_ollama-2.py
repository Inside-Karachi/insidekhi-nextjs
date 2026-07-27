import csv
import json
import urllib.request
import sys
from ollama_system_prompt import SYSTEM_PROMPT

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL_NAME = "llama3"  # Change to mistral, gemma, phi3, llama3.1 as installed in your local Ollama

def classify_single_listing(row):
    """
    Sends a single listing row to local Ollama instance and returns structured JSON output
    containing primary pair classification, secondary pairs, and full pair score matrix.
    """
    user_content = f"""
    LISTING METADATA:
    - ID: {row.get('id', '')}
    - Name: {row.get('name', '')}
    - Slug: {row.get('slug', '')}
    - Description: {row.get('description', '')}
    - Address: {row.get('address', '')}
    - Attributes / Tags: {row.get('custom_attributes', '')}
    """
    
    payload = {
        "model": MODEL_NAME,
        "prompt": f"{SYSTEM_PROMPT}\n\n{user_content}",
        "format": "json",
        "stream": False
    }
    
    req = urllib.request.Request(
        OLLAMA_URL, 
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    
    try:
        with urllib.request.urlopen(req) as response:
            res_body = json.loads(response.read().decode('utf-8'))
            raw_response = res_body.get('response', '{}')
            return json.loads(raw_response)
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
            "reasoning": f"Local Ollama API call failed: {str(e)}"
        }

def process_csv(input_csv_path, output_csv_path):
    print(f"Reading listings from {input_csv_path}...")
    results = []
    
    with open(input_csv_path, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader, 1):
            name = row.get("name") or ""
            print(f"[{i}] Classifying listing ID {row.get('id')}: {name[:30]}...")
            classified = classify_single_listing(row)
            
            # Format matrix JSON string for clean CSV storage
            all_scores = classified.get('all_pair_scores', {})
            secondary_list = classified.get('secondary_pairs', [])
            
            results.append({
                "id": row.get('id'),
                "name": row.get('name'),
                "primary_pair_id": classified.get('primary_pair_id'),
                "primary_category": classified.get('primary_category'),
                "primary_subcategory": classified.get('primary_subcategory'),
                "primary_relevance_score": classified.get('primary_relevance_score'),
                "flagged": classified.get('flagged'),
                "secondary_pairs": ", ".join(secondary_list) if isinstance(secondary_list, list) else str(secondary_list),
                "all_pair_scores_json": json.dumps(all_scores),
                "reasoning": classified.get('reasoning')
            })
            
    # Save output to CSV
    fieldnames = [
        "id", "name", "primary_pair_id", "primary_category", 
        "primary_subcategory", "primary_relevance_score", "flagged", 
        "secondary_pairs", "all_pair_scores_json", "reasoning"
    ]
    with open(output_csv_path, mode="w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(results)
        
    print(f"Done! Successfully classified and exported to {output_csv_path}")

import sys
from classify_with_llm import process_csv

if __name__ == "__main__":
    input_file = sys.argv[1] if len(sys.argv) > 1 else "/Users/aawaizali/Desktop/insidekhi/data/50-listings.csv"
    output_file = sys.argv[2] if len(sys.argv) > 2 else "/Users/aawaizali/Desktop/insidekhi/data/classified_ollama_output.csv"
    
    # Default to 'openai' or pass provider via CLI
    provider = "openai"
    if "--provider" in sys.argv:
        p_idx = sys.argv.index("--provider")
        if p_idx + 1 < len(sys.argv):
            provider = sys.argv[p_idx + 1]

    key = ""
    if "--key" in sys.argv:
        k_idx = sys.argv.index("--key")
        if k_idx + 1 < len(sys.argv):
            key = sys.argv[k_idx + 1]

    model = ""
    if "--model" in sys.argv:
        m_idx = sys.argv.index("--model")
        if m_idx + 1 < len(sys.argv):
            model = sys.argv[m_idx + 1]

    process_csv(
        input_csv_path=input_file,
        output_csv_path=output_file,
        provider=provider,
        api_key=key,
        model=model,
        endpoint=""
    )