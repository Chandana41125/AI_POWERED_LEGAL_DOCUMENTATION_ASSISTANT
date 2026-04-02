document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const chatWindow = document.getElementById('chatWindow');
    const userInput = document.getElementById('userInput');
    const sendButton = document.getElementById('sendButton');
    const voiceInputBtn = document.getElementById('voiceInputBtn');
    const voicePauseBtn = document.getElementById('voicePauseBtn');
    const voiceStatus = document.getElementById('voiceStatus');

    // Speech Synthesis API
    const synth = window.speechSynthesis;
    let currentUtterance = null;
    let currentSpeakingMessage = null;

    // Initialize the application
    function init() {
        setupEventListeners();
        checkSpeechSynthesisSupport();
    }

    // Check if the browser supports speech synthesis
    function checkSpeechSynthesisSupport() {
        if (!('speechSynthesis' in window)) {
            voiceInputBtn.disabled = true;
            voiceInputBtn.title = 'Text-to-speech not supported in your browser';
            console.warn('Speech synthesis not supported in this browser.');
        }
    }

    // Set up event listeners
    function setupEventListeners() {
        // Send message on button click
        sendButton.addEventListener('click', sendMessage);
        
        // Send message on Enter key
        userInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        // Voice input button
        voiceInputBtn.addEventListener('click', toggleVoiceInput);
        
        // Pause voice input button
        voicePauseBtn.addEventListener('click', toggleVoicePause);
        
        // Stop speech when navigating away
        window.addEventListener('beforeunload', stopSpeech);
    }

    // Toggle voice input
    function toggleVoiceInput() {
        if (voiceInputBtn.dataset.state === 'inactive') {
            startVoiceInput();
        } else {
            stopVoiceInput();
        }
    }

    // Start voice input
    function startVoiceInput() {
        // This is a placeholder for actual voice recognition implementation
        voiceInputBtn.dataset.state = 'active';
        voiceInputBtn.classList.add('active');
        voicePauseBtn.classList.remove('hidden');
        voiceStatus.textContent = 'Listening...';
    }

    // Stop voice input
    function stopVoiceInput() {
        voiceInputBtn.dataset.state = 'inactive';
        voiceInputBtn.classList.remove('active');
        voicePauseBtn.classList.add('hidden');
        voiceStatus.textContent = '';
    }

    // Toggle voice pause
    function toggleVoicePause() {
        if (voicePauseBtn.dataset.state === 'paused') {
            resumeVoiceInput();
        } else {
            pauseVoiceInput();
        }
    }

    // Pause voice input
    function pauseVoiceInput() {
        voicePauseBtn.dataset.state = 'paused';
        voicePauseBtn.textContent = '▶️';
        voiceStatus.textContent = 'Paused';
    }

    // Resume voice input
    function resumeVoiceInput() {
        voicePauseBtn.dataset.state = 'active';
        voicePauseBtn.textContent = '⏸️';
        voiceStatus.textContent = 'Listening...';
    }

    // Send message to the chatbot
    function sendMessage() {
        const message = userInput.value.trim();
        if (!message) return;

        // Add user message to chat
        addMessage(message, 'user');
        userInput.value = '';

        // Simulate bot response (replace with actual API call)
        setTimeout(() => {
            const botResponse = "This is a sample response from LexiAI. The actual implementation will connect to your backend service for real responses.";
            addMessage(botResponse, 'bot');
        }, 1000);
    }

    // Add a message to the chat window
    function addMessage(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-msg ${sender}-msg`;
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        messageContent.textContent = text;
        
        // Add message content
        messageDiv.appendChild(messageContent);
        
        // Add voice controls for bot messages
        if (sender === 'bot') {
            const voiceControls = document.createElement('div');
            voiceControls.className = 'voice-controls';
            
            const startVoiceBtn = document.createElement('button');
            startVoiceBtn.className = 'voice-control start-voice-btn';
            startVoiceBtn.innerHTML = '🔊';
            startVoiceBtn.title = 'Listen to this message';
            startVoiceBtn.onclick = () => speakText(text, messageDiv);
            
            const stopVoiceBtn = document.createElement('button');
            stopVoiceBtn.className = 'voice-control stop-voice-btn hidden';
            stopVoiceBtn.innerHTML = '⏹️';
            stopVoiceBtn.title = 'Stop playback';
            stopVoiceBtn.onclick = stopSpeech;
            
            voiceControls.appendChild(startVoiceBtn);
            voiceControls.appendChild(stopVoiceBtn);
            messageDiv.appendChild(voiceControls);
        }
        
        chatWindow.appendChild(messageDiv);
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }

    // Speak the given text
    function speakText(text, messageElement) {
        // Stop any ongoing speech
        stopSpeech();
        
        // Get voice controls for this message
        const voiceControls = messageElement.querySelector('.voice-controls');
        const startBtn = messageElement.querySelector('.start-voice-btn');
        const stopBtn = messageElement.querySelector('.stop-voice-btn');
        
        // Update UI
        startBtn.classList.add('hidden');
        stopBtn.classList.remove('hidden');
        
        // Create a new speech synthesis utterance
        currentUtterance = new SpeechSynthesisUtterance(text);
        currentSpeakingMessage = messageElement;
        
        // Set voice properties
        const voices = synth.getVoices();
        const preferredVoice = voices.find(voice => voice.lang.includes('en'));
        if (preferredVoice) {
            currentUtterance.voice = preferredVoice;
        }
        currentUtterance.rate = 1.0;
        currentUtterance.pitch = 1.0;
        
        // Set up event handlers
        currentUtterance.onend = function() {
            if (currentSpeakingMessage === messageElement) {
                startBtn.classList.remove('hidden');
                stopBtn.classList.add('hidden');
                currentSpeakingMessage = null;
                currentUtterance = null;
            }
        };
        
        currentUtterance.onerror = function(event) {
            console.error('SpeechSynthesis error:', event);
            startBtn.classList.remove('hidden');
            stopBtn.classList.add('hidden');
            currentSpeakingMessage = null;
            currentUtterance = null;
        };
        
        // Start speaking
        synth.speak(currentUtterance);
    }
    
    // Stop the current speech
    function stopSpeech() {
        if (synth.speaking) {
            synth.cancel();
            
            if (currentSpeakingMessage) {
                const startBtn = currentSpeakingMessage.querySelector('.start-voice-btn');
                const stopBtn = currentSpeakingMessage.querySelector('.stop-voice-btn');
                
                if (startBtn) startBtn.classList.remove('hidden');
                if (stopBtn) stopBtn.classList.add('hidden');
                
                currentSpeakingMessage = null;
            }
            
            currentUtterance = null;
        }
    }

    // Initialize the application
    init();
});
