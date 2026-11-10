
// VOICEPATH - Voice-first Government Benefits Navigator

const startVoiceBtn = document.getElementById("startVoiceBtn");
const stopVoiceBtn = document.getElementById("stopVoiceBtn");
const voiceLanguage = document.getElementById("voiceLanguage");
const voiceStatus = document.getElementById("voiceStatus");
const voiceTranscript = document.getElementById("voiceTranscript");
const results = document.getElementById("results");

const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

let recognition = null;
let currentStep = 0;
let currentAnswer = "";
let isRunning = false;
let isListening = false;
let answerHandled = false;
let retryCount = 0;
let startTimer = null;

const profile = {
    age: null,
    state: "",
    disability_category: "",
    disability_percentage: null,
    certificate_available: null,
    udid_available: null,
    support_needed: "",
    is_student: null
};

const questions = {
    "en-IN": [
        "What is your age? Please say the number.",
        "Which state do you live in?",
        "What is your disability category? For example, visual, hearing, or locomotor.",
        "What is your disability percentage? Please say the number.",
        "Do you have a disability certificate? Say yes or no.",
        "Do you have a UDID card? Say yes or no.",
        "What support do you need? Say education scholarship or assistive devices.",
        "Are you currently a student? Say yes or no."
    ],

    "ta-IN": [
        "உங்கள் வயது என்ன? எண்ணாகச் சொல்லுங்கள்.",
        "நீங்கள் எந்த மாநிலத்தில் வசிக்கிறீர்கள்?",
        "உங்கள் மாற்றுத்திறன் வகை என்ன? பார்வை, செவித்திறன் அல்லது உடல் இயக்கம் என்று சொல்லலாம்.",
        "உங்கள் மாற்றுத்திறன் சதவீதம் எவ்வளவு? எண்ணாகச் சொல்லுங்கள்.",
        "உங்களிடம் மாற்றுத்திறனாளர் சான்றிதழ் உள்ளதா? ஆம் அல்லது இல்லை என்று சொல்லுங்கள்.",
        "உங்களிடம் UDID அட்டை உள்ளதா? ஆம் அல்லது இல்லை என்று சொல்லுங்கள்.",
        "உங்களுக்கு என்ன உதவி தேவை? கல்வி உதவித்தொகை அல்லது உதவி உபகரணங்கள் என்று சொல்லுங்கள்.",
        "நீங்கள் தற்போது மாணவரா? ஆம் அல்லது இல்லை என்று சொல்லுங்கள்."
    ],

    "ar-AE": [
        "كم عمرك؟ يرجى قول الرقم.",
        "في أي إمارة أو منطقة تسكن؟",
        "ما نوع الإعاقة؟ بصرية أو سمعية أو حركية؟",
        "ما نسبة الإعاقة؟ يرجى قول الرقم.",
        "هل لديك شهادة إعاقة؟ قل نعم أو لا.",
        "هل لديك بطاقة هوية لأصحاب الهمم؟ قل نعم أو لا.",
        "ما نوع الدعم الذي تحتاجه؟ دعم تعليمي أم أجهزة مساعدة؟",
        "هل أنت طالب حاليا؟ قل نعم أو لا."
    ]
};

function isTamil() {
    return voiceLanguage.value === "ta-IN";
}

function isArabic() {
    return voiceLanguage.value === "ar-AE";
}

function showStatus(message) {
    voiceStatus.textContent = message;
}

function speak(message, callback) {
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(message);

    utterance.lang = voiceLanguage.value;
    utterance.rate = 0.9;

    utterance.onend = function () {
        if (callback && isRunning) {
            callback();
        }
    };

    utterance.onerror = function () {
        if (callback && isRunning) {
            callback();
        }
    };

    window.speechSynthesis.speak(utterance);
}

function getYesNo(text) {
    const value = text.toLowerCase().trim();

    if (
        /yes|yeah|yep|ஆம்|ஆமாம்|ஆமா|உண்டு|இருக்கு|உள்ளது|نعم|أجل|أيوه|ايوه/i.test(value)
    ) {
        return true;
    }

    if (
        /no|nope|இல்லை|இல்ல|கிடையாது|لا|كلا/i.test(value)
    ) {
        return false;
    }

    return null;
}

