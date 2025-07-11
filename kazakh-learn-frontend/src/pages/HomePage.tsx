// src/pages/HomePage.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  BookOpenIcon, 
  AcademicCapIcon, 
  TrophyIcon,
  ChartBarIcon,
  PlayIcon,
  CheckIcon,
  StarIcon,
  UsersIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../contexts/AuthContext';

const HomePage: React.FC = () => {
  const { t } = useTranslation('home');
  const { isAuthenticated } = useAuth();

  const features = [
    {
      name: t('features.vocabulary.title'),
      description: t('features.vocabulary.description'),
      icon: BookOpenIcon,
      color: 'bg-blue-500'
    },
    {
      name: t('features.interactive.title'),
      description: t('features.interactive.description'),
      icon: AcademicCapIcon,
      color: 'bg-green-500'
    },
    {
      name: t('features.progress.title'),
      description: t('features.progress.description'),
      icon: ChartBarIcon,
      color: 'bg-purple-500'
    },
    {
      name: t('features.gamification.title'),
      description: t('features.gamification.description'),
      icon: TrophyIcon,
      color: 'bg-orange-500'
    }
  ];

  const stats = [
    { name: t('stats.activeUsers'), value: '10,000+', icon: UsersIcon },
    { name: t('stats.kazakhWords'), value: '5,000+', icon: BookOpenIcon },
    { name: t('stats.learningSessions'), value: '100,000+', icon: PlayIcon },
    { name: t('stats.successRate'), value: '95%', icon: StarIcon }
  ];

  const testimonials = [
    {
      content: t('testimonials.reviews.0.content'),
      author: t('testimonials.reviews.0.author'),
      role: t('testimonials.reviews.0.role'),
      avatar: "👩‍💼"
    },
    {
      content: t('testimonials.reviews.1.content'),
      author: t('testimonials.reviews.1.author'),
      role: t('testimonials.reviews.1.role'),
      avatar: "👨‍💻"
    },
    {
      content: t('testimonials.reviews.2.content'),
      author: t('testimonials.reviews.2.author'),
      role: t('testimonials.reviews.2.role'),
      avatar: "👩‍🎓"
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center">
              <div className="h-8 w-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">KL</span>
              </div>
              <span className="ml-2 text-xl font-bold text-gray-900">{t('navigation.logo')}</span>
            </div>

            {/* Navigation Links */}
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-4">
                <a href="#features" className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium transition-colors">
                  {t('navigation.features')}
                </a>
                <a href="#about" className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium transition-colors">
                  {t('navigation.about')}
                </a>
                <a href="#testimonials" className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium transition-colors">
                  {t('navigation.reviews')}
                </a>
              </div>
            </div>

            {/* Auth Buttons */}
            <div className="flex items-center space-x-4">
              {isAuthenticated ? (
                <Link
                  to="/app/dashboard"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  {t('navigation.goToDashboard')}
                </Link>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    {t('navigation.signIn')}
                  </Link>
                  <Link
                    to="/register"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    {t('navigation.getStarted')}
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-blue-50 via-white to-purple-50 py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
              {t('hero.title')}
            </h1>
            <p className="text-xl sm:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto">
              {t('hero.subtitle')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              {!isAuthenticated ? (
                <>
                  <Link
                    to="/register"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-lg text-lg font-semibold transition-all duration-200 hover:shadow-lg hover:-translate-y-1"
                  >
                    {t('hero.startLearningFree')}
                  </Link>
                  <Link
                    to="/login"
                    className="bg-white hover:bg-gray-50 text-blue-600 border-2 border-blue-600 px-8 py-4 rounded-lg text-lg font-semibold transition-all duration-200 hover:shadow-lg"
                  >
                    {t('hero.signIn')}
                  </Link>
                </>
              ) : (
                <Link
                  to="/app/dashboard"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-lg text-lg font-semibold transition-all duration-200 hover:shadow-lg hover:-translate-y-1"
                >
                  {t('hero.continueLearning')}
                </Link>
              )}
            </div>
          </div>

          {/* Hero Image/Illustration */}
          <div className="mt-16 relative">
            <div className="bg-gradient-to-r from-blue-100 to-purple-100 rounded-2xl p-8 shadow-xl">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
                <div className="text-center">
                  <div className="text-4xl mb-2">📚</div>
                  <h3 className="font-semibold text-gray-900">{t('hero.process.learn.title')}</h3>
                  <p className="text-sm text-gray-600">{t('hero.process.learn.description')}</p>
                </div>
                <div className="text-center">
                  <div className="text-4xl mb-2">🎯</div>
                  <h3 className="font-semibold text-gray-900">{t('hero.process.practice.title')}</h3>
                  <p className="text-sm text-gray-600">{t('hero.process.practice.description')}</p>
                </div>
                <div className="text-center">
                  <div className="text-4xl mb-2">🏆</div>
                  <h3 className="font-semibold text-gray-900">{t('hero.process.master.title')}</h3>
                  <p className="text-sm text-gray-600">{t('hero.process.master.description')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.name} className="text-center">
                <div className="flex justify-center mb-2">
                  <stat.icon className="h-8 w-8 text-blue-600" />
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-1">{stat.value}</div>
                <div className="text-sm text-gray-600">{stat.name}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              {t('features.title')}
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              {t('features.subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature) => (
              <div key={feature.name} className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
                <div className={`${feature.color} w-12 h-12 rounded-lg flex items-center justify-center mb-4`}>
                  <feature.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.name}</h3>
                <p className="text-gray-600 text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Learning Process Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              {t('howItWorks.title')}
            </h2>
            <p className="text-xl text-gray-600">
              {t('howItWorks.subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600">1</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">{t('howItWorks.steps.createAccount.title')}</h3>
              <p className="text-gray-600">
                {t('howItWorks.steps.createAccount.description')}
              </p>
            </div>

            <div className="text-center">
              <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-green-600">2</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">{t('howItWorks.steps.startLearning.title')}</h3>
              <p className="text-gray-600">
                {t('howItWorks.steps.startLearning.description')}
              </p>
            </div>

            <div className="text-center">
              <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-purple-600">3</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">{t('howItWorks.steps.trackProgress.title')}</h3>
              <p className="text-gray-600">
                {t('howItWorks.steps.trackProgress.description')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              {t('testimonials.title')}
            </h2>
            <p className="text-xl text-gray-600">
              {t('testimonials.subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex items-center mb-4">
                  <div className="text-2xl mr-3">{testimonial.avatar}</div>
                  <div>
                    <div className="font-semibold text-gray-900">{testimonial.author}</div>
                    <div className="text-sm text-gray-600">{testimonial.role}</div>
                  </div>
                </div>
                <p className="text-gray-700 italic">"{testimonial.content}"</p>
                <div className="flex text-yellow-400 mt-4">
                  {[...Array(5)].map((_, i) => (
                    <StarIcon key={i} className="h-5 w-5 fill-current" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            {t('cta.title')}
          </h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            {t('cta.subtitle')}
          </p>
          {!isAuthenticated ? (
            <Link
              to="/register"
              className="bg-white hover:bg-gray-100 text-blue-600 px-8 py-4 rounded-lg text-lg font-semibold transition-all duration-200 hover:shadow-lg hover:-translate-y-1 inline-block"
            >
              {t('cta.getStartedFree')}
            </Link>
          ) : (
            <Link
              to="/app/dashboard"
              className="bg-white hover:bg-gray-100 text-blue-600 px-8 py-4 rounded-lg text-lg font-semibold transition-all duration-200 hover:shadow-lg hover:-translate-y-1 inline-block"
            >
              {t('cta.continueLearning')}
            </Link>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center mb-4">
                <div className="h-8 w-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">KL</span>
                </div>
                <span className="ml-2 text-xl font-bold">{t('navigation.logo')}</span>
              </div>
              <p className="text-gray-300 mb-4 max-w-md">
                {t('footer.description')}
              </p>
              <div className="flex space-x-4">
                <span className="text-2xl">🇰🇿</span>
                <span className="text-gray-300">{t('footer.madeWith')}</span>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">{t('footer.product.title')}</h3>
              <ul className="space-y-2 text-gray-300">
                <li><a href="#features" className="hover:text-white transition-colors">{t('footer.product.features')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{t('footer.product.pricing')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{t('footer.product.mobileApp')}</a></li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">{t('footer.support.title')}</h3>
              <ul className="space-y-2 text-gray-300">
                <li><a href="#" className="hover:text-white transition-colors">{t('footer.support.helpCenter')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{t('footer.support.contactUs')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{t('footer.support.privacyPolicy')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{t('footer.support.termsOfService')}</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>{t('footer.copyright')}</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;