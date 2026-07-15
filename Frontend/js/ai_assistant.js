class AIAssistant {
    constructor() {
        this.apiUrl = "http://localhost:8000";
        this.chatHistory = [];
        this.isOpen = false;
        this.initUI();
        this.bindEvents();
    }

    initUI() {
        const toggleBtn = document.createElement('div');
        toggleBtn.className = 'ai-toggle-btn';
        toggleBtn.id = 'ai-assistant-toggle';
        toggleBtn.innerHTML = `<div class="pulse"></div><i class="ph ph-sparkle"></i>`;
        document.body.appendChild(toggleBtn);
        const chatContainer = document.createElement('div');
        chatContainer.className = 'ai-chat-container';
        chatContainer.id = 'ai-chat-box';
        chatContainer.innerHTML = `
            <div class="ai-chat-header">
                <div class="avatar"><i class="ph-fill ph-robot"></i></div>
                <div class="ai-chat-header-info"><h3>ShopVerse AI</h3><span>Always active & intelligent</span></div>
            </div>
            <div class="ai-messages" id="ai-messages-list">
                <div class="ai-message assistant">Hi! I'm your ShopVerse assistant. Looking for something specific? Try searching by intent like "gadgets for travelers" or "minimalist desk setup".</div>
            </div>
            <div class="ai-chat-input-area">
                <input type="text" class="ai-chat-input" id="ai-user-input" placeholder="Ask me anything about our products...">
                <button class="ai-send-btn" id="ai-send-message"><i class="ph-bold ph-paper-plane-right"></i></button>
            </div>`;
        document.body.appendChild(chatContainer);
        this.chatList = document.getElementById('ai-messages-list');
        this.userInput = document.getElementById('ai-user-input');
        this.sendBtn = document.getElementById('ai-send-message');
    }

    bindEvents() {
        const toggle = document.getElementById('ai-assistant-toggle');
        const chatBox = document.getElementById('ai-chat-box');
        toggle.addEventListener('click', () => {
            this.isOpen = !this.isOpen;
            chatBox.classList.toggle('active', this.isOpen);
            if (this.isOpen) this.userInput.focus();
        });
        this.sendBtn.addEventListener('click', () => this.handleSendMessage());
        this.userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleSendMessage();
        });
        const searchInput = document.getElementById('ai-search-input');
        const resultsBox = document.getElementById('ai-search-results');
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            const query = e.target.value.trim();
            if (query.length < 3) { resultsBox.classList.remove('active'); return; }
            searchTimeout = setTimeout(async () => {
                const results = await this.performSemanticSearch(query);
                if (results && results.length > 0) {
                    this.renderSearchResults(results, resultsBox);
                } else {
                    resultsBox.innerHTML = '<div class="semantic-item">No products found matching your intent.</div>';
                    resultsBox.classList.add('active');
                }
            }, 300);
        });
        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !resultsBox.contains(e.target)) {
                resultsBox.classList.remove('active');
            }
        });
    }

    renderSearchResults(results, container) {
        container.innerHTML = results.map(r => {
            const img = r.image_url ? `<img src="/Ecommerce_site/Backend/${r.image_url}" style="width:40px;height:40px;object-fit:cover;border-radius:4px;">` : '<i class="ph ph-package" style="font-size:1.5rem;"></i>';
            return `<div class="semantic-item" onclick="window.location.href='index.html#products-grid'">
                <div style="display:flex;align-items:center;gap:0.8rem;">
                    ${img}
                    <div class="semantic-info">
                        <div class="product-title">${r.name}</div>
                        <div style="font-size:0.75rem;color:var(--clr-muted);">
                            ${r.brand || ''} ${r.price ? ' • $' + Number(r.price).toFixed(2) : ''}
                            <span style="color:var(--clr-primary-light);"> • ${(r.score * 100).toFixed(0)}% match</span>
                        </div>
                    </div>
                </div>
            </div>`;
        }).join('');
        container.classList.add('active');
    }

    async handleSendMessage() {
        const text = this.userInput.value.trim();
        if (!text) return;
        this.addMessage(text, 'user');
        this.userInput.value = '';
        const typingId = this.showTyping();
        try {
            const response = await fetch(`${this.apiUrl}/chat/assistant`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [...this.chatHistory, { role: 'user', content: text }]
                })
            });
            const data = await response.json();
            document.getElementById(typingId).remove();
            if (data.reply) {
                this.addMessage(data.reply, 'assistant');
                this.chatHistory.push({ role: 'user', content: text });
                this.chatHistory.push({ role: 'assistant', content: data.reply });
            } else {
                this.addMessage("I'm having trouble connecting to my brain right now. Please try again!", 'assistant');
            }
        } catch (error) {
            console.error("AI Error:", error);
            document.getElementById(typingId).remove();
            this.addMessage("Connection error. Make sure the AI Service is running!", 'assistant');
        }
    }

    addMessage(text, role) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `ai-message ${role}`;
        msgDiv.textContent = text;
        this.chatList.appendChild(msgDiv);
        this.chatList.scrollTop = this.chatList.scrollHeight;
    }

    showTyping() {
        const id = 'typing-' + Date.now();
        const div = document.createElement('div');
        div.id = id;
        div.className = 'ai-message assistant';
        div.innerHTML = `<div class="typing-indicator"><span></span><span></span><span></span></div>`;
        this.chatList.appendChild(div);
        this.chatList.scrollTop = this.chatList.scrollHeight;
        return id;
    }

    async performSemanticSearch(query) {
        try {
            const response = await fetch(`${this.apiUrl}/search/semantic`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query, limit: 10 })
            });
            return await response.json();
        } catch (error) {
            console.error("Semantic Search Error:", error);
            return null;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.shopVerseAI = new AIAssistant();
});