function getNumber(text) {
    let value = text.trim();

    // Convert Arabic-Indic digits to English digits
    value = value.replace(/[٠-٩]/g, digit =>
        "٠١٢٣٤٥٦٧٨٩".indexOf(digit)
    );

    // Convert common spoken number words
    const numberWords = {
        "zero": 0, "one": 1, "two": 2, "three": 3,
        "four": 4, "five": 5, "six": 6, "seven": 7,
        "eight": 8, "nine": 9, "ten": 10,
        "zero ": 0,
        "ஒன்று": 1, "ஒரு": 1, "இரண்டு": 2,
        "மூன்று": 3, "நான்கு": 4, "ஐந்து": 5,
        "ஆறு": 6, "ஏழு": 7, "எட்டு": 8,
        "ஒன்பது": 9, "பத்து": 10,
        "واحد": 1, "واحدة": 1, "اثنان": 2,
        "اثنين": 2, "ثلاثة": 3, "أربعة": 4,
        "خمسة": 5, "ستة": 6, "سبعة": 7,
        "ثمانية": 8, "تسعة": 9, "عشرة": 10,
        "عشرون": 20, "ثلاثون": 30, "أربعون": 40,
        "خمسون": 50, "ستون": 60, "سبعون": 70,
        "ثمانون": 80, "تسعون": 90,
        "عشر": 10, "عشرين": 20, "ثلاثين": 30,
        "أربعين": 40, "خمسين": 50
    };

    const match = value.match(/\d+/);

    if (match) {
        return Number(match[0]);
    }

    const word = value.toLowerCase().trim();

    if (Object.prototype.hasOwnProperty.call(numberWords, word)) {
        return numberWords[word];
    }

    return null;
}

function askQuestion() {
    if (!isRunning) return;

    if (currentStep >= questions[voiceLanguage.value].length) {
        finishVoiceProfile();
        return;
    }

    const question = questions[voiceLanguage.value][currentStep];

    showStatus(question);
    speak(question, startListening);
}

function startListening() {
    if (!isRunning || !recognition) return;

    // Prevent starting an already active recognition session
    if (isListening) return;

    clearTimeout(startTimer);

    currentAnswer = "";
    answerHandled = false;

    showStatus(
        isTamil()
            ? "🎤 கேட்கிறது... இப்போது பதில் சொல்லுங்கள்."
            : isArabic()
                ? "🎤 أنا أستمع... يرجى التحدث الآن."
                : "🎤 Listening... Please speak now."
    );

    startTimer = setTimeout(function () {
        if (!isRunning || isListening) return;

        try {
            recognition.lang = voiceLanguage.value;
            recognition.start();
        } catch (error) {
            console.log("Recognition start error:", error);

            if (error.name === "InvalidStateError") {
                showStatus("Microphone is restarting. Please wait...");
            } else {
                showStatus("Unable to start microphone. Please try again.");
            }
        }
    }, 500);
}

function saveAnswer(answer) {
    const value = answer.trim().toLowerCase();

    switch (currentStep) {
        case 0: {
            const age = getNumber(value);

            if (age === null || age < 0 || age > 120) {
                return false;
            }

            profile.age = age;
            break;
        }

        case 1:
            profile.state = answer.trim();

            if (profile.state.length < 2) return false;
            break;

        case 2:
            if (/visual|blind|பார்வை|بصرية|نظر|رؤية/i.test(value)) {
                profile.disability_category = "visual";
            } else if (/hearing|deaf|செவித்|கேள்வி|سمعية|سمع/i.test(value)) {
                profile.disability_category = "hearing";
            } else if (/locomotor|physical|உடல்|இயக்கம்|حركية|جسدية/i.test(value)) {
                profile.disability_category = "locomotor";
            } else {
                profile.disability_category = answer.trim();
            }
            break;

        case 3: {
            const percentage = getNumber(value);

            if (
                percentage === null ||
                percentage < 0 ||
                percentage > 100
            ) {
                return false;
            }

            profile.disability_percentage = percentage;
            break;
        }

        case 4: {
            const answerValue = getYesNo(value);

            if (answerValue === null) return false;

            profile.certificate_available = answerValue;
            break;
        }

        case 5: {
            const answerValue = getYesNo(value);

            if (answerValue === null) return false;

            profile.udid_available = answerValue;
            break;
        }

        case 6:
            if (
                /assistive|device|wheelchair|hearing aid|உபகரண|கருவி|சக்கர நாற்காலி|أجهزة مساعدة|كرسي متحرك/i.test(value)
            ) {
                profile.support_needed = "assistive_devices";
            } else if (
                /education|scholarship|study|கல்வி|உதவித்தொகை|படிப்பு|تعليم|منحة|دراسة/i.test(value)
            ) {
                profile.support_needed = "education";
            } else {
                return false;
            }
            break;

        case 7: {
            const answerValue = getYesNo(value);

            if (answerValue === null) return false;

            profile.is_student = answerValue;
            break;
        }
    }

    return true;
}

