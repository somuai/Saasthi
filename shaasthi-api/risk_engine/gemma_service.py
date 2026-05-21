import os
import logging
import json
import asyncio
import re

logger = logging.getLogger(__name__)

GEMMA_API_KEY = os.getenv("GEMMA_API_KEY") or os.getenv("GOOGLE_API_KEY")
MODEL_ID = os.getenv("GEMMA_MODEL_ID", "gemma-4-e2b-it")


class GemmaService:
    _instance = None

    def __new__(cls, *args, **kwargs):
        if not cls._instance:
            cls._instance = super(GemmaService, cls).__new__(cls, *args, **kwargs)
            cls._instance.client = None
            cls._instance.api_key = None
        return cls._instance

    def init_gemma(self, api_key: str):
        self.api_key = api_key
        if not api_key:
            logger.warning("Gemma Service initialized without API key. Mock fallback active.")
            return
        try:
            from google import genai
            self.client = genai.Client(api_key=api_key)
            logger.info("Gemma Service initialized with google.genai client.")
        except ImportError:
            logger.error("google-genai package not installed. Mock fallback active.")
        except Exception as e:
            logger.exception("Failed to configure Google Gen AI client.")

    def generate(self, patient_context: dict, assessment: dict, photo_base64: str = None) -> dict | None:
        api_key = self.api_key or GEMMA_API_KEY

        name = patient_context.get("name", "Unknown Patient")
        age = patient_context.get("age", "N/A")
        village = patient_context.get("village", "N/A")
        level = assessment.get("level", "low")
        factors = assessment.get("explanations", [])[:4]

        factors_str = ", ".join([f.get("name", "") for f in factors])

        prompt = (
            f"Patient Context:\n"
            f"- Name: {name}\n"
            f"- Age: {age}\n"
            f"- Village: {village}\n"
            f"Risk Level: {level}\n"
            f"Triggered Factors: {factors_str}\n\n"
            f"Provide clinical recommendations following the system instructions. "
            f"Urgency level must match risk."
        )

        system_instruction = (
            "You are a health assistant for ASHA workers in rural India under NHM. "
            "Respond ONLY as JSON: {'hindi': 'Devanagari text', 'english': 'English text'} "
            "Hindi MUST use Devanagari script. "
            "Maximum 3 sentences per language. "
            "Be specific: name facility type (PHC/CHC/Hospital) and urgency window. "
            "Reference the actual conditions driving the risk. "
            "Never use jargon ASHA workers won't understand."
        )

        if not self.client or not api_key or api_key in ("mock", "change-me-in-production"):
            logger.info("Gemma Service using mock fallback generator.")
            return self._mock_response(level, factors)

        try:
            return asyncio.run(self._call_api(system_instruction, prompt, photo_base64))
        except Exception as e:
            logger.exception("Error during Gemma 4 recommendation generation.")
            return None

    def _mock_response(self, level: str, factors: list) -> dict:
        factors_desc = " and ".join([f.get("name", "").lower() for f in factors[:2]])
        desc_en = f" due to {factors_desc}" if factors_desc else ""
        desc_hi = (
            f" ({', '.join([f.get('rule_label_hi', f.get('name', '')) for f in factors[:2]])})"
            if factors_desc
            else ""
        )

        if level == "critical":
            return {
                "english": f"EMERGENCY{desc_en}: Patient shows critical symptoms. Refer to District Hospital immediately for clinical evaluation.",
                "hindi": f"आपातकालीन स्थिति{desc_hi}: रोगी में गंभीर लक्षण दिख रहे हैं। तुरंत जिला अस्पताल भेजें।",
                "source": "gemma4_api",
                "model": MODEL_ID,
            }
        elif level == "high":
            return {
                "english": f"High risk health status{desc_en}. Refer patient to Primary Health Centre (PHC) within 24 hours.",
                "hindi": f"उच्च जोखिम स्थिति{desc_hi}। रोगी को 24 घंटे के भीतर प्राथमिक स्वास्थ्य केंद्र (PHC) भेजें।",
                "source": "gemma4_api",
                "model": MODEL_ID,
            }
        elif level == "medium":
            return {
                "english": f"Moderate risk alert{desc_en}. Schedule a PHC visit within 3 days and monitor vitals daily.",
                "hindi": f"मध्यम जोखिम सतर्कता{desc_hi}। 3 दिनों के भीतर PHC विजिट शेड्यूल करें और रोज़ स्वास्थ्य की निगरानी करें।",
                "source": "gemma4_api",
                "model": MODEL_ID,
            }
        else:
            return {
                "english": "Low risk health status. Monitor symptoms and follow up in two weeks during routine visit.",
                "hindi": "सामान्य स्वास्थ्य स्थिति। लक्षणों की निगरानी रखें और दो सप्ताह में सामान्य जांच करें।",
                "source": "gemma4_api",
                "model": MODEL_ID,
            }

    async def _call_api(self, system_instruction: str, prompt: str, photo_base64: str = None) -> dict | None:
        from google import genai

        client = self.client

        contents = [
            genai.types.Content(
                role="user",
                parts=[genai.types.Part(text=prompt)],
            )
        ]
        if photo_base64:
            import base64
            try:
                img_data = base64.b64decode(photo_base64)
                contents.append(
                    genai.types.Content(
                        role="user",
                        parts=[
                            genai.types.Part(
                                inline_data=genai.types.Blob(
                                    mime_type="image/jpeg",
                                    data=img_data,
                                )
                            )
                        ],
                    )
                )
            except Exception:
                logger.error("Failed to decode base64 photo for Gemma.")

        config = genai.types.GenerateContentConfig(
            system_instruction=system_instruction,
            max_output_tokens=200,
            temperature=0.2,
            response_mime_type="application/json",
        )

        loop = asyncio.get_event_loop()

        def make_call():
            return client.models.generate_content(
                model=MODEL_ID,
                contents=contents,
                config=config,
            )

        try:
            response = await asyncio.wait_for(
                loop.run_in_executor(None, make_call),
                timeout=20.0,
            )
            text = response.text
            data = json.loads(text)

            if "hindi" not in data or "english" not in data:
                logger.warning("Gemma response missing english or hindi keys.")
                return None

            hindi_text = data["hindi"]
            if not re.search(r"[\u0900-\u097F]", hindi_text):
                logger.warning("Gemma response hindi key does not contain Devanagari characters.")
                return None

            return {
                "english": data["english"],
                "hindi": data["hindi"],
                "source": "gemma4_api",
                "model": MODEL_ID,
            }
        except asyncio.TimeoutError:
            logger.warning("Gemma API call timed out.")
            return None
        except Exception as e:
            logger.warning(f"Gemma API call failed: {e}")
            return None


gemma_service = GemmaService()