window.startVoiceSearch = function() {
    const btn = document.getElementById('voice-search-btn');
    const input = document.getElementById('ai-search-input');
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        alert('Voice search is not supported in your browser. Try Chrome or Edge.');
        return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    btn.classList.add('listening');
    btn.innerHTML = '<i class="ph ph-microphone"></i>';
    recognition.start();
    recognition.onresult = function(event) {
        const transcript = event.results[0][0].transcript;
        input.value = transcript;
        btn.classList.remove('listening');
        btn.innerHTML = '<i class="ph ph-microphone"></i>';
        input.dispatchEvent(new Event('input'));
    };
    recognition.onerror = function() {
        btn.classList.remove('listening');
        btn.innerHTML = '<i class="ph ph-microphone"></i>';
    };
    recognition.onend = function() {
        btn.classList.remove('listening');
        btn.innerHTML = '<i class="ph ph-microphone"></i>';
    };
};

window.handleImageSearch = async function(fileInput) {
    if (!fileInput.files || !fileInput.files[0]) return;
    const btn = document.getElementById('image-search-btn');
    const resultsBox = document.getElementById('ai-search-results');
    btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i>';
    try {
        const reader = new FileReader();
        reader.readAsDataURL(fileInput.files[0]);
        reader.onload = async function() {
            const base64 = reader.result;
            const response = await fetch('http://localhost:8000/search/image-search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image_data: base64, limit: 5 })
            });
            const results = await response.json();
            btn.innerHTML = '<i class="ph ph-camera"></i>';
            if (results && results.length > 0) {
                const container = document.getElementById('ai-search-results');
                container.innerHTML = '<div class="semantic-item" style="font-size:0.8rem;color:var(--clr-primary-light);font-weight:600;border-bottom:1px solid var(--clr-border);">Image Search Results</div>';
                window.shopVerseAI.renderSearchResults(results, container);
            } else {
                resultsBox.innerHTML = '<div class="semantic-item">No matching products found.</div>';
                resultsBox.classList.add('active');
            }
        };
    } catch(e) {
        btn.innerHTML = '<i class="ph ph-camera"></i>';
        alert('Image search failed. Make sure the AI service is running.');
    }
    fileInput.value = '';
};