function handleAnswer(answer) {
    if (answerHandled || !isRunning) return;

    answerHandled = true;
    retryCount = 0;

    const accepted = saveAnswer(answer);

    if (!accepted) {
        answerHandled = false;

        const retryMessage = isTamil()
            ? "மன்னிக்கவும். பதிலை மீண்டும் தெளிவாகச் சொல்லுங்கள்."
            : isArabic()
                ? "عذرا، لم أفهم إجابتك. يرجى المحاولة مرة أخرى."
                : "Sorry, I couldn't understand that answer. Please say it again.";

        showStatus(retryMessage);
        speak(retryMessage, startListening);
        return;
    }

    voiceTranscript.textContent =
        (voiceTranscript.textContent
            ? voiceTranscript.textContent + "\n"
            : "") +
        (currentStep + 1) + ". " + answer;

    currentStep++;

    if (currentStep < questions[voiceLanguage.value].length) {
        setTimeout(askQuestion, 400);
    } else {
        finishVoiceProfile();
    }
}

function finishVoiceProfile() {
    if (!isRunning) return;

    isRunning = false;
    answerHandled = true;

    clearTimeout(startTimer);

    if (recognition && isListening) {
        try {
            recognition.stop();
        } catch (error) {
            console.log(error);
        }
    }

    window.speechSynthesis.cancel();

    startVoiceBtn.disabled = false;
    stopVoiceBtn.disabled = true;
    voiceLanguage.disabled = false;

    const message = isTamil()
        ? "நன்றி. உங்கள் விவரங்களுக்கு பொருத்தமான திட்டங்களை சரிபார்க்கிறோம்."
        : isArabic()
            ? "شكرا لك. نحن نتحقق من البرامج التي قد تناسب معلوماتك."
            : "Thank you. We are checking schemes that may match your details.";

    showStatus("All 8 answers collected. Checking matching benefits...");

    speak(message);

    findBenefits();
}

function addText(parent, tag, text) {
    const element = document.createElement(tag);
    element.textContent = text;
    parent.appendChild(element);
    return element;
}

async function findBenefits() {
    results.textContent = "Checking schemes...";

    try {
        const response = await fetch("/find-benefits", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(profile)
        });

        const data = await response.json();

        if (!response.ok) {
            const detail = typeof data.detail === "string"
                ? data.detail
                : JSON.stringify(data.detail || data);

            throw new Error(detail);
        }

        results.textContent = "";

        addText(results, "h2", "Your Potential Government Benefits");

        addText(
            results,
            "p",
            "Number of possible matches: " + (data.total_matches ?? 0)
        );

        if (!Array.isArray(data.results) || data.results.length === 0) {
            addText(
                results,
                "p",
                "No matching schemes were found in the current database. Please check your answers or try again later."
            );
        } else {
            data.results.forEach(function (scheme) {
                const card = document.createElement("article");
                card.className = "result-card";

                addText(card, "h3", scheme.scheme_name || "Government scheme");

                addText(
                    card,
                    "p",
                    "Category: " + (scheme.category || "Not specified")
                );

                addText(
                    card,
                    "p",
                    "Status: " + (scheme.status || "To be verified").replaceAll("_", " ")
                );

                if (Array.isArray(scheme.reasons) && scheme.reasons.length > 0) {
                    addText(card, "h4", "Why this scheme may match:");

                    scheme.reasons.forEach(function (reason) {
                        addText(card, "p", "• " + reason);
                    });
                }

                if (
                    Array.isArray(scheme.missing_information) &&
                    scheme.missing_information.length > 0
                ) {
                    addText(card, "h4", "Additional information needed:");

                    scheme.missing_information.forEach(function (item) {
                        addText(card, "p", "• " + item);
                    });
                }

                if (scheme.official_source) {
                    const source = document.createElement("a");
                    source.href = scheme.official_source;
                    source.textContent = "Official Scheme Details";
                    source.target = "_blank";
                    source.rel = "noopener noreferrer";
                    card.appendChild(source);
                }

                if (scheme.application_portal) {
                    const portal = document.createElement("a");
                    portal.href = scheme.application_portal;
                    portal.textContent = "Application Portal";
                    portal.target = "_blank";
                    portal.rel = "noopener noreferrer";
                    card.appendChild(portal);
                }

                results.appendChild(card);
            });
        }

        if (data.important_note) {
            addText(results, "p", data.important_note);
        }

        showStatus("Benefit matching completed.");

        const completionMessage = isTamil()
            ? "உங்களுக்கு பொருந்தக்கூடிய திட்டங்கள் திரையில் காட்டப்பட்டுள்ளன."
            : isArabic()
                ? "تم عرض البرامج المحتملة المناسبة لك على الشاشة."
                : "Your possible matching schemes are displayed on the screen.";

        speak(completionMessage);

        console.log("VoicePath profile sent:", profile);
        console.log("VoicePath API response:", data);

    } catch (error) {
        results.textContent = "Error: " + error.message;
        showStatus("Could not retrieve schemes. Please check the server.");
        console.error("VoicePath error:", error);
    }
}

