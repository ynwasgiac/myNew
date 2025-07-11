// Settings Module
const Settings = {
    availableLanguages: [
        { language_code: 'en', language_name: 'English' },
        { language_code: 'ru', language_name: 'Русский' },
        { language_code: 'kk', language_name: 'Қазақша' },
        { language_code: 'es', language_name: 'Español' },
        { language_code: 'fr', language_name: 'Français' },
        { language_code: 'de', language_name: 'Deutsch' },
        { language_code: 'zh', language_name: '中文' },
        { language_code: 'ar', language_name: 'العربية' }
    ],

    init() {
        this.setupEventListeners();
        this.updateLanguageUI();
    },

    setupEventListeners() {
        // Settings tabs
        document.querySelectorAll('.settings-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                this.showTab(tabName);
            });
        });

        // Language form
        const languageForm = document.getElementById('languageForm');
        if (languageForm) {
            languageForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(languageForm);
                const languageCode = formData.get('language');

                try {
                    await this.setMainLanguage(languageCode);
                } catch (error) {
                    // Error already handled in setMainLanguage
                }
            });
        }

        // Language select change handler
        const languageSelect = document.getElementById('languageSelect');
        if (languageSelect) {
            languageSelect.addEventListener('change', async (e) => {
                const languageCode = e.target.value;
                if (languageCode && Auth.isAuthenticated()) {
                    try {
                        await this.setMainLanguage(languageCode);
                    } catch (error) {
                        languageSelect.value = Auth.getCurrentUserLanguage();
                    }
                }
            });
        }

        // Clear language button
        const clearLanguageBtn = document.getElementById('clearLanguageBtn');
        if (clearLanguageBtn) {
            clearLanguageBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                if (confirm('Are you sure you want to clear your language preference? This will reset to English.')) {
                    await this.clearMainLanguage();
                }
            });
        }
    },

    async setMainLanguage(languageCode) {
        try {
            if (!Auth.isAuthenticated()) {
                throw new Error('Please log in to set your language preference');
            }

            showNotification('Updating language preference...', Config.NOTIFICATION.TYPES.INFO);

            const result = await Auth.setMainLanguage(languageCode);
            this.updateLanguageUI();

            showNotification(
                `Language preference updated to ${result.language_name}`,
                Config.NOTIFICATION.TYPES.SUCCESS
            );

            return result;
        } catch (error) {
            console.error('Error setting main language:', error);
            showNotification(error.message, Config.NOTIFICATION.TYPES.ERROR);
            throw error;
        }
    },

    async clearMainLanguage() {
        try {
            if (!Auth.isAuthenticated()) {
                throw new Error('Please log in to manage your language preference');
            }

            showNotification('Clearing language preference...', Config.NOTIFICATION.TYPES.INFO);

            await Auth.clearMainLanguage();
            this.updateLanguageUI();

            showNotification('Language preference cleared', Config.NOTIFICATION.TYPES.SUCCESS);
        } catch (error) {
            console.error('Error clearing main language:', error);
            showNotification(error.message, Config.NOTIFICATION.TYPES.ERROR);
            throw error;
        }
    },

    showTab(tabName) {
        // Hide all tabs and contents
        document.querySelectorAll('.settings-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelectorAll('.settings-panel').forEach(panel => {
            panel.classList.add('hidden');
        });

        // Show selected tab and content
        const selectedTab = document.querySelector(`[data-tab="${tabName}"]`);
        const selectedContent = document.getElementById(`${tabName}Content`);

        if (selectedTab && selectedContent) {
            selectedTab.classList.add('active');
            selectedContent.classList.remove('hidden');

            if (tabName === 'language') {
                this.updateLanguageUI();
            }
        }
    },

    updateLanguageUI() {
        // Populate language dropdown
        const languageSelect = document.getElementById('languageSelect');
        if (languageSelect && this.availableLanguages.length > 0) {
            languageSelect.innerHTML = '';

            this.availableLanguages.forEach(lang => {
                const option = document.createElement('option');
                option.value = lang.language_code;
                option.textContent = `${lang.language_name} (${lang.language_code})`;
                languageSelect.appendChild(option);
            });

            const currentLang = Auth.getCurrentUserLanguage();
            languageSelect.value = currentLang;
        }

        // Create quick language selector
        const quickLangContainer = document.getElementById('quickLanguageSelector');
        if (quickLangContainer) {
            this.createQuickLanguageSelector(quickLangContainer);
        }

        // Update auth UI
        if (Auth.updateLanguageUI) {
            Auth.updateLanguageUI();
        }
    },

    createQuickLanguageSelector(container) {
        const currentLang = Auth.getCurrentUserLanguage();
        const popularLanguages = [
            { code: 'en', name: 'EN', fullName: 'English' },
            { code: 'ru', name: 'RU', fullName: 'Русский' },
            { code: 'kk', name: 'KK', fullName: 'Қазақша' },
            { code: 'es', name: 'ES', fullName: 'Español' }
        ];

        container.innerHTML = `
            <div class="quick-language-selector">
                <label style="color: var(--text-primary); font-weight: var(--font-medium); margin-bottom: var(--space-sm); display: block;">
                    Quick Select:
                </label>
                <div class="language-buttons">
                    ${popularLanguages.map(lang => `
                        <button type="button"
                                class="quick-language-btn ${lang.code === currentLang ? 'active' : ''}"
                                data-lang="${lang.code}"
                                title="${lang.fullName}">
                            ${lang.name}
                        </button>
                    `).join('')}
                </div>
            </div>
        `;

        // Add event listeners
        container.querySelectorAll('.quick-language-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const langCode = e.target.dataset.lang;
                if (langCode) {
                    try {
                        // Update button states immediately
                        container.querySelectorAll('.quick-language-btn').forEach(b => {
                            b.classList.remove('active');
                        });
                        e.target.classList.add('active');

                        // Set the language
                        await this.setMainLanguage(langCode);

                        // Update main selector too
                        const mainSelector = document.getElementById('languageSelect');
                        if (mainSelector) {
                            mainSelector.value = langCode;
                        }
                    } catch (error) {
                        // Revert on error
                        container.querySelectorAll('.quick-language-btn').forEach(b => {
                            b.classList.remove('active');
                            if (b.dataset.lang === Auth.getCurrentUserLanguage()) {
                                b.classList.add('active');
                            }
                        });
                    }
                }
            });
        });
    }
}; 