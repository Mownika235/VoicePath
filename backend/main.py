
from fastapi import FastAPI
from pydantic import BaseModel, Field
from pathlib import Path
import json

app = FastAPI(title="VoicePath")

# Load scheme data
SCHEME_FILE = Path(__file__).parent / "schemes.json"

with open(SCHEME_FILE, "r", encoding="utf-8") as file:
    schemes = json.load(file)

# User profile
class UserProfile(BaseModel):
    age: int = Field(ge=0, le=120)
    state: str
    disability_category: str
    disability_percentage: int | None = Field(
        default=None, ge=0, le=100
    )
    certificate_available: bool
    udid_available: bool | None = None
    monthly_income: int | None = Field(default=None, ge=0)
    annual_family_income: int | None = Field(default=None, ge=0)
    is_post_matric_student: bool | None = None
    received_assistance_last_3_years: bool | None = None
    support_needed: str

# Home API
@app.get("/")
def home():
    return {
        "message": "Welcome to VoicePath!",
        "status": "Backend is running"
    }

# Health API
@app.get("/health")
def health():
    return {"status": "healthy"}

# Profile API
@app.post("/profile")
def create_profile(profile: UserProfile):
    return {
        "message": "Profile received successfully",
        "profile": profile
    }

# Eligibility matching function
def check_eligibility(profile, scheme):

    reasons = []
    missing = []

    percentage = profile.disability_percentage
    minimum = scheme["minimum_disability_percentage"]

    # Check disability percentage
    if percentage is None:
        missing.append("Disability percentage")
    elif percentage < minimum:
        reasons.append(
            f"Disability percentage must be at least {minimum}%"
        )

    # Check disability certificate
    if not profile.certificate_available:
        missing.append("Disability certificate")

    # Check UDID
    if scheme.get("requires_udid"):
        if profile.udid_available is not True:
            missing.append("UDID card or enrolment number")

    # ADIP checks
    if scheme["category"] == "assistive_devices":

        income = profile.monthly_income
        limit = scheme["income_limit_monthly"]

        if income is None:
            missing.append("Monthly income")
        elif income > limit:
            reasons.append(
                f"Monthly income exceeds the scheme limit of Rs. {limit}"
            )

        if profile.received_assistance_last_3_years is None:
            missing.append(
                "Whether assistance for the same purpose was received in the last 3 years"
            )
        elif profile.received_assistance_last_3_years:
            reasons.append(
                "Previous assistance for the same purpose may affect eligibility"
            )

        support = profile.support_needed.lower()

        if not any(word in support for word in [
            "assistive", "wheelchair", "hearing",
            "device", "mobility", "equipment"
        ]):
            reasons.append(
                "The stated support need does not match assistive devices"
            )

    # Scholarship checks
    if scheme["category"] == "education":

        income = profile.annual_family_income
        limit = scheme["income_limit_annual"]

        if income is None:
            missing.append("Annual family income")
        elif income > limit:
            reasons.append(
                f"Annual family income exceeds Rs. {limit}"
            )

        if profile.is_post_matric_student is None:
            missing.append("Student and course details")
        elif not profile.is_post_matric_student:
            reasons.append(
                "Post-matric student status is required"
            )

        support = profile.support_needed.lower()

        if not any(word in support for word in [
            "education", "scholarship", "study", "college"
        ]):
            reasons.append(
                "The stated support need does not match education"
            )

    # Decide result status
    if reasons:
        status = "not_matched"
    elif missing:
        status = "needs_more_information"
    else:
        status = "potential_match"

    return {
        "scheme_name": scheme["name"],
        "status": status,
        "reasons": reasons,
        "missing_information": missing,
        "official_source": scheme["official_source"],
        "application_portal": scheme["application_portal"]
    }

# Eligibility API
@app.post("/find-benefits")
def find_benefits(profile: UserProfile):

    results = []

    for scheme in schemes:
        result = check_eligibility(profile, scheme)
        results.append(result)

    return {
        "message": "Potential scheme matching completed",
        "results": results,
        "important_note": (
            "These are preliminary matches, not official eligibility "
            "decisions. Verify all requirements with the official authority."
        )
    }