function stopVoice() {
    isRunning = false;
    answerHandled = true;

    clearTimeout(startTimer);

    if (recognition && isListening) {
        try {
            recognition.stop();
        } catch (error) {
            console.log(error);
        }
    }

    window.speechSynthesis.cancel();

    startVoiceBtn.disabled = false;
    stopVoiceBtn.disabled = true;
    voiceLanguage.disabled = false;

    showStatus("Voice session stopped. Press Start Speaking to begin again.");
}

function resetProfile() {
    profile.age = null;
    profile.state = "";
    profile.disability_category = "";
    profile.disability_percentage = null;
    profile.certificate_available = null;
    profile.udid_available = null;
    profile.support_needed = "";
    profile.is_student = null;
}

if (!SpeechRecognition) {
    showStatus(
        "Speech recognition is not supported in this browser. Please use Google Chrome."
    );

    startVoiceBtn.disabled = true;

} else {
    recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = function () {
        isListening = true;
        console.log("Voice recognition started:", recognition.lang);
    };

    recognition.onresult = function (event) {
        if (!isRunning || answerHandled) return;

        const transcript =
            event.results[event.results.length - 1][0].transcript;

        currentAnswer = transcript.trim();

        console.log("Voice detected:", currentAnswer);
    };

    recognition.onerror = function (event) {
        console.log("Microphone error:", event.error);

        if (!isRunning || answerHandled) return;

        if (
            event.error === "not-allowed" ||
            event.error === "service-not-allowed"
        ) {
            isRunning = false;

            startVoiceBtn.disabled = false;
            stopVoiceBtn.disabled = true;
            voiceLanguage.disabled = false;

            showStatus("Microphone permission denied. Please allow microphone access in Chrome.");
        }
    };

    recognition.onend = function () {
        isListening = false;

        if (!isRunning || answerHandled) return;

        if (currentAnswer.trim()) {
            const answer = currentAnswer.trim();
            currentAnswer = "";

            handleAnswer(answer);
            return;
        }

        retryCount++;

        if (retryCount <= 3) {
            const retryMessage = isTamil()
                ? "குரல் கேட்கவில்லை. மீண்டும் பதில் சொல்லுங்கள்."
                : isArabic()
                    ? "لم أسمع صوتك. يرجى الإجابة مرة أخرى."
                    : "I couldn't hear you. Please answer again.";

            showStatus(retryMessage);

            setTimeout(function () {
                if (isRunning) {
                    speak(retryMessage, startListening);
                }
            }, 500);

        } else {
            isRunning = false;

            startVoiceBtn.disabled = false;
            stopVoiceBtn.disabled = true;
            voiceLanguage.disabled = false;

            showStatus(
                "No voice detected after 3 attempts. Press Start Speaking to restart."
            );
        }
    };

    startVoiceBtn.addEventListener("click", function () {
        if (isRunning) return;

        clearTimeout(startTimer);

        currentStep = 0;
        currentAnswer = "";
        retryCount = 0;
        answerHandled = false;
        isRunning = true;

        resetProfile();

        results.textContent = "";
        voiceTranscript.textContent = "";

        startVoiceBtn.disabled = true;
        stopVoiceBtn.disabled = false;
        voiceLanguage.disabled = true;

        askQuestion();
    });

    stopVoiceBtn.addEventListener("click", stopVoice);

    stopVoiceBtn.disabled = true;
}
