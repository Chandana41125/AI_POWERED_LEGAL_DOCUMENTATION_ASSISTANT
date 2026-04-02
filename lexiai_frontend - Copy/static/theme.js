// ================================
//  LEXIAI THEME ENGINE
//  Handles Light/Dark Mode + Toggle
// ================================

const body = document.body;
const toggle = document.getElementById("themeToggle");

// Load saved theme
const savedTheme = localStorage.getItem("lexiai-theme");
if (savedTheme === "dark") {
    body.classList.add("dark-mode");
    if (toggle) {
        toggle.textContent = "☀️";
    }
}

// Theme switcher
if (toggle) {
    toggle.addEventListener("click", () => {
        body.classList.toggle("dark-mode");

        const isDark = body.classList.contains("dark-mode");
        toggle.textContent = isDark ? "☀️" : "🌙";

        localStorage.setItem("lexiai-theme", isDark ? "dark" : "light");
    });
}

// ================================
//  CHATBOT + VOICE FEATURES
// ================================

let recognition = null;
let isListening = false;
let voiceInputSupported = false;
let ttsSupported = false;
let currentUtterance = null;

function initVoiceFeatures() {
    const chatInput = document.getElementById("userInput");
    const sendButton = document.getElementById("sendButton");
    const chatWindow = document.getElementById("chatWindow");
    const voiceInputBtn = document.getElementById("voiceInputBtn");
    const voiceStatus = document.getElementById("voiceStatus");
    const stopVoiceOutputBtn = document.getElementById("stopVoiceOutputBtn");

    if (!chatInput || !sendButton || !chatWindow) {
        return;
    }

    // Ensure typing indicator lives inside the chat window so it scrolls with messages
    const typingIndicator = document.getElementById("typing-indicator");
    if (typingIndicator && typingIndicator.parentElement !== chatWindow) {
        chatWindow.appendChild(typingIndicator);
    }

    if (typeof window !== "undefined") {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            recognition = new SpeechRecognition();
            recognition.lang = "en-US";
            recognition.interimResults = false;
            recognition.continuous = false;
            voiceInputSupported = true;

            recognition.onstart = () => {
                isListening = true;
                if (voiceStatus) {
                    voiceStatus.textContent = "Listening...";
                }
                if (voiceInputBtn) {
                    voiceInputBtn.classList.add("active");
                }
            };

            recognition.onend = () => {
                isListening = false;
                if (voiceStatus) {
                    voiceStatus.textContent = "";
                }
                if (voiceInputBtn) {
                    voiceInputBtn.classList.remove("active");
                }
            };

            recognition.onerror = () => {
                isListening = false;
                if (voiceStatus) {
                    voiceStatus.textContent = "";
                }
                if (voiceInputBtn) {
                    voiceInputBtn.classList.remove("active");
                }
            };

            recognition.onresult = (event) => {
                if (!event.results || !event.results[0] || !event.results[0][0]) return;
                const transcript = event.results[0][0].transcript || "";
                const text = transcript.trim();
                if (!text) return;
                chatInput.value = transcript;
                if (typeof sendMessageToModel === "function") {
                    sendMessageToModel(text);
                }
            };
        }

        if ("speechSynthesis" in window) {
            ttsSupported = true;
        }
    }

    if (sendButton) {
        sendButton.addEventListener("click", () => {
            if (typeof sendMessage === "function") {
                sendMessage();
            }
        });
    }

    if (voiceInputBtn) {
        if (!voiceInputSupported) {
            voiceInputBtn.disabled = true;
            voiceInputBtn.title = "Your browser does not support voice input.";
        } else {
            voiceInputBtn.addEventListener("click", () => {
                if (isListening) {
                    stopVoiceInput();
                } else {
                    startVoiceInput();
                }
            });
        }
    }

    if (stopVoiceOutputBtn) {
        if (!ttsSupported) {
            stopVoiceOutputBtn.disabled = true;
            stopVoiceOutputBtn.textContent = "Voice not supported";
        } else {
            stopVoiceOutputBtn.addEventListener("click", () => {
                stopSpeaking();
            });
        }
    }

    if (chatInput) {
        chatInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                if (typeof sendMessage === "function") {
                    sendMessage();
                }
            }
        });
    }

    if (chatWindow) {
        chatWindow.addEventListener("click", (e) => {
            const playBtn = e.target.closest("[data-action='play-voice']");
            if (!playBtn) return;
            const botMsg = playBtn.closest(".bot-msg");
            if (!botMsg) return;
            const textEl = botMsg.querySelector(".bot-text");
            const text = textEl ? textEl.textContent : botMsg.textContent;
            if (text && ttsSupported) {
                speakMessage(text);
            } else if (!ttsSupported) {
                alert("Your browser does not support voice output.");
            }
        });
    }
}

