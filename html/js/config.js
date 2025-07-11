// Application Configuration
const Config = {
    API: {
        BASE_URL: 'http://localhost:8000'
    },
    LANGUAGES: {
        SUPPORTED: {
            'en': { name: 'English', nativeName: 'English', flag: '🇺🇸' },
            'ru': { name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
            'kk': { name: 'Kazakh', nativeName: 'Қазақша', flag: '🇰🇿' },
            'es': { name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
            'fr': { name: 'French', nativeName: 'Français', flag: '🇫🇷' },
            'de': { name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
            'zh': { name: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
            'ar': { name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦' }
        }
    },
    NOTIFICATION: {
        TYPES: {
            SUCCESS: 'success',
            ERROR: 'error',
            WARNING: 'warning',
            INFO: 'info'
        }
    }
}; 