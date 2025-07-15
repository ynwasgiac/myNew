// Authentication Module
const Auth = {
    currentUser: null,

    init() {
        this.checkAuth();
        this.setupListeners();
    },

    setupListeners() {
        // Add event listener for sign out button
        const signOutBtn = document.getElementById('signOutBtn');
        if (signOutBtn) {
            signOutBtn.addEventListener('click', () => this.logout());
        }

        // Add event listeners for auth forms
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');

        if (loginForm) {
            loginForm.addEventListener('submit', handleLogin);
        }
        if (registerForm) {
            registerForm.addEventListener('submit', handleRegister);
        }
    },

    async checkAuth() {
        const token = localStorage.getItem('access_token');
        if (!token) {
            this.showAuthScreen();
            return;
        }

        try {
            // For now, we'll just use the token to access protected routes
            // In a real app, you might want to validate the token with the backend
            this.currentUser = {
                username: localStorage.getItem('username'),
                role: localStorage.getItem('user_role'),
                mainLanguage: JSON.parse(localStorage.getItem('user_main_language') || 'null')
            };

            this.updateUI();
            this.showMainApp();
        } catch (error) {
            console.error('Auth check failed:', error);
            this.logout();
        }
    },

    async setMainLanguage(languageCode) {
        try {
            const token = localStorage.getItem('access_token');
            if (!token) throw new Error('Not authenticated');

            const response = await fetch(`${Config.API.BASE_URL}/user/language`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ language_code: languageCode })
            });

            if (!response.ok) throw new Error('Failed to update language');

            const result = await response.json();
            
            // Update current user data
            this.currentUser.mainLanguage = {
                language_code: languageCode,
                language_name: Config.LANGUAGES.SUPPORTED[languageCode]?.name || languageCode
            };

            // Store in localStorage
            localStorage.setItem('user_language', languageCode);
            localStorage.setItem('user_main_language', JSON.stringify(this.currentUser.mainLanguage));

            // Update UI
            this.updateUI();

            return this.currentUser.mainLanguage;
        } catch (error) {
            console.error('Error setting main language:', error);
            throw error;
        }
    },

    async clearMainLanguage() {
        try {
            const token = localStorage.getItem('access_token');
            if (!token) throw new Error('Not authenticated');

            const response = await fetch(`${Config.API.BASE_URL}/user/language`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) throw new Error('Failed to clear language preference');

            // Update current user data
            this.currentUser.mainLanguage = null;

            // Remove from localStorage
            localStorage.removeItem('user_language');
            localStorage.removeItem('user_main_language');

            // Update UI
            this.updateUI();

            return { message: 'Language preference cleared' };
        } catch (error) {
            console.error('Error clearing main language:', error);
            throw error;
        }
    },

    getCurrentUserLanguage() {
        return this.currentUser?.mainLanguage?.language_code ||
               localStorage.getItem('user_language') ||
               'en';
    },

    updateUI() {
        const userAvatar = document.getElementById('userAvatar');
        if (userAvatar && this.currentUser) {
            const displayName = this.currentUser.username;
            userAvatar.textContent = displayName.charAt(0).toUpperCase();
        }

        this.updateLanguageUI();

        // Hide or show Admin Panel nav-item and view based on user role
        const adminNavItem = document.querySelector('.nav-link[data-view="adminPanel"]')?.parentElement;
        const adminPanelView = document.getElementById('adminPanelView');
        if (adminNavItem) {
            if (this.currentUser?.role === 'ADMIN') {
                adminNavItem.classList.remove('hidden');
            } else {
                adminNavItem.classList.add('hidden');
            }
        }
        if (adminPanelView) {
            if (this.currentUser?.role === 'ADMIN') {
                // Do not hide here, let navigation handle view switching
            } else {
                adminPanelView.classList.add('hidden');
            }
        }
    },

    updateLanguageUI() {
        // Update language display throughout the app
        const currentLanguageDisplay = document.getElementById('currentLanguageDisplay');
        if (currentLanguageDisplay) {
            const langText = this.currentUser?.mainLanguage
                ? `${this.currentUser.mainLanguage.language_name} (${this.currentUser.mainLanguage.language_code})`
                : 'No language preference set';

            currentLanguageDisplay.innerHTML = `
                <i class="fas fa-language"></i>
                <span>${langText}</span>
            `;
        }

        // Update user dropdown language info
        const userLanguageInfo = document.getElementById('userLanguageInfo');
        if (userLanguageInfo) {
            if (this.currentUser?.mainLanguage) {
                userLanguageInfo.innerHTML = `
                    <div class="dropdown-item-info">
                        <i class="fas fa-language"></i>
                        <span>${this.currentUser.mainLanguage.language_name}</span>
                    </div>
                `;
                userLanguageInfo.classList.remove('hidden');
            } else {
                userLanguageInfo.innerHTML = `
                    <div class="dropdown-item-info">
                        <i class="fas fa-language"></i>
                        <span style="color: var(--text-tertiary);">No language set</span>
                    </div>
                `;
                userLanguageInfo.classList.remove('hidden');
            }
        }

        // Update profile language info
        const profileLanguageInfo = document.getElementById('profileLanguageInfo');
        if (profileLanguageInfo) {
            if (this.currentUser?.mainLanguage) {
                profileLanguageInfo.innerHTML = `
                    <div class="profile-field">
                        <label>Interface Language:</label>
                        <span class="language-badge">
                            <i class="fas fa-language"></i>
                            ${this.currentUser.mainLanguage.language_name}
                        </span>
                    </div>
                `;
            } else {
                profileLanguageInfo.innerHTML = `
                    <div class="profile-field">
                        <label>Interface Language:</label>
                        <span style="color: var(--text-secondary);">
                            <i class="fas fa-language"></i>
                            Not set (using English)
                        </span>
                    </div>
                `;
            }
        }

        // Update profile fields
        const fields = ['Username', 'Email', 'FullName', 'Role', 'CreatedAt'];
        fields.forEach(field => {
            const element = document.getElementById(`profile${field}`);
            if (element && this.currentUser) {
                const key = field.charAt(0).toLowerCase() + field.slice(1);
                element.textContent = this.currentUser[key] || 'N/A';
            }
        });
    },

    showAuthScreen() {
        document.getElementById('authScreen').classList.remove('hidden');
        document.getElementById('mainApp').classList.add('hidden');
        document.getElementById('navbar').classList.add('hidden');
    },

    showMainApp() {
        document.getElementById('authScreen').classList.add('hidden');
        document.getElementById('mainApp').classList.remove('hidden');
        document.getElementById('navbar').classList.remove('hidden');
        // Restore last view
        if (window.Navigation) {
            const lastView = localStorage.getItem('last_view') || 'dashboard';
            switch (lastView) {
                case 'myWords': showMyWords(); break;
                case 'allWords': showAllWords(); break;
                case 'categories': showCategories(); break;
                case 'practice': showPractice(); break;
                default: showDashboard(); break;
            }
        }
    },

    isAuthenticated() {
        return !!localStorage.getItem('access_token');
    },

    logout() {
        // Clear all auth-related data
        localStorage.removeItem('access_token');
        localStorage.removeItem('username');
        localStorage.removeItem('user_role');
        //localStorage.removeItem('user_language');
        //localStorage.removeItem('user_main_language');
        
        // Reset current user
        this.currentUser = null;
        
        // Show auth screen
        this.showAuthScreen();
        
        // Show notification
        showNotification('Successfully logged out', Config.NOTIFICATION.TYPES.SUCCESS);
        
        // Clear any existing notifications
        const notificationsContainer = document.getElementById('notificationsContainer');
        if (notificationsContainer) {
            notificationsContainer.innerHTML = '';
        }
        
        // Reset any forms
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        if (loginForm) loginForm.reset();
        if (registerForm) registerForm.reset();
        
        // Hide any alerts
        hideAllAlerts();
    }
};

