import asyncio
import atexit
import json
import logging
import os
import re

logger = logging.getLogger(__name__)

GEMMA_API_KEY = os.getenv("GEMMA_API_KEY") or os.getenv("GOOGLE_API_KEY")
FIELD_MODEL = os.getenv("MEDGEMMA_FIELD_MODEL", "medgemma-4b-it")
ADMIN_MODEL = os.getenv("MEDGEMMA_ADMIN_MODEL", "medgemma-27b-it")
MODEL_ID = FIELD_MODEL  # Backward compatibility fallback

EN_DISCLAIMER = "\n\nAI recommendations are decision support only. Not a substitute for clinical judgment. All recommendations must be verified by a qualified medical professional."
HI_DISCLAIMER = "\n\nAI পরামর্শগুলি কেবল সিদ্ধান্ত সহায়তার জন্য। এটি ক্লিনিকাল সিদ্ধান্তের বিকল্প নয়। সমস্ত সুপারিশ একজন যোগ্যতাসম্পন্ন চিকিৎসা পেশাদার দ্বারা যাচাই করা উচিত।"


MATERNAL_SYSTEM_PROMPT = """You are a maternal health assistant for ASHA workers
in rural India under the National Health Mission (NHM) and Janani Suraksha Yojana (JSY).

CLINICAL PROTOCOLS TO FOLLOW:
- ANC: Minimum 4 visits, first in 1st trimester
- Danger signs requiring immediate referral: severe anaemia (Hb<7), BP>=160, absent fetal movements, bleeding, eclampsia signs, preterm labour
- Institutional delivery: always preferred, register under JSY
- PMMVY: first live birth, 3 installments
- Pradhan Mantri Surakshit Matritva Abhiyaan: 9th of every month for ANC checkup by doctor

LANGUAGE:
- Respond in BOTH Bengali (Bengali script) and English
- Format: JSON {"bengali": "<Bengali text>", "english": "..."}
- Maximum 3 sentences each
- Use respectful language: "মাকে..." / "গর্ভবতী মহিলাকে..."
- Mention the NEAREST SPECIFIC facility name if the village is provided (e.g., "রামপুর প্রাথমিক স্বাস্থ্য কেন্দ্র", "গোপালপুর উপ-কেন্দ্র")
- Mention SPECIFIC timeline: "২৪ ঘণ্টার মধ্যে" / "আজই"
- For JSY: always remind to bring JSY card to hospital
- NEVER use medical jargon ASHA workers don't know

If photo provided: describe visible signs (pallor, oedema, jaundice, rash)
and factor into recommendation."""

CHILD_SYSTEM_PROMPT = """You are a child health assistant for ASHA workers
in rural India under IMNCI (Integrated Management of Neonatal and Childhood Illness)
and the Universal Immunization Programme (UIP).

CLINICAL PROTOCOLS TO FOLLOW:
- Growth: WHO growth standards, weigh monthly, plot on MCP card
- Malnutrition: SAM (below -3SD or MUAC < 11.5cm) -> NRC; MAM -> RUTF at AWC
- Immunization: UIP schedule BCG through UIP, Vitamin A 9 doses
- Pneumonia: fast breathing thresholds (>60/min <2mo, >50/min 2-12mo, >40/min 1-5yr)
- Diarrhoea: ORS + Zinc 14 days, continue breastfeeding
- Development: warn signs at 3,6,9,12,18,24,36 months -> early intervention

LANGUAGE:
- Respond ONLY as JSON {"bengali": "<Bengali text>", "english": "..."}
- The 'bengali' key MUST contain the translation in Bengali using Bengali script
- Maximum 3 sentences each
- Use "শিশুকে..." / "মাকে শিশুকে..."
- Mention SPECIFIC action: "IFA syrup দিন" / "Penta-2 टीका দিন"
- Mention SPECIFIC facility for SAM: "NRC" / "পুষ্টি পুনর্বাসন কেন্দ্র"
- For missed vaccines: mention VHSND (Village Health Sanitation Nutrition Day)"""

GENERAL_SYSTEM_PROMPT = (
    "You are a health assistant for ASHA workers in rural India under NHM. "
    "Respond ONLY as JSON: {'bengali': 'Bengali text in Bengali script', 'english': 'English text'} "
    "The 'bengali' key MUST contain the translation in Bengali using Bengali script. "
    "Maximum 3 sentences per language. "
    "Be specific: name facility type (PHC/CHC/Hospital) and urgency window. "
    "Reference the actual conditions driving the risk. "
    "Never use jargon ASHA workers don't understand."
)


