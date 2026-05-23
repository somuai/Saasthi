"""ABDM (Ayushman Bharat Digital Mission) integration service.

Provides FHIR R4 patient bundle generation and ABHA number validation.
Full ABDM gateway integration (HIP/HIU) requires additional credentials
and is outside the scope of this service.
"""

import hashlib
import re


def validate_abha(number):
    """Basic ABHA (Health ID) format validation.
    ABHA is a 14-digit or 17-digit identifier.
    """
    if not number:
        return False
    cleaned = re.sub(r"[\s-]", "", number)
    return bool(re.match(r"^\d{14,17}$", cleaned))


def build_fhir_patient_bundle(patient):
    """Generate a FHIR R4 Patient bundle from a Patient instance.

    Returns a dict conforming to the FHIR R4 Patient resource schema.
    """
    names = []
    if patient.full_name:
        names.append(
            {
                "use": "official",
                "text": patient.full_name,
            }
        )
    if patient.name_hi:
        names.append(
            {
                "use": "usual",
                "text": patient.name_hi,
            }
        )

    identifiers = []
    if patient.abha_number:
        identifiers.append(
            {
                "system": "https://abdm.gov.in",
                "value": patient.abha_number,
            }
        )
    if patient.mcts_rch_id:
        identifiers.append(
            {
                "system": "https://mohfw.gov.in/mcts-rch",
                "value": patient.mcts_rch_id,
            }
        )
    if patient.mcp_card_number:
        identifiers.append(
            {
                "system": "https://nhm.gov.in/mcp-card",
                "value": patient.mcp_card_number,
            }
        )

    bundle = {
        "resourceType": "Patient",
        "id": str(patient.local_uuid),
        "identifier": identifiers,
        "name": names,
        "gender": patient.gender if patient.gender != "unknown" else None,
        "birthDate": str(patient.date_of_birth) if patient.date_of_birth else None,
        "active": patient.status == "active",
    }

    telecom = []
    if patient.phone:
        telecom.append({"system": "phone", "value": patient.phone, "use": "mobile"})
    if telecom:
        bundle["telecom"] = telecom

    address = {}
    if patient.village:
        address["city"] = patient.village
    if patient.block:
        address["district"] = patient.block
    if patient.district:
        address["state"] = patient.district
    if address:
        bundle["address"] = [address]

    gp = []
    if patient.asha_worker_id:
        gp.append(
            {
                "reference": f"Practitioner/{patient.asha_worker_id}",
                "display": str(patient.asha_worker),
            }
        )
    if gp:
        bundle["generalPractitioner"] = gp

    extension = []
    if patient.pregnancy_status:
        extension.append(
            {
                "url": "https://abdm.gov.in/StructureDefinition/pregnancy-status",
                "valueBoolean": True,
            }
        )
    if patient.anc_visit_count:
        extension.append(
            {
                "url": "https://abdm.gov.in/StructureDefinition/anc-visit-count",
                "valueInteger": patient.anc_visit_count,
            }
        )
    if patient.lmp_date:
        extension.append(
            {
                "url": "https://abdm.gov.in/StructureDefinition/lmp-date",
                "valueDate": str(patient.lmp_date),
            }
        )
    if patient.edd:
        extension.append(
            {
                "url": "https://abdm.gov.in/StructureDefinition/edd",
                "valueDate": str(patient.edd),
            }
        )
    if extension:
        bundle["extension"] = extension

    return bundle


def patient_hash(patient):
    """Create a content-based hash for the patient FHIR bundle."""
    bundle = build_fhir_patient_bundle(patient)
    raw = str(sorted(bundle.items())).encode()
    return hashlib.sha256(raw).hexdigest()[:16]
