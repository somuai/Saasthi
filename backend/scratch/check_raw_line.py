import json

transcript_path = "/Users/soumyajitghosh/.gemini/antigravity/brain/af68f056-7a50-422a-94a6-fe5e7e05f20c/.system_generated/logs/transcript.jsonl"

with open(transcript_path, encoding="utf-8") as f:
    for line in f:
        try:
            data = json.loads(line)
            if data.get("step_index") == 10089:
                content = data.get("content", "")
                print(f"Content length: {len(content)}")
                if "truncated" in content:
                    print("Yes, 'truncated' is in the content.")
                else:
                    print("No, 'truncated' is not in the content.")
                break
        except Exception:
            pass
