// src/pages/auth/RegisterPage.tsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { EyeIcon, EyeSlashIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { languagesAPI } from '../../services/api';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

interface FormData {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  full_name: string;
  role: 'student' | 'writer' | 'admin';
  main_language_code: string;
}

interface PasswordRequirement {
  text: string;
  test: (password: string) => boolean;
}

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { register, isLoading } = useAuth();
  
  const [formData, setFormData] = useState<FormData>({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    full_name: '',
    role: 'student',
    main_language_code: 'en',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});

  // Fetch languages for selection
  const { data: languages } = useQuery({
    queryKey: ['languages'],
    queryFn: () => languagesAPI.getLanguages(),
  });

  // Password requirements
  const passwordRequirements: PasswordRequirement[] = [
    { text: 'At least 8 characters', test: (pwd) => pwd.length >= 8 },
    { text: 'Contains uppercase letter', test: (pwd) => /[A-Z]/.test(pwd) },
    { text: 'Contains lowercase letter', test: (pwd) => /[a-z]/.test(pwd) },
    { text: 'Contains number', test: (pwd) => /\d/.test(pwd) },
    { text: 'Contains special character', test: (pwd) => /[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?]/.test(pwd) },
  ];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Mark field as touched
    setTouchedFields(prev => ({ ...prev, [name]: true }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    // Username validation
    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    } else if (!/^[a-zA-Z0-9_-]+$/.test(formData.username)) {
      newErrors.username = 'Username can only contain letters, numbers, underscores, and hyphens';
    }
    
    // Email validation
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else {
      const failedRequirements = passwordRequirements.filter(req => !req.test(formData.password));
      if (failedRequirements.length > 0) {
        newErrors.password = 'Password does not meet requirements';
      }
    }
    
    // Confirm password validation
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    // Full name validation
    if (!formData.full_name.trim()) {
      newErrors.full_name = 'Full name is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      const { confirmPassword, ...registerData } = formData;
      await register(registerData);
      navigate('/app/dashboard');
    } catch (error) {
      // Error is handled by the auth context and displayed via toast
      console.error('Registration failed:', error);
    }
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen text="Creating your account..." />;
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Registration Form */}
      <div className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          <div>
            <h2 className="mt-6 text-3xl font-bold tracking-tight text-gray-900">
              Create your account
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Already have an account?{' '}
              <Link
                to="/login"
                className="font-medium text-blue-600 hover:text-blue-500"
              >
                Sign in here
              </Link>
            </p>
          </div>

          <div className="mt-8">
            <form className="space-y-6" onSubmit={handleSubmit}>
              {/* Username Field */}
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                  Username *
                </label>
                <div className="mt-1">
                  <input
                    id="username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    required
                    value={formData.username}
                    onChange={handleChange}
                    className={`appearance-none block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                      errors.username ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Choose a username"
                  />
                  {errors.username && (
                    <p className="mt-1 text-sm text-red-600">{errors.username}</p>
                  )}
                </div>
              </div>

              {/* Email Field */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email address *
                </label>
                <div className="mt-1">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    className={`appearance-none block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                      errors.email ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Enter your email"
                  />
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                  )}
                </div>
              </div>

              {/* Full Name Field */}
              <div>
                <label htmlFor="full_name" className="block text-sm font-medium text-gray-700">
                  Full Name *
                </label>
                <div className="mt-1">
                  <input
                    id="full_name"
                    name="full_name"
                    type="text"
                    autoComplete="name"
                    required
                    value={formData.full_name}
                    onChange={handleChange}
                    className={`appearance-none block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                      errors.full_name ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Enter your full name"
                  />
                  {errors.full_name && (
                    <p className="mt-1 text-sm text-red-600">{errors.full_name}</p>
                  )}
                </div>
              </div>

              {/* Password Field */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password *
                </label>
                <div className="mt-1 relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={formData.password}
                    onChange={handleChange}
                    className={`appearance-none block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm pr-10 ${
                      errors.password ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Create a strong password"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                    ) : (
                      <EyeIcon className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                </div>

                {/* Password Requirements */}
                {(touchedFields.password || formData.password) && (
                  <div className="mt-2 space-y-1">
                    {passwordRequirements.map((requirement, index) => {
                      const isValid = requirement.test(formData.password);
                      return (
                        <div key={index} className="flex items-center text-xs">
                          {isValid ? (
                            <CheckCircleIcon className="h-4 w-4 text-green-500 mr-2" />
                          ) : (
                            <XCircleIcon className="h-4 w-4 text-gray-300 mr-2" />
                          )}
                          <span className={isValid ? 'text-green-600' : 'text-gray-500'}>
                            {requirement.text}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {errors.password && (
                  <p className="mt-1 text-sm text-red-600">{errors.password}</p>
                )}
              </div>

              {/* Confirm Password Field */}
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                  Confirm Password *
                </label>
                <div className="mt-1 relative">
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className={`appearance-none block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm pr-10 ${
                      errors.confirmPassword ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Confirm your password"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                    ) : (
                      <EyeIcon className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
                )}
              </div>

              {/* Role Selection */}
              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                  Account Type
                </label>
                <div className="mt-1">
                  <select
                    id="role"
                    name="role"
                    value={formData.role}
                    onChange={handleChange}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  >
                    <option value="student">Student (Learn Kazakh)</option>
                    <option value="writer">Writer (Contribute Content)</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Choose "Student" if you want to learn Kazakh language.
                </p>
              </div>

              {/* Preferred Language */}
              <div>
                <label htmlFor="main_language_code" className="block text-sm font-medium text-gray-700">
                  Preferred Interface Language
                </label>
                <div className="mt-1">
                  <select
                    id="main_language_code"
                    name="main_language_code"
                    value={formData.main_language_code}
                    onChange={handleChange}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  >
                    <option value="en">English</option>
                    <option value="ru">Русский (Russian)</option>
                    <option value="kk">Қазақша (Kazakh)</option>
                    {languages?.map((language) => (
                      <option key={language.id} value={language.language_code}>
                        {language.language_name}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  This will be the language used for the app interface and translations.
                </p>
              </div>

              {/* Submit Button */}
              <div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Creating Account...' : 'Create Account'}
                </button>
              </div>

              {/* Terms and Privacy */}
              <div className="text-xs text-gray-500 text-center">
                By creating an account, you agree to our{' '}
                <a href="#" className="text-blue-600 hover:text-blue-500">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="#" className="text-blue-600 hover:text-blue-500">
                  Privacy Policy
                </a>
                .
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Right Panel - Branding */}
      <div className="hidden lg:block relative w-0 flex-1">
        <div className="absolute inset-0 bg-gradient-to-br from-green-600 to-blue-700">
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-white px-8">
              <h1 className="text-4xl font-bold mb-4">Join Our Community</h1>
              <p className="text-xl text-green-100 mb-8">
                Start your journey to master the Kazakh language today
              </p>
              <div className="space-y-4 text-green-100">
                <div className="flex items-center justify-center space-x-2">
                  <span className="text-2xl">🌟</span>
                  <span>Join thousands of learners</span>
                </div>
                <div className="flex items-center justify-center space-x-2">
                  <span className="text-2xl">🎯</span>
                  <span>Personalized learning experience</span>
                </div>
                <div className="flex items-center justify-center space-x-2">
                  <span className="text-2xl">🏆</span>
                  <span>Track your achievements</span>
                </div>
                <div className="flex items-center justify-center space-x-2">
                  <span className="text-2xl">🚀</span>
                  <span>Accelerated learning methods</span>
                </div>
              </div>
              
              {/* Quick Stats */}
              <div className="mt-12 grid grid-cols-2 gap-6 text-center">
                <div>
                  <div className="text-3xl font-bold">5,000+</div>
                  <div className="text-sm text-green-200">Words to Learn</div>
                </div>
                <div>
                  <div className="text-3xl font-bold">10,000+</div>
                  <div className="text-sm text-green-200">Active Students</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;