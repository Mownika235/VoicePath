
from fastapi import FastAPI
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from pathlib import Path
import json

app = FastAPI(
    title="VoicePath",
    description="Voice-based Government Benefits Navigator for India",
    version="1.0.0"
)

# Load government schemes
SCHEME_FILE = Path(__file__).parent / "schemes.json"

with open(SCHEME_FILE, "r", encoding="utf-8") as file:
    schemes = json.load(file)

# Frontend files
@app.get("/")
def home():
    return FileResponse(Path(__file__).parent / "index.html")

@app.get("/style.css")
def get_css():
    return FileResponse(Path(__file__).parent / "style.css")

@app.get("/script.js")
def get_js():
    return FileResponse(Path(__file__).parent / "script.js")

# Health check
@app.get("/health")
def health():
    return {"status": "healthy"}

# User profile
class UserProfile(BaseModel):
    age: int = Field(ge=0, le=120)
    state: str = Field(min_length=2, max_length=50)
    disability_category: str
    disability_percentage: int | None = Field(
        default=None, ge=0, le=100
    )
    certificate_available: bool
    udid_available: bool | None = None
    support_needed: str
    is_student: bool | None = None

# Receive user profile
@app.post("/profile")
def create_profile(profile: UserProfile):
    return {
        "message": "Profile received successfully",
        "profile": profile.model_dump(),
        "note": "This is not a final government eligibility decision."
    }

# Get all schemes
@app.get("/schemes")
def get_schemes():
    return {
        "total_schemes": len(schemes),
        "schemes": schemes,
        "note": "Verify current eligibility and application details with official sources."
    }

# Match support category
def get_requested_categories(support):
    support = support.lower().strip()
    categories = []

    if "education" in support or "scholarship" in support:
        categories.append("education")

    if "assistive" in support or "device" in support:
        categories.append("assistive_devices")

    return categories

# Find matching benefits
@app.post("/find-benefits")
def find_benefits(profile: UserProfile):

    results = []

    requested_categories = get_requested_categories(
        profile.support_needed
    )

    if not requested_categories:
        return {
            "message": "Please select a supported benefit category.",
            "total_matches": 0,
            "results": [],
            "important_note": "Try education scholarship or assistive devices."
        }

    for scheme in schemes:

        scheme_category = str(
            scheme.get("category", "")
        ).lower().strip()

        if scheme_category not in requested_categories:
            continue

        # Read scheme name using either supported key
        scheme_name = (
            scheme.get("scheme_name")
            or scheme.get("name")
            or "Unnamed scheme"
        )

        reasons = []
        missing = []

        # Check minimum disability percentage
        minimum = scheme.get("minimum_disability_percentage")

        if minimum is not None:
            if profile.disability_percentage is None:
                missing.append("Disability percentage")
            elif profile.disability_percentage < minimum:
                continue
            else:
                reasons.append(
                    "Your disability percentage meets the listed minimum."
                )

        # Check disability certificate
        if profile.certificate_available:
            reasons.append("Disability certificate is available.")
        else:
            missing.append("Disability certificate")

        # Check UDID requirement
        if scheme.get("requires_udid", False):
            if profile.udid_available is None:
                missing.append("UDID card status")
            elif profile.udid_available:
                reasons.append("UDID card is available.")
            else:
                missing.append("UDID card is not available.")

        # Check student requirement
        # The scholarship title also identifies it as student-specific.
        requires_student = scheme.get(
            "requires_student",
            "student" in scheme_name.lower()
        )

        if requires_student:
            if profile.is_student is None:
                missing.append("Student status")
            elif profile.is_student is False:
                continue
            else:
                reasons.append(
                    "You confirmed that you are a student."
                )

        # Preliminary matching status
        if missing:
            status = "needs_more_information"
        else:
            status = "potential_match"

        results.append({
            "scheme_name": scheme_name,
            "category": scheme_category,
            "status": status,
            "reasons": reasons,
            "missing_information": missing,
            "official_source": scheme.get("official_source"),
            "application_portal": scheme.get("application_portal")
        })

    return {
        "message": "Preliminary scheme matching completed",
        "total_matches": len(results),
        "results": results,
        "important_note": (
            "These are preliminary matches, not official eligibility "
            "decisions. Other conditions such as income, course, "
            "institution and application dates may also apply. "
            "Verify all requirements with the official department."
        )
    }