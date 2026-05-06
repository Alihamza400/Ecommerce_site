/**
 * AIAssistant.js — Production Level AI Integration
 * Handles: Semantic Search, RAG Chat Assistant, and UI interactions.
 */

class AIAssistant {
    constructor() {
        this.apiUrl = "http://localhost:8000"; // FastAPI AI Service
        this.chatHistory = [];
        this.isOpen = false;
        
        this.initUI();
        this.bindEvents();
    }

    initUI() {
        // Create Toggle Button
        const toggleBtn = document.createElement('div');
        toggleBtn.className = 'ai-toggle-btn';
        toggleBtn.id = 'ai-assistant-toggle';
        toggleBtn.innerHTML = `
            <div class="pulse"></div>
            <i class="ph ph-sparkle"></i>
        `;
        document.body.appendChild(toggleBtn);

        // Create Chat Container
        const chatContainer = document.createElement('div');
        chatContainer.className = 'ai-chat-container';
        chatContainer.id = 'ai-chat-box';
        chatContainer.innerHTML = `
            <div class="ai-chat-header">
                <div class="avatar"><i class="ph-fill ph-robot"></i></div>
                <div class="ai-chat-header-info">
                    <h3>ShopVerse AI</h3>
                    <span>Always active & intelligent</span>
                </div>
            </div>
            <div class="ai-messages" id="ai-messages-list">
                <div class="ai-message assistant">
                    Hi! I'm your ShopVerse assistant. Looking for something specific? Try searching by intent like "gadgets for travelers" or "minimalist desk setup".
                </div>
            </div>
            <div class="ai-chat-input-area">
                <input type="text" class="ai-chat-input" id="ai-user-input" placeholder="Ask me anything about our products...">
                <button class="ai-send-btn" id="ai-send-message">
                    <i class="ph-bold ph-paper-plane-right"></i>
                </button>
            </div>
        `;
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

        // Semantic Search Integration
        const searchInput = document.getElementById('ai-search-input');
        const resultsBox = document.getElementById('ai-search-results');

        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            const query = e.target.value.trim();
            
            if (query.length < 3) {
                resultsBox.classList.remove('active');
                return;
            }

            searchTimeout = setTimeout(async () => {
                const results = await this.performSemanticSearch(query);
                if (results && results.length > 0) {
                    this.renderSearchResults(results, resultsBox);
                } else {
                    resultsBox.innerHTML = '<div class="semantic-item">No products found matching your intent.</div>';
                    resultsBox.classList.add('active');
                }
            }, 500);
        });

        // Close search results when clicking outside
        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !resultsBox.contains(e.target)) {
                resultsBox.classList.remove('active');
            }
        });
    }

    renderSearchResults(results, container) {
        container.innerHTML = results.map(res => `
            <div class="semantic-item" onclick="window.location.href='product.html?id=${res.product_id}'">
                <div class="semantic-info">
                    <div class="product-title">${res.name}</div>
                    <div class="product-brand" style="font-size: 0.7rem;">Match Score: ${(res.score * 100).toFixed(0)}%</div>
                </div>
            </div>
        `).join('');
        container.classList.add('active');
    }

    async handleSendMessage() {
        const text = this.userInput.value.trim();
        if (!text) return;

        // 1. Add User Message to UI
        this.addMessage(text, 'user');
        this.userInput.value = '';

        // 2. Show Typing Indicator
        const typingId = this.showTyping();

        try {
            // 3. Call AI Service (RAG Assistant)
            const response = await fetch(`${this.apiUrl}/chat/assistant`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [
                        ...this.chatHistory,
                        { role: 'user', content: text }
                    ]
                })
            });

            const data = await response.json();
            
            // Remove typing indicator
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
        const typingDiv = document.createElement('div');
        typingDiv.id = id;
        typingDiv.className = 'ai-message assistant';
        typingDiv.innerHTML = `
            <div class="typing-indicator">
                <span></span><span></span><span></span>
            </div>
        `;
        this.chatList.appendChild(typingDiv);
        this.chatList.scrollTop = this.chatList.scrollHeight;
        return id;
    }

    /**
     * Enhanced Semantic Search Logic
     * Intercepts standard searches to provide AI-powered results
     */
    async performSemanticSearch(query) {
        try {
            const response = await fetch(`${this.apiUrl}/search/semantic`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: query, limit: 10 })
            });
            return await response.json();
        } catch (error) {
            console.error("Semantic Search Error:", error);
            return null;
        }
    }
}

// Initialize on Load
document.addEventListener('DOMContentLoaded', () => {
    window.shopVerseAI = new AIAssistant();
});
