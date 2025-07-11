import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import Modal from '../../components/ui/Modal';
import api from '../../services/api';

// Types for media management
interface WordImage {
  id: number;
  kazakh_word_id: number;
  image_url: string;
  image_type: string;
  alt_text?: string;
  is_primary: boolean;
  source?: string;
  license?: string;
  created_at: string;
}

interface WordSound {
  id: number;
  kazakh_word_id: number;
  sound_url: string;
  sound_type?: string;
  alt_text?: string;
  created_at: string;
}

interface WordData {
  id: number;
  kazakh_word: string;
  kazakh_cyrillic?: string;
}

// API service for media management
const wordMediaAPI = {
  // Images
  async getWordImages(wordId: number): Promise<WordImage[]> {
    try {
      const response = await api.get(`/word-images/${wordId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch word images:', error);
      throw new Error('Failed to load images');
    }
  },

  async uploadWordImage(
    wordId: number, 
    file: File,
    options: {
      alt_text?: string;
      is_primary?: boolean;
      source?: string;
      license?: string;
    } = {}
  ): Promise<WordImage> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      if (options.alt_text) formData.append('alt_text', options.alt_text);
      if (options.is_primary !== undefined) formData.append('is_primary', String(options.is_primary));
      if (options.source) formData.append('source', options.source);
      if (options.license) formData.append('license', options.license);

      const response = await api.post(`/admin/words/${wordId}/images/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data.image;
    } catch (error) {
      console.error('Failed to upload image:', error);
      throw new Error('Failed to upload image');
    }
  },

  async deleteWordImage(wordId: number, imageId: number): Promise<void> {
    try {
      await api.delete(`/admin/words/${wordId}/images/${imageId}`);
    } catch (error) {
      console.error('Failed to delete image:', error);
      throw new Error('Failed to delete image');
    }
  },

  async setPrimaryImage(wordId: number, imageId: number): Promise<void> {
    try {
      await api.put(`/word-images/${imageId}/primary?word_id=${wordId}`);
    } catch (error) {
      console.error('Failed to set primary image:', error);
      throw new Error('Failed to set primary image');
    }
  },

  // Audio
  async getWordSounds(wordId: number): Promise<WordSound[]> {
    try {
      const response = await api.get(`/word-sounds/${wordId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch word sounds:', error);
      throw new Error('Failed to load audio files');
    }
  },

  async uploadWordSound(
    wordId: number,
    file: File,
    options: {
      sound_type?: string;
      alt_text?: string;
    } = {}
  ): Promise<WordSound> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      if (options.sound_type) formData.append('sound_type', options.sound_type);
      if (options.alt_text) formData.append('alt_text', options.alt_text);

      const response = await api.post(`/admin/words/${wordId}/sounds/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data.sound;
    } catch (error) {
      console.error('Failed to upload sound:', error);
      throw new Error('Failed to upload audio file');
    }
  },

  async deleteWordSound(wordId: number, soundId: number): Promise<void> {
    try {
      await api.delete(`/admin/words/${wordId}/sounds/${soundId}`);
    } catch (error) {
      console.error('Failed to delete sound:', error);
      throw new Error('Failed to delete audio file');
    }
  }
};

// Word Images Manager Component
export const WordImagesManager: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  word: WordData | null;
}> = ({ isOpen, onClose, word }) => {
  const [images, setImages] = useState<WordImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Upload form state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [altText, setAltText] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [source, setSource] = useState('');
  const [license, setLicense] = useState('');

  useEffect(() => {
    if (isOpen && word) {
      fetchImages();
      resetUploadForm();
    }
  }, [isOpen, word]);

  const fetchImages = async () => {
    if (!word) return;
    
    try {
      setLoading(true);
      setError(null);
      const data = await wordMediaAPI.getWordImages(word.id);
      setImages(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load images';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const resetUploadForm = () => {
    setSelectedFile(null);
    setAltText('');
    setIsPrimary(false);
    setSource('');
    setLicense('');
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast.error('File size must be less than 5MB');
      return;
    }

    setSelectedFile(file);
    
    // Auto-generate alt text if empty
    if (!altText && word) {
      setAltText(`Image for ${word.kazakh_word}`);
    }
    
    // Set as primary if no images exist
    if (images.length === 0) {
      setIsPrimary(true);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !word) return;

    try {
      setUploading(true);
      
      const newImage = await wordMediaAPI.uploadWordImage(word.id, selectedFile, {
        alt_text: altText,
        is_primary: isPrimary,
        source: source || undefined,
        license: license || undefined
      });
      
      setImages(prev => [...prev, newImage]);
      resetUploadForm();
      
      toast.success('Image uploaded successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to upload image';
      toast.error(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteImage = async (imageId: number) => {
    if (!window.confirm('Are you sure you want to delete this image?') || !word) {
      return;
    }

    try {
      await wordMediaAPI.deleteWordImage(word.id, imageId);
      setImages(prev => prev.filter(img => img.id !== imageId));
      toast.success('Image deleted successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete image';
      toast.error(errorMessage);
    }
  };

  const handleSetPrimary = async (imageId: number) => {
    if (!word) return;
    
    try {
      await wordMediaAPI.setPrimaryImage(word.id, imageId);
      
      // Update local state
      setImages(prev => prev.map(img => ({
        ...img,
        is_primary: img.id === imageId
      })));
      
      toast.success('Primary image updated');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to set primary image';
      toast.error(errorMessage);
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={`Manage Images - ${word?.kazakh_word || ''}`}
      size="lg"
    >
      <div className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 text-sm">{error}</p>
            <button
              onClick={fetchImages}
              className="mt-2 text-red-600 hover:text-red-700 text-sm underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Upload Section */}
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
          <div className="text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            
            <div className="mt-4">
              <input
                id="image-upload"
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="sr-only"
              />
              
              {!selectedFile ? (
                <label htmlFor="image-upload" className="cursor-pointer">
                  <span className="mt-2 block text-sm font-medium text-gray-900">
                    Upload new image
                  </span>
                  <span className="mt-1 block text-sm text-gray-500">
                    PNG, JPG, JPEG, WebP up to 5MB
                  </span>
                  <span className="mt-3 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700">
                    Choose File
                  </span>
                </label>
              ) : (
                <div className="space-y-4">
                  <div className="text-sm text-gray-600">
                    Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                  </div>
                  
                  {/* Upload Form */}
                  <div className="space-y-3 max-w-md mx-auto">
                    <input
                      type="text"
                      placeholder="Alt text (optional)"
                      value={altText}
                      onChange={(e) => setAltText(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                    
                    <input
                      type="text"
                      placeholder="Source (optional)"
                      value={source}
                      onChange={(e) => setSource(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                    
                    <input
                      type="text"
                      placeholder="License (optional)"
                      value={license}
                      onChange={(e) => setLicense(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                    
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={isPrimary}
                        onChange={(e) => setIsPrimary(e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm text-gray-700">Set as primary image</span>
                    </label>
                  </div>
                  
                  <div className="flex space-x-3">
                    <button
                      onClick={() => setSelectedFile(null)}
                      className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleUpload}
                      disabled={uploading}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                      {uploading ? (
                        <>
                          <LoadingSpinner />
                          <span className="ml-2">Uploading...</span>
                        </>
                      ) : (
                        'Upload Image'
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Images Grid */}
        {loading ? (
          <div className="flex justify-center items-center h-32">
            <LoadingSpinner />
            <span className="ml-2 text-gray-600">Loading images...</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {images.map((image) => (
              <div key={image.id} className="relative group">
                <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                  <img
                    src={image.image_url}
                    alt={image.alt_text || `Image for ${word?.kazakh_word}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtc2l6ZT0iMTgiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIiBmaWxsPSIjOTk5Ij5JbWFnZTwvdGV4dD48L3N2Zz4=';
                    }}
                  />
                  {image.is_primary && (
                    <div className="absolute top-2 left-2">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Primary
                      </span>
                    </div>
                  )}
                </div>
                
                <div className="mt-2 space-y-1">
                  <p className="text-sm text-gray-600 truncate">
                    {image.alt_text || 'No description'}
                  </p>
                  <p className="text-xs text-gray-400">
                    {image.image_type} • {new Date(image.created_at).toLocaleDateString()}
                  </p>
                  {image.source && (
                    <p className="text-xs text-gray-400">
                      Source: {image.source}
                    </p>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="mt-2 flex space-x-2">
                  {!image.is_primary && (
                    <button
                      onClick={() => handleSetPrimary(image.id)}
                      className="flex-1 text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded hover:bg-blue-200"
                    >
                      Set Primary
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteImage(image.id)}
                    className="flex-1 text-xs px-2 py-1 bg-red-100 text-red-800 rounded hover:bg-red-200"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {images.length === 0 && !loading && (
          <div className="text-center py-8 text-gray-500">
            <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="mt-2">No images found.</p>
            <p className="text-sm">Upload your first image above.</p>
          </div>
        )}
      </div>
    </Modal>
  );
};

// Word Sounds Manager Component
export const WordSoundsManager: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  word: WordData | null;
}> = ({ isOpen, onClose, word }) => {
  const [sounds, setSounds] = useState<WordSound[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<number | null>(null);
  
  // Upload form state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [soundType, setSoundType] = useState('pronunciation');
  const [altText, setAltText] = useState('');

  useEffect(() => {
    if (isOpen && word) {
      fetchSounds();
      resetUploadForm();
    }
  }, [isOpen, word]);

  const fetchSounds = async () => {
    if (!word) return;
    
    try {
      setLoading(true);
      setError(null);
      const data = await wordMediaAPI.getWordSounds(word.id);
      setSounds(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load audio files';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const resetUploadForm = () => {
    setSelectedFile(null);
    setSoundType('pronunciation');
    setAltText('');
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('audio/')) {
      toast.error('Please select an audio file');
      return;
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setSelectedFile(file);
    
    // Auto-generate alt text if empty
    if (!altText && word) {
      setAltText(`Pronunciation of ${word.kazakh_word}`);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !word) return;

    try {
      setUploading(true);
      
      const newSound = await wordMediaAPI.uploadWordSound(word.id, selectedFile, {
        sound_type: soundType,
        alt_text: altText
      });
      
      setSounds(prev => [...prev, newSound]);
      resetUploadForm();
      
      toast.success('Audio uploaded successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to upload audio';
      toast.error(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteSound = async (soundId: number) => {
    if (!window.confirm('Are you sure you want to delete this audio file?') || !word) {
      return;
    }

    try {
      await wordMediaAPI.deleteWordSound(word.id, soundId);
      setSounds(prev => prev.filter(sound => sound.id !== soundId));
      toast.success('Audio deleted successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete audio';
      toast.error(errorMessage);
    }
  };

  const handlePlaySound = (sound: WordSound) => {
    try {
      setPlayingId(sound.id);
      
      // Create audio element and play
      const audio = new Audio(sound.sound_url);
      
      audio.onended = () => {
        setPlayingId(null);
      };
      
      audio.onerror = () => {
        setPlayingId(null);
        toast.error('Failed to play audio file');
      };
      
      audio.play();
      
      // Stop playing after 30 seconds max
      setTimeout(() => {
        if (playingId === sound.id) {
          audio.pause();
          setPlayingId(null);
        }
      }, 30000);
      
    } catch (err) {
      setPlayingId(null);
      toast.error('Failed to play audio file');
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={`Manage Audio - ${word?.kazakh_word || ''}`}
      size="lg"
    >
      <div className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 text-sm">{error}</p>
            <button
              onClick={fetchSounds}
              className="mt-2 text-red-600 hover:text-red-700 text-sm underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Upload Section */}
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
          <div className="text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
            
            <div className="mt-4">
              <input
                id="audio-upload"
                type="file"
                accept="audio/*"
                onChange={handleFileSelect}
                className="sr-only"
              />
              
              {!selectedFile ? (
                <label htmlFor="audio-upload" className="cursor-pointer">
                  <span className="mt-2 block text-sm font-medium text-gray-900">
                    Upload new audio
                  </span>
                  <span className="mt-1 block text-sm text-gray-500">
                    MP3, WAV, OGG, M4A up to 10MB
                  </span>
                  <span className="mt-3 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700">
                    Choose File
                  </span>
                </label>
              ) : (
                <div className="space-y-4">
                  <div className="text-sm text-gray-600">
                    Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                  </div>
                  
                  {/* Upload Form */}
                  <div className="space-y-3 max-w-md mx-auto">
                    <select
                      value={soundType}
                      onChange={(e) => setSoundType(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    >
                      <option value="pronunciation">Pronunciation</option>
                      <option value="example">Example Usage</option>
                      <option value="native">Native Speaker</option>
                      <option value="slow">Slow Speech</option>
                    </select>
                    
                    <input
                      type="text"
                      placeholder="Alt text (optional)"
                      value={altText}
                      onChange={(e) => setAltText(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                  </div>
                  
                  <div className="flex space-x-3">
                    <button
                      onClick={() => setSelectedFile(null)}
                      className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleUpload}
                      disabled={uploading}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                      {uploading ? (
                        <>
                          <LoadingSpinner />
                          <span className="ml-2">Uploading...</span>
                        </>
                      ) : (
                        'Upload Audio'
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sounds List */}
        {loading ? (
          <div className="flex justify-center items-center h-32">
            <LoadingSpinner />
            <span className="ml-2 text-gray-600">Loading audio files...</span>
          </div>
        ) : (
          <div className="space-y-3">
            {sounds.map((sound) => (
              <div key={sound.id} className="bg-gray-50 rounded-lg p-4 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM15.657 6.343a1 1 0 011.414 0A9.972 9.972 0 0119 12a9.972 9.972 0 01-1.929 5.657 1 1 0 11-1.414-1.414A7.971 7.971 0 0017 12c0-1.496-.41-2.895-1.123-4.1a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 12a5.983 5.983 0 01-.757 2.829 1 1 0 11-1.415-1.414A3.987 3.987 0 0013 12c0-.537-.121-1.045-.343-1.486a1 1 0 010-1.343z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {sound.alt_text || 'Audio file'}
                    </p>
                    <p className="text-sm text-gray-500">
                      {sound.sound_type || 'Audio'} • {new Date(sound.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handlePlaySound(sound)}
                    disabled={playingId === sound.id}
                    className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200 disabled:opacity-50"
                  >
                    {playingId === sound.id ? (
                      <>
                        <LoadingSpinner />
                        <span className="ml-1">Playing</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                        </svg>
                        Play
                      </>
                    )}
                  </button>
                  
                  <button
                    onClick={() => handleDeleteSound(sound.id)}
                    className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded text-red-700 bg-red-100 hover:bg-red-200"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {sounds.length === 0 && !loading && (
          <div className="text-center py-8 text-gray-500">
            <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
            <p className="mt-2">No audio files found.</p>
            <p className="text-sm">Upload your first audio file above.</p>
          </div>
        )}
      </div>
    </Modal>
  );
};