class GemmaService:
    _instance = None

    def __new__(cls, *args, **kwargs):
        if not cls._instance:
            cls._instance = super().__new__(cls, *args, **kwargs)
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
        except Exception:
            logger.exception("Failed to configure Google Gen AI client.")

    def close(self):
        client = self.client
        self.client = None
        if not client:
            return
        close = getattr(client, "close", None)
        if not close:
            return
        previous_disable_level = logging.root.manager.disable
        try:
            logging.disable(logging.CRITICAL)
            close()
        except Exception:
            logger.debug("Gemma client close failed.", exc_info=True)
        finally:
            logging.disable(previous_disable_level)

    def generate(
        self,
        patient_context: dict,
        assessment: dict,
        photo_base64: str = None,
        population: str = "general",
        clinical_context: dict = None,
        model_id: str = FIELD_MODEL,
    ) -> dict | None:
        api_key = self.api_key or GEMMA_API_KEY

        name = patient_context.get("name", "Unknown Patient")
        age = patient_context.get("age", "N/A")
        village = patient_context.get("village", "N/A")
        level = assessment.get("level", "low")
        factors = assessment.get("explanations", [])[:4]
        triggered_by_hard_flag = assessment.get("triggered_by_hard_flag", False)
        nearest_facility = patient_context.get("nearest_facility", "")
        if not nearest_facility and village:
            try:
                from .models import HealthcareFacility

                facility = (
                    HealthcareFacility.objects.filter(village__iexact=village, is_active=True)
                    .order_by("facility_type")
                    .first()
                )
                if not facility:
                    facility = (
                        HealthcareFacility.objects.filter(block__iexact=village, is_active=True)
                        .order_by("facility_type")
                        .first()
                    )
                if facility:
                    nearest_facility = f"{facility.name} ({facility.get_facility_type_display()})"
                    patient_context["nearest_facility"] = nearest_facility
            except Exception:
                pass

        system_instruction = {
            "maternal": MATERNAL_SYSTEM_PROMPT,
            "child": CHILD_SYSTEM_PROMPT,
            "general": GENERAL_SYSTEM_PROMPT,
        }.get(population, GENERAL_SYSTEM_PROMPT)

        anc_context = ""
        if population == "maternal" and clinical_context:
            anc_context = (
                f"Gestational age: {clinical_context.get('pog_weeks', '?')} weeks\n"
                f"ANC visits done: {clinical_context.get('anc_count', '?')}/4\n"
                f"Haemoglobin: {clinical_context.get('hemoglobin', '?')} g/dL\n"
                f"Blood pressure: {clinical_context.get('bp_sys', '?')}/{clinical_context.get('bp_dia', '?')}\n"
                f"Fetal movements: {clinical_context.get('fetal_movements', '?')}\n"
                f"TT injections: {clinical_context.get('tt_given', '?')}\n"
                f"IFA tablets given: {clinical_context.get('ifa_count', '?')}\n"
            )
        elif population == "child" and clinical_context:
            anc_context = (
                f"Child age: {clinical_context.get('age_months', '?')} months\n"
                f"Weight: {clinical_context.get('weight_kg', '?')} kg\n"
                f"Weight-for-age Z-score: {clinical_context.get('wfa_z', '?')}\n"
                f"Nutritional status: {clinical_context.get('nutritional_status', '?')}\n"
                f"Missed vaccines: {clinical_context.get('missed_vaccines', 0)}\n"
                f"Next due vaccine: {clinical_context.get('next_vaccine', '?')}\n"
                f"MUAC: {clinical_context.get('muac_cm', '?')} cm\n"
            )

        nearest_facility = patient_context.get("nearest_facility", "")
        facility_line = f"Nearest facility: {nearest_facility}\n" if nearest_facility else ""

        prompt = (
            f"Patient: {name}, Age: {age}\n"
            f"Village: {village}\n"
            f"{facility_line}"
            f"{anc_context}"
            f"Risk: {level.upper()} ({assessment.get('normalized_score', '?')}/100)\n"
            f"Emergency flag: {'YES - ' + assessment.get('hard_flag_label', '') if triggered_by_hard_flag else 'No'}\n"
            f"Key factors: {', '.join(f.get('name', '') for f in factors)}\n\n"
            f"Generate the care recommendation JSON."
        )

        if not self.client or not api_key or api_key in ("mock", "change-me-in-production"):
            logger.info("Gemma Service using mock fallback generator.")
            return self._mock_response(level, factors, model_id)

        try:
            return asyncio.run(self._call_api(system_instruction, prompt, photo_base64, model_id))
        except Exception:
            logger.exception("Error during Gemma 4 recommendation generation.")
            return None

    def generate_admin_summary(self, district_data: dict) -> str | None:
        """Generate high-level admin summaries using the 27B clinical reasoning model."""
        if not self.client or not self.api_key or self.api_key in ("mock", "change-me-in-production"):
            return f"Mock Admin Summary for {district_data.get('district', 'District')}: High risk cases showing stabilizing trend. {EN_DISCLAIMER}"

        prompt = (
            f"Provide a senior clinical summary and action items based on the following district health stats:\n"
            f"District: {district_data.get('district', 'N/A')}\n"
            f"Active Beneficiaries: {district_data.get('total_beneficiaries', 0)}\n"
            f"High Risk Cases: {district_data.get('high_risk_cases', 0)}\n"
            f"Open Risk Flags: {district_data.get('open_flags', 0)}\n"
            f"Outbreaks Detected: {len(district_data.get('outbreaks', []))} active clusters.\n"
        )
        try:
            loop = asyncio.get_event_loop()

            def make_call():
                return self.client.models.generate_content(
                    model=ADMIN_MODEL,
                    contents=prompt,
                    config=None,
                )

            response = asyncio.run(loop.run_in_executor(None, make_call))
            return response.text + EN_DISCLAIMER
        except Exception:
            logger.exception("Failed to generate admin summary with MedGemma 27B.")
            return None

    def _mock_response(self, level: str, factors: list, model_id: str) -> dict:
        factors_desc = " and ".join([f.get("name", "").lower() for f in factors[:2]])
        desc_en = f" due to {factors_desc}" if factors_desc else ""
        desc_hi = (
            f" ({', '.join([f.get('rule_label_hi', f.get('name', '')) for f in factors[:2]])})" if factors_desc else ""
        )

        return {
            "critical": {
                "english": f"EMERGENCY{desc_en}: Patient shows critical symptoms. Refer to District Hospital immediately for clinical evaluation.{EN_DISCLAIMER}",
                "hindi": f"জরুরি অবস্থা{desc_hi}: রোগীর গুরুতর লক্ষণ দেখা যাচ্ছে। অবিলম্বে জেলা হাসপাতালে স্থানান্তর করুন।{HI_DISCLAIMER}",
                "source": "gemma4_api",
                "model": model_id,
            },
            "high": {
                "english": f"High risk health status{desc_en}. Refer patient to Primary Health Centre (PHC) within 24 hours.{EN_DISCLAIMER}",
                "hindi": f"উচ্চ ঝুঁকিপূর্ণ অবস্থা{desc_hi}। রোগীকে ২৪ ঘণ্টার মধ্যে প্রাথমিক স্বাস্থ্য কেন্দ্রে (PHC) স্থানান্তর করুন।{HI_DISCLAIMER}",
                "source": "gemma4_api",
                "model": model_id,
            },
            "medium": {
                "english": f"Moderate risk alert{desc_en}. Schedule a PHC visit within 3 days and monitor vitals daily.{EN_DISCLAIMER}",
                "hindi": f"মাঝারি ঝুঁকির সতর্কতা{desc_hi}। ৩ দিনের মধ্যে PHC ভিজিট নির্ধারণ করুন এবং প্রতিদিন স্বাস্থ্য পর্যবেক্ষণ করুন।{HI_DISCLAIMER}",
                "source": "gemma4_api",
                "model": model_id,
            },
        }.get(
            level,
            {
                "english": f"Low risk health status. Monitor symptoms and follow up in two weeks during routine visit.{EN_DISCLAIMER}",
                "hindi": f"স্বাভাবিক স্বাস্থ্য অবস্থা। লক্ষণগুলি পর্যবেক্ষণ করুন এবং দুই সপ্তাহের মধ্যে নিয়মিত পরীক্ষা করুন।{HI_DISCLAIMER}",
                "source": "gemma4_api",
                "model": model_id,
            },
        )

    async def _call_api(
        self, system_instruction: str, prompt: str, photo_base64: str = None, model_id: str = FIELD_MODEL
    ) -> dict | None:
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
            max_output_tokens=2048,
            temperature=0.2,
            response_mime_type="application/json",
        )

        loop = asyncio.get_event_loop()

        def make_call():
            return client.models.generate_content(
                model=model_id,
                contents=contents,
                config=config,
            )

        try:
            response = await asyncio.wait_for(
                loop.run_in_executor(None, make_call),
                timeout=60.0,
            )
            text = response.text
            data = json.loads(text)

            if "english" not in data:
                logger.warning("Gemma response missing english key.")
                return None

            if "bengali" in data and "hindi" not in data:
                data["hindi"] = data["bengali"]

            if "hindi" not in data:
                logger.warning("Gemma response missing hindi or bengali keys.")
                return None

            hindi_text = data["hindi"]
            if not re.search(r"[\u0980-\u09FF]", hindi_text):
                logger.warning("Gemma response hindi/bengali key does not contain Bengali characters.")
                return None

            return {
                "english": data["english"] + EN_DISCLAIMER,
                "hindi": data["hindi"] + HI_DISCLAIMER,
                "source": "gemma4_api",
                "model": model_id,
            }
        except TimeoutError:
            logger.warning("Gemma API call timed out.")
            return None
        except Exception as e:
            logger.warning(f"Gemma API call failed: {e}")
            return None


gemma_service = GemmaService()
atexit.register(gemma_service.close)
