export interface User {
    id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    full_name?: string;
    is_active: boolean;
    date_joined: string;
    main_language?: {
      language_code: string;
      language_name: string;
    };
    // Add user interface language preference
    interface_language: string; // 'en' | 'kk' | 'ru'
    profile?: {
      preferred_language: string;
      learning_language: string;
      quiz_word_count?: number;
      daily_goal?: number;
      session_length?: number;
    };
  }