function startVoiceInput() {
    if (!voiceInputSupported || !recognition || isListening) return;
    recognition.start();
}

function stopVoiceInput() {
    if (!voiceInputSupported || !recognition || !isListening) return;
    recognition.stop();
}

function speakMessage(text) {
    if (!ttsSupported || !("speechSynthesis" in window)) return;
    stopSpeaking();
    const utterance = new SpeechSynthesisUtterance(text);
    currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
    utterance.onend = () => {
        currentUtterance = null;
    };
}

function stopSpeaking() {
    if (!ttsSupported || !("speechSynthesis" in window)) return;
    if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
        window.speechSynthesis.cancel();
    }
    currentUtterance = null;
}

async function sendMessageToModel(messageText) {
    const chatWindow = document.getElementById("chatWindow");
    if (!chatWindow) return;

    const text = (messageText || "").trim();
    if (!text) return;

    const typingIndicator = document.getElementById("typing-indicator");

    // Add user message (preserve newlines via textContent)
    const userMsgEl = document.createElement("div");
    userMsgEl.classList.add("chat-msg", "user-msg");
    userMsgEl.textContent = text;

    if (typingIndicator && typingIndicator.parentElement === chatWindow) {
        chatWindow.insertBefore(userMsgEl, typingIndicator);
    } else {
        chatWindow.appendChild(userMsgEl);
    }
    chatWindow.scrollTop = chatWindow.scrollHeight;

    if (typingIndicator) {
        typingIndicator.classList.remove("hidden");
    }

    const url = '/chat';
    const body = { msg: text };

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            console.error('LexiAI chat request failed', {
                url,
                body,
                status: res.status,
                statusText: res.statusText
            });
            const errorMsg = `Error: ${res.status} ${res.statusText}`;
            appendBotMessage(errorMsg);
            if (typingIndicator) {
                typingIndicator.classList.add("hidden");
            }
            return;
        }

        let data = null;
        try {
            data = await res.json();
        } catch (err) {
            console.error('LexiAI chat JSON parse error', {
                url,
                body,
                error: err
            });
            appendBotMessage('Error: No response from model.');
            if (typingIndicator) {
                typingIndicator.classList.add("hidden");
            }
            return;
        }

        const reply = data && data.reply;
        if (!reply) {
            console.error('LexiAI chat missing reply field', {
                url,
                body,
                data
            });
            appendBotMessage('Error: No response from model.');
            if (typingIndicator) {
                typingIndicator.classList.add("hidden");
            }
            return;
        }

        appendBotMessage(reply);
        if (typingIndicator) {
            typingIndicator.classList.add("hidden");
        }
    } catch (err) {
        console.error('LexiAI chat network error', {
            url,
            body,
            error: err
        });
        appendBotMessage('Error: Unable to reach model.');
        if (typingIndicator) {
            typingIndicator.classList.add("hidden");
        }
    }
}

async function sendMessage() {
    const input = document.getElementById("userInput");
    if (!input) return;

    const message = input.value.trim();
    if (!message) return;

    input.value = "";
    await sendMessageToModel(message);
}

function appendBotMessage(text) {
    const chatWindow = document.getElementById("chatWindow");
    if (!chatWindow) return;

    const safeText = text || '';

    const botMsgEl = document.createElement("div");
    botMsgEl.classList.add("chat-msg", "bot-msg");

    const textSpan = document.createElement("span");
    textSpan.classList.add("bot-text");
    textSpan.textContent = safeText; // preserves \n
    botMsgEl.appendChild(textSpan);

    const typingIndicator = document.getElementById("typing-indicator");

    if (ttsSupported) {
        const playBtn = document.createElement("button");
        playBtn.type = "button";
        playBtn.classList.add("voice-button");
        playBtn.setAttribute("data-action", "play-voice");
        playBtn.textContent = "🔊";
        botMsgEl.appendChild(playBtn);
    }

    if (typingIndicator && typingIndicator.parentElement === chatWindow) {
        chatWindow.insertBefore(botMsgEl, typingIndicator);
    } else {
        chatWindow.appendChild(botMsgEl);
    }
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

function initLogoutConfirm() {
    const logoutBtn = document.getElementById("logout-btn");
    if (!logoutBtn) return;
    logoutBtn.addEventListener("click", (e) => {
        e.preventDefault();
        if (confirm("Are you sure you want to logout?")) {
            window.location.href = "/logout";
        }
    });
}

function initLexiAI() {
    initVoiceFeatures();
    initLogoutConfirm();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initLexiAI);
} else {
    initLexiAI();
}