import React, { useState } from 'react';
import { 
  BookOpenIcon, 
  PencilIcon, 
  QuestionMarkCircleIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  PlayIcon,
  StarIcon,
  ClockIcon,
  TrophyIcon,
  FireIcon,
  ChartBarIcon,
  CogIcon,
  UserIcon,
  CalendarDaysIcon,
  AcademicCapIcon,
  LightBulbIcon,
  Bars3Icon,
  XMarkIcon
} from '@heroicons/react/24/outline';

interface MenuSection {
  id: string;
  title: string;
  icon: React.ComponentType<any>;
  items: MenuItem[];
  color: string;
}

interface MenuItem {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  badge?: string;
  onClick: () => void;
  disabled?: boolean;
}

const LearningModuleMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('learning');

  // Mock data - replace with real data from your API
  const dailyProgress = {
    words_learned_today: 7,
    daily_goal: 10,
    goal_reached: false,
    current_streak: 5
  };

  const wordsAvailable = {
    want_to_learn: 25,
    learning: 15,
    review: 8,
    total: 48
  };

  const menuSections: MenuSection[] = [
    {
      id: 'learning',
      title: 'Learning',
      icon: BookOpenIcon,
      color: 'blue',
      items: [
        {
          id: 'start-session',
          title: 'Start Learning Session',
          description: 'Begin a new learning session with your daily words',
          icon: PlayIcon,
          badge: wordsAvailable.total > 0 ? `${Math.min(wordsAvailable.total, dailyProgress.daily_goal)} words` : undefined,
          onClick: () => console.log('Start learning session'),
          disabled: wordsAvailable.total === 0
        },
        {
          id: 'quick-practice',
          title: 'Quick Practice',
          description: 'Review words you\'ve already learned',
          icon: PencilIcon,
          badge: wordsAvailable.review > 0 ? `${wordsAvailable.review} to review` : undefined,
          onClick: () => console.log('Quick practice'),
          disabled: wordsAvailable.review === 0
        },
        {
          id: 'quiz-mode',
          title: 'Quiz Challenge',
          description: 'Test your knowledge with random quizzes',
          icon: QuestionMarkCircleIcon,
          onClick: () => console.log('Quiz challenge')
        },
        {
          id: 'flashcards',
          title: 'Flashcards',
          description: 'Study with interactive flashcards',
          icon: AcademicCapIcon,
          onClick: () => console.log('Flashcards')
        }
      ]
    },
    {
      id: 'progress',
      title: 'Progress',
      icon: ChartBarIcon,
      color: 'green',
      items: [
        {
          id: 'daily-progress',
          title: 'Daily Progress',
          description: `${dailyProgress.words_learned_today}/${dailyProgress.daily_goal} words learned today`,
          icon: CalendarDaysIcon,
          badge: dailyProgress.goal_reached ? 'Complete!' : `${dailyProgress.daily_goal - dailyProgress.words_learned_today} left`,
          onClick: () => console.log('View daily progress')
        },
        {
          id: 'learning-stats',
          title: 'Learning Statistics',
          description: 'View detailed progress and analytics',
          icon: ChartBarIcon,
          onClick: () => console.log('View statistics')
        },
        {
          id: 'achievements',
          title: 'Achievements',
          description: 'Check your learning milestones',
          icon: TrophyIcon,
          badge: dailyProgress.current_streak > 0 ? `${dailyProgress.current_streak} day streak` : undefined,
          onClick: () => console.log('View achievements')
        },
        {
          id: 'streak',
          title: 'Learning Streak',
          description: 'Maintain your daily learning habit',
          icon: FireIcon,
          badge: `${dailyProgress.current_streak} days`,
          onClick: () => console.log('View streak')
        }
      ]
    },
    {
      id: 'manage',
      title: 'Manage Words',
      icon: LightBulbIcon,
      color: 'purple',
      items: [
        {
          id: 'word-library',
          title: 'Word Library',
          description: 'Browse and manage your word collection',
          icon: BookOpenIcon,
          badge: `${wordsAvailable.total} words`,
          onClick: () => console.log('Word library')
        },
        {
          id: 'categories',
          title: 'Categories',
          description: 'Organize words by topics and themes',
          icon: Bars3Icon,
          onClick: () => console.log('Manage categories')
        },
        {
          id: 'difficulty',
          title: 'Difficulty Levels',
          description: 'Adjust learning complexity settings',
          icon: StarIcon,
          onClick: () => console.log('Difficulty settings')
        },
        {
          id: 'spaced-repetition',
          title: 'Spaced Repetition',
          description: 'Review schedule and algorithm settings',
          icon: ClockIcon,
          onClick: () => console.log('Spaced repetition')
        }
      ]
    },
    {
      id: 'settings',
      title: 'Settings',
      icon: CogIcon,
      color: 'gray',
      items: [
        {
          id: 'learning-preferences',
          title: 'Learning Preferences',
          description: 'Customize your learning experience',
          icon: CogIcon,
          onClick: () => console.log('Learning preferences')
        },
        {
          id: 'daily-goals',
          title: 'Daily Goals',
          description: 'Set and modify your learning targets',
          icon: TrophyIcon,
          badge: `${dailyProgress.daily_goal} words/day`,
          onClick: () => console.log('Daily goals')
        },
        {
          id: 'profile',
          title: 'Profile Settings',
          description: 'Manage your account and preferences',
          icon: UserIcon,
          onClick: () => console.log('Profile settings')
        }
      ]
    }
  ];

  const getColorClasses = (color: string, variant: 'bg' | 'text' | 'border' | 'hover') => {
    const colorMap = {
      blue: {
        bg: 'bg-blue-50',
        text: 'text-blue-600',
        border: 'border-blue-200',
        hover: 'hover:bg-blue-100'
      },
      green: {
        bg: 'bg-green-50',
        text: 'text-green-600',
        border: 'border-green-200',
        hover: 'hover:bg-green-100'
      },
      purple: {
        bg: 'bg-purple-50',
        text: 'text-purple-600',
        border: 'border-purple-200',
        hover: 'hover:bg-purple-100'
      },
      gray: {
        bg: 'bg-gray-50',
        text: 'text-gray-600',
        border: 'border-gray-200',
        hover: 'hover:bg-gray-100'
      }
    };
    return colorMap[color as keyof typeof colorMap]?.[variant] || colorMap.gray[variant];
  };

  return (
    <div className="relative">
      {/* Menu Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 right-4 z-50 bg-white rounded-full p-3 shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-200"
      >
        {isOpen ? (
          <XMarkIcon className="h-6 w-6 text-gray-600" />
        ) : (
          <Bars3Icon className="h-6 w-6 text-gray-600" />
        )}
      </button>

      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Menu Panel */}
      <div className={`
        fixed top-0 right-0 h-full w-96 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        <div className="p-6 h-full overflow-y-auto">
          {/* Header */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Learning Menu</h2>
            <p className="text-gray-600">Quick access to all learning features</p>
          </div>

          {/* Progress Summary */}
          <div className="mb-6 p-4 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl text-white">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm opacity-90">Daily Progress</span>
              <span className="text-lg font-bold">{dailyProgress.words_learned_today}/{dailyProgress.daily_goal}</span>
            </div>
            <div className="w-full bg-white bg-opacity-20 rounded-full h-2 mb-2">
              <div 
                className="bg-white h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min((dailyProgress.words_learned_today / dailyProgress.daily_goal) * 100, 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-sm opacity-90">
              <span>{dailyProgress.current_streak} day streak 🔥</span>
              <span>{wordsAvailable.total} words available</span>
            </div>
          </div>

          {/* Section Tabs */}
          <div className="flex flex-wrap gap-2 mb-6">
            {menuSections.map((section) => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`
                    flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200
                    ${isActive 
                      ? `${getColorClasses(section.color, 'bg')} ${getColorClasses(section.color, 'text')} ${getColorClasses(section.color, 'border')} border` 
                      : 'text-gray-600 hover:bg-gray-100'
                    }
                  `}
                >
                  <Icon className="h-4 w-4 mr-1" />
                  {section.title}
                </button>
              );
            })}
          </div>

          {/* Menu Items */}
          <div className="space-y-3">
            {menuSections
              .find(section => section.id === activeSection)
              ?.items.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={item.onClick}
                    disabled={item.disabled}
                    className={`
                      w-full text-left p-4 rounded-xl border transition-all duration-200 group
                      ${item.disabled 
                        ? 'bg-gray-50 border-gray-200 opacity-50 cursor-not-allowed' 
                        : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-md'
                      }
                    `}
                  >
                    <div className="flex items-start">
                      <div className={`
                        p-2 rounded-lg mr-3 
                        ${item.disabled 
                          ? 'bg-gray-100' 
                          : `${getColorClasses(menuSections.find(s => s.id === activeSection)?.color || 'gray', 'bg')} group-hover:${getColorClasses(menuSections.find(s => s.id === activeSection)?.color || 'gray', 'hover')}`
                        }
                      `}>
                        <Icon className={`
                          h-5 w-5 
                          ${item.disabled 
                            ? 'text-gray-400' 
                            : getColorClasses(menuSections.find(s => s.id === activeSection)?.color || 'gray', 'text')
                          }
                        `} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-medium text-gray-900">{item.title}</h4>
                          {item.badge && (
                            <span className={`
                              px-2 py-1 text-xs rounded-full 
                              ${getColorClasses(menuSections.find(s => s.id === activeSection)?.color || 'gray', 'bg')} 
                              ${getColorClasses(menuSections.find(s => s.id === activeSection)?.color || 'gray', 'text')}
                            `}>
                              {item.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">{item.description}</p>
                      </div>
                      {!item.disabled && (
                        <ArrowRightIcon className="h-4 w-4 text-gray-400 group-hover:text-gray-600 ml-2 mt-1" />
                      )}
                    </div>
                  </button>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LearningModuleMenu;