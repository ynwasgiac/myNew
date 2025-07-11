// src/components/ui/SearchBar.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  MagnifyingGlassIcon, 
  XMarkIcon,
  ClockIcon,
  BookOpenIcon 
} from '@heroicons/react/24/outline';
import { wordsAPI } from '../../services/api';
import type { KazakhWordSummary } from '../../types/api';
import { useAuth } from '../../contexts/AuthContext';

interface SearchBarProps {
  onClose?: () => void;
  autoFocus?: boolean;
  placeholder?: string;
  className?: string;
}

const SearchBar: React.FC<SearchBarProps> = ({ 
  onClose, 
  autoFocus = false, 
  placeholder = "Search words...",
  className = ""
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  // Search results
  const { data: searchResults, isLoading } = useQuery({
    queryKey: ['search', query, user?.main_language?.language_code],
    queryFn: () => wordsAPI.searchWords(query, user?.main_language?.language_code, 10),
    enabled: query.length > 2,
  });

  // Recent searches (stored in localStorage)
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    // Load recent searches from localStorage
    const saved = localStorage.getItem('kazakh-learn-recent-searches');
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch (error) {
        console.error('Failed to load recent searches:', error);
      }
    }
  }, []);

  useEffect(() => {
    // Keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (inputRef.current) {
          inputRef.current.focus();
          setIsOpen(true);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setIsOpen(value.length > 0);
  };

  const handleInputFocus = () => {
    setIsOpen(query.length > 0 || recentSearches.length > 0);
  };

  const handleClose = () => {
    setIsOpen(false);
    setQuery('');
    if (onClose) {
      onClose();
    }
  };

  const saveRecentSearch = (searchTerm: string) => {
    const updated = [searchTerm, ...recentSearches.filter(s => s !== searchTerm)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('kazakh-learn-recent-searches', JSON.stringify(updated));
  };

  const handleSearch = (searchTerm: string) => {
    if (searchTerm.trim()) {
      saveRecentSearch(searchTerm.trim());
      navigate(`/app/words?search=${encodeURIComponent(searchTerm.trim())}`);
      handleClose();
    }
  };

  const handleWordSelect = (word: KazakhWordSummary) => {
    saveRecentSearch(word.kazakh_word);
    navigate(`/app/words/${word.id}`);
    handleClose();
  };

  const handleRecentSearchClick = (searchTerm: string) => {
    setQuery(searchTerm);
    handleSearch(searchTerm);
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem('kazakh-learn-recent-searches');
  };

  return (
    <div className={`relative ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              handleSearch(query);
            }
          }}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
        />
        {(query || onClose) && (
          <button
            onClick={handleClose}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Search Results Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-10"
            onClick={handleClose}
          />
          
          {/* Results Panel */}
          <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-96 overflow-y-auto">
            {/* Loading State */}
            {isLoading && query.length > 2 && (
              <div className="p-4 text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-sm text-gray-500 mt-2">Searching...</p>
              </div>
            )}

            {/* Search Results */}
            {searchResults && searchResults.length > 0 && (
              <div>
                <div className="px-4 py-2 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase">
                    Search Results
                  </p>
                </div>
                {searchResults.map((word) => (
                  <button
                    key={word.id}
                    onClick={() => handleWordSelect(word)}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-50 last:border-b-0"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-3">
                          <BookOpenIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="kazakh-text font-medium text-gray-900 truncate">
                              {word.kazakh_word}
                            </p>
                            {word.kazakh_cyrillic && (
                              <p className="cyrillic-text text-sm text-gray-600 truncate">
                                {word.kazakh_cyrillic}
                              </p>
                            )}
                            <p className="text-sm text-gray-600 truncate">
                              {word.primary_translation}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 ml-4">
                        <span className={`badge difficulty-${word.difficulty_level} text-xs`}>
                          {word.difficulty_level}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
                
                {/* View All Results */}
                {searchResults.length >= 10 && (
                  <button
                    onClick={() => handleSearch(query)}
                    className="w-full px-4 py-3 text-center text-blue-600 hover:bg-blue-50 border-t border-gray-100"
                  >
                    View all results for "{query}"
                  </button>
                )}
              </div>
            )}

            {/* No Results */}
            {query.length > 2 && searchResults && searchResults.length === 0 && !isLoading && (
              <div className="p-6 text-center">
                <p className="text-gray-500 mb-2">No words found for "{query}"</p>
                <p className="text-sm text-gray-400">Try a different search term</p>
              </div>
            )}

            {/* Recent Searches */}
            {query.length === 0 && recentSearches.length > 0 && (
              <div>
                <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase">
                    Recent Searches
                  </p>
                  <button
                    onClick={clearRecentSearches}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    Clear
                  </button>
                </div>
                {recentSearches.map((searchTerm, index) => (
                  <button
                    key={index}
                    onClick={() => handleRecentSearchClick(searchTerm)}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-50 last:border-b-0"
                  >
                    <div className="flex items-center space-x-3">
                      <ClockIcon className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-700">{searchTerm}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Empty State */}
            {query.length === 0 && recentSearches.length === 0 && (
              <div className="p-6 text-center">
                <MagnifyingGlassIcon className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 mb-1">Search for Kazakh words</p>
                <p className="text-sm text-gray-400">Type at least 3 characters to see results</p>
              </div>
            )}

            {/* Search Tips */}
            {query.length > 0 && query.length < 3 && (
              <div className="p-4 text-center">
                <p className="text-sm text-gray-500">
                  Type at least 3 characters to search
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default SearchBar;