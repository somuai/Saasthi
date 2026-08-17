import json
import os

transcript_path = "/Users/soumyajitghosh/.gemini/antigravity/brain/af68f056-7a50-422a-94a6-fe5e7e05f20c/.system_generated/logs/transcript.jsonl"
output_path = "/Users/soumyajitghosh/Documents/Saasthi/backend/scratch/super_admin_guide.md"

os.makedirs(os.path.dirname(output_path), exist_ok=True)

with open(transcript_path, encoding="utf-8") as f:
    for line in f:
        try:
            data = json.loads(line)
            if data.get("step_index") == 10089:
                content = data.get("content", "")
                # Strip the <USER_REQUEST> tags if present
                if content.startswith("<USER_REQUEST>"):
                    content = content.replace("<USER_REQUEST>", "", 1)
                if content.endswith("</USER_REQUEST>"):
                    content = content.rsplit("</USER_REQUEST>", 1)[0]

                with open(output_path, "w", encoding="utf-8") as out:
                    out.write(content)
                print(f"Successfully wrote guide to {output_path}")
                break
        except Exception:
            pass