// Auth Functions
function showLogin() {
    document.getElementById('loginForm').classList.remove('hidden');
    document.getElementById('registerForm').classList.add('hidden');
    hideAllAlerts();
}

function showRegister() {
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('registerForm').classList.remove('hidden');
    hideAllAlerts();
}

function hideAllAlerts() {
    document.querySelectorAll('.alert').forEach(alert => {
        alert.classList.add('hidden');
    });
}

async function handleLogin(event) {
    event.preventDefault();

    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    const loginAlert = document.getElementById('loginAlert');
    const loginErrorText = document.getElementById('loginErrorText');

    try {
        const response = await fetch(`${Config.API.BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'accept': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        if (!response.ok) {
            throw new Error('Invalid username or password');
        }

        const data = await response.json();
        
        // Store auth data
        localStorage.setItem('access_token', data.access_token);
        localStorage.setItem('username', username);
        localStorage.setItem('user_role', data.user_role);
        if (data.user_language) {
            localStorage.setItem('user_language', data.user_language);
        }

        // Fetch user profile to get main language
        const meResp = await fetch(`${Config.API.BASE_URL}/auth/me`, {
            headers: {
                'Authorization': `Bearer ${data.access_token}`
            }
        });
        if (meResp.ok) {
            const meData = await meResp.json();
            if (meData.main_language && meData.main_language.language_code) {
                // Store in localStorage and Auth.currentUser
                localStorage.setItem('user_main_language', JSON.stringify(meData.main_language));
                localStorage.setItem('user_language', meData.main_language.language_code);
                if (Auth.currentUser) {
                    Auth.currentUser.mainLanguage = meData.main_language;
                }
            }
        }

        // Initialize auth and show main app
        Auth.checkAuth();
    } catch (error) {
        console.error('Login failed:', error);
        loginErrorText.textContent = error.message;
        loginAlert.classList.remove('hidden');
    }
}

async function handleRegister(event) {
    event.preventDefault();
    showNotification('Registration is not available in demo mode', Config.NOTIFICATION.TYPES.WARNING);
}

document.addEventListener('DOMContentLoaded', () => {
    Auth.init();
    Navigation.init();
    // Remove last view restoration from here
}); 