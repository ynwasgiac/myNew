// Shared Learning Module
const LearnShared = {
    // Configuration
    API_BASE: 'http://127.0.0.1:8000',
    
    // Common utility functions
    getToken() {
        return localStorage.getItem('auth_token');
    },

    getQueryParam(name) {
        const url = new URL(window.location.href);
        return url.searchParams.get(name);
    },

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    },

    getUserLanguageCode() {
        const mainLang = localStorage.getItem('user_main_language');
        if (mainLang) {
            try {
                return JSON.parse(mainLang).language_code || 'ru';
            } catch (e) {}
        }
        return localStorage.getItem('user_language') || 'ru';
    },

    // Common API calls
    async fetchWords(categoryId, languageCode, wordIds = null) {
        const token = this.getToken();
        if (!token) {
            alert('Please log in.');
            window.location.href = '1.html';
            return null;
        }
        try {
            if (wordIds && wordIds.length > 0) {
                // Fetch each word by id and return in order
                const promises = wordIds.map(id => this.fetchWordDetails(id, languageCode));
                const words = await Promise.all(promises);
                // Filter out nulls (in case some words are not found)
                return words.filter(Boolean);
            } else {
                const resp = await fetch(`${this.API_BASE}/categories/${categoryId}/words?language_code=${languageCode}&skip=0&limit=100`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!resp.ok) {
                    throw new Error('Failed to load words');
                }
                return await resp.json();
            }
        } catch (error) {
            console.error('Error fetching words:', error);
            alert('Failed to load words.');
            return null;
        }
    },

    async getWordImageUrl(wordId) {
        const token = this.getToken();
        try {
            const resp = await fetch(`${this.API_BASE}/word-images/primary/${wordId}`, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            if (!resp.ok) return null;
            
            const data = await resp.json();
            if (data && data.image_url && data.image_url !== 'string') {
                return data.image_url;
            } 
            return null;
        } catch (error) {
            console.error('Error getting word image:', error);
            return null;
        }
    },

    async getWordSoundUrl(wordId) {
        const token = this.getToken();
        try {
            const resp = await fetch(`${this.API_BASE}/word-sounds/${wordId}`, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            if (!resp.ok) return null;
            
            const data = await resp.json();
            if (Array.isArray(data) && data.length > 0) {
                const sound = data[0];
                if (sound.sound_url && sound.sound_url !== 'string') {
                    return sound.sound_url;
                } else if (sound.sound_path && sound.sound_path !== 'string') {
                    return sound.sound_path;
                }
            }
            return null;
        } catch (error) {
            console.error('Error getting word sound:', error);
            return null;
        }
    },

    async fetchWordDetails(wordId, languageCode) {
        const token = this.getToken();
        try {
            const resp = await fetch(`${this.API_BASE}/words/${wordId}?language_code=${languageCode}`, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            if (!resp.ok) return null;
            return await resp.json();
        } catch (error) {
            console.error('Error fetching word details:', error);
            return null;
        }
    },

    async getTranslation(wordId, languageCode) {
        const details = await this.fetchWordDetails(wordId, languageCode);
        if (!details || !details.translations) return '';
        const tr = details.translations.find(t => t.language_code === languageCode);
        return tr ? tr.translation : '';
    },

    async updateWordProgress(wordId, data) {
        const token = this.getToken();
        if (!token) return;

        try {
            await fetch(`${this.API_BASE}/learning/words/${wordId}/progress`, {
                method: 'PUT',
                headers: {
                    'accept': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
        } catch (error) {
            console.error('Error updating word progress:', error);
        }
    },

    async setWantToLearn(wordId) {
        const token = this.getToken();
        try {
            await fetch(`${this.API_BASE}/learning/words/${wordId}/add?status=learning`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
        } catch (error) {
            console.error('Error setting word status:', error);
        }
    },

    // Common UI elements
    createSoundButton(soundUrl, className = 'btn btn-audio') {
        const soundBtn = document.createElement('button');
        soundBtn.className = className;
        soundBtn.innerHTML = '<i class="fas fa-volume-up"></i> Play Sound';
        soundBtn.onclick = () => {
            const audio = new Audio(soundUrl);
            audio.play().catch(e => console.error('Error playing audio:', e));
        };
        return soundBtn;
    },

    createImageElement(imageUrl, alt = 'Word Image') {
        const img = document.createElement('img');
        img.src = imageUrl;
        img.alt = alt;
        img.style.display = 'block';
        img.style.margin = '0.5em auto 1em auto';
        img.style.maxWidth = '440px';
        img.style.maxHeight = '360px';
        img.style.borderRadius = '12px';
        img.style.boxShadow = '0 2px 8px #0001';
        return img;
    },

    createHardWordButton(wordId, feedbackElement) {
        const hardBtn = document.createElement('button');
        hardBtn.className = 'btn btn-danger';
        hardBtn.innerHTML = '<i class="fas fa-star"></i> Hard word';
        hardBtn.onclick = async () => {
            await this.updateWordProgress(wordId, { difficulty_rating: 'hard' });
            if (feedbackElement) {
                feedbackElement.textContent = '⭐ Marked as hard word!';
                feedbackElement.style.color = '#d97706';
            }
        };
        return hardBtn;
    },

    // Common completion screen
    showFinishScreen(containerId) {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `
                <h3>🎉 Done! You finished this session.</h3>
                <button class="btn btn-primary" onclick="window.location.href='1.html'">Back to Home</button>
            `;
            container.style.display = 'block';
        }
    },

    // Filter words with images for visual exercises
    async filterWordsWithImages(words) {
        const wordsWithImages = [];
        for (const word of words) {
            const imageUrl = await this.getWordImageUrl(word.id);
            if (imageUrl) {
                wordsWithImages.push(word);
            }
        }
        return wordsWithImages;
    },

    // Filter words with sounds for audio exercises
    async filterWordsWithSounds(words) {
        const wordsWithSounds = [];
        for (const word of words) {
            const soundUrl = await this.getWordSoundUrl(word.id);
            if (soundUrl) {
                wordsWithSounds.push(word);
            }
        }
        return wordsWithSounds;
    },

    // Get distractor options for quiz questions
    async getDistractorTranslations(words, correctWordId, languageCode, count = 4) {
        const distractorWords = this.shuffleArray(words.filter(w => w.id !== correctWordId)).slice(0, count * 2);
        const distractors = [];
        
        for (let w of distractorWords) {
            const tr = await this.getTranslation(w.id, languageCode);
            if (tr && !distractors.includes(tr)) {
                distractors.push(tr);
            }
            if (distractors.length >= count) break;
        }
        return distractors;
    },

    // Common navigation functions
    goToHome() {
        window.location.href = '1.html';
    },

    goToCategory(categoryId) {
        window.location.href = `learn.html?category_id=${categoryId}`;
    },

    goToRepeat(categoryId) {
        window.location.href = `repeat.html?category_id=${categoryId}`;
    },

    goToRepeatAudio(categoryId) {
        window.location.href = `repeat-audio.html?category_id=${categoryId}`;
    },

    goToWrite(categoryId) {
        window.location.href = `write.html?category_id=${categoryId}`;
    }
};

// Base class for all learning pages
class BaseLearningPage {
    constructor(pageType) {
        this.pageType = pageType;
        this.words = [];
        this.quizWords = [];
        this.currentIdx = 0;
        this.categoryId = LearnShared.getQueryParam('category_id');
        this.languageCode = LearnShared.getUserLanguageCode();
    }

    async init() {
        await this.loadWords();
        this.setupEventListeners();
    }

    async loadWords() {
        const allWords = await LearnShared.fetchWords(this.categoryId, this.languageCode);
        if (!allWords) return;

        this.words = allWords;
        this.quizWords = await this.filterWords(allWords);
        this.quizWords = LearnShared.shuffleArray(this.quizWords);
        
        this.currentIdx = 0;
        await this.showContent();
    }

    // Override in subclasses
    async filterWords(words) {
        return words;
    }

    // Override in subclasses
    setupEventListeners() {
        // Default implementation
    }

    // Override in subclasses
    async showContent() {
        // Default implementation
    }

    showFinishScreen() {
        const containers = ['quiz-container', 'answers-container', 'write-form'];
        containers.forEach(id => {
            const element = document.getElementById(id);
            if (element) element.style.display = 'none';
        });

        const finish = document.getElementById(`${this.pageType}-finish`);
        if (finish) finish.style.display = 'block';
    }

    nextQuestion() {
        this.currentIdx++;
        this.showContent();
    }

    isFinished() {
        return this.currentIdx >= this.quizWords.length;
    }
}

// Base class for quiz-style pages (repeat, repeat-audio)
class BaseQuizPage extends BaseLearningPage {
    constructor(pageType) {
        super(pageType);
        this.answerSelected = false;
    }

    async showContent() {
        if (this.isFinished()) {
            this.showFinishScreen();
            return;
        }

        await this.showQuiz();
    }

    async showQuiz() {
        const quizContainer = document.getElementById('quiz-container');
        const answersContainer = document.getElementById('answers-container');
        const feedback = document.getElementById('feedback');
        
        // Clean up and reset
        this.cleanupPreviousElements();
        this.answerSelected = false;
        if (feedback) feedback.textContent = '';
        
        const word = this.quizWords[this.currentIdx];
        
        // Show question content (override in subclasses)
        await this.showQuestion(word, quizContainer);
        
        // Prepare answers
        const correct = await LearnShared.getTranslation(word.id, this.languageCode);
        const distractors = await LearnShared.getDistractorTranslations(this.words, word.id, this.languageCode, 4);
        const options = LearnShared.shuffleArray([correct, ...distractors]);
        
        // Show answer options
        this.showAnswerOptions(options, correct, answersContainer);
        
        // Add control buttons
        this.addControlButtons(answersContainer, word.id);
    }

    // Override in subclasses
    async showQuestion(word, container) {
        container.innerHTML = `<p>Question for word: ${word.kazakh_word}</p>`;
    }

    showAnswerOptions(options, correct, container) {
        container.innerHTML = '';
        options.forEach(option => {
            const btn = document.createElement('button');
            btn.className = 'btn btn-outline btn-lg';
            btn.textContent = option;
            btn.dataset.correct = correct;
            btn.onclick = () => this.handleAnswer(option === correct, btn);
            container.appendChild(btn);
        });
    }

    addControlButtons(container, wordId) {
        // Next button
        const nextBtn = document.createElement('button');
        nextBtn.id = 'quiz-next-btn';
        nextBtn.className = 'btn btn-info btn-lg';
        nextBtn.textContent = 'Next';
        nextBtn.disabled = true;
        nextBtn.style.marginTop = '1rem';
        nextBtn.onclick = () => this.nextQuestion();
        container.appendChild(nextBtn);
        
        // Hard word button
        const hardBtn = LearnShared.createHardWordButton(wordId, document.getElementById('feedback'));
        hardBtn.className = 'btn btn-danger btn-lg';
        hardBtn.textContent = 'Hard word';
        hardBtn.style.marginTop = '1rem';
        hardBtn.style.marginLeft = '1rem';
        container.appendChild(hardBtn);
    }

    handleAnswer(isCorrect, btn) {
        const feedback = document.getElementById('feedback');
        
        if (isCorrect) {
            feedback.textContent = '✅ Correct!';
            feedback.style.color = '#28a745';
        } else {
            feedback.textContent = '❌ Incorrect!';
            feedback.style.color = '#dc3545';
            
            // Highlight correct answer
            document.querySelectorAll('#answers-container .btn-outline').forEach(b => {
                if (b.textContent === btn.dataset.correct) {
                    b.style.backgroundColor = '#28a745';
                    b.style.color = 'white';
                }
            });
        }
        
        // Disable all answer buttons
        document.querySelectorAll('#answers-container .btn-outline').forEach(b => b.disabled = true);
        
        // Enable next button
        const nextBtn = document.getElementById('quiz-next-btn');
        if (nextBtn) nextBtn.disabled = false;
        
        this.answerSelected = true;
    }

    // Override in subclasses
    cleanupPreviousElements() {
        ['quiz-next-btn'].forEach(id => {
            const element = document.getElementById(id);
            if (element) element.remove();
        });
    }
}