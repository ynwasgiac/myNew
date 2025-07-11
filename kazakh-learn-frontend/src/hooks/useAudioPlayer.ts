// src/hooks/useAudioPlayer.ts
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { wordsAPI } from '../services/api';
import type { KazakhWord, KazakhWordSummary, WordSound } from '../types/api';

interface UseAudioPlayerProps {
  wordId: number;
  word?: KazakhWord | KazakhWordSummary;
}

export const useAudioPlayer = ({ wordId, word }: UseAudioPlayerProps) => {
  // Fetch word sounds from FastAPI
  const { data: wordSounds } = useQuery({
    queryKey: ['word-sounds', wordId],
    queryFn: () => wordsAPI.getWordSounds(wordId),
    enabled: !!wordId,
  });

  // Generate fallback audio sources
  const getAudioSources = (originalPath?: string): string[] => {
    if (!word) return [];
    
    const sources = [];
    
    // 1. Original database audio
    if (originalPath) {
      sources.push(originalPath);
    }
    
    // 2. Expected category path
    const safeWordName = word.kazakh_word.replace(/\s+/g, '_').toLowerCase();
    const categoryName = 'category' in word ? word.category.category_name : word.category_name;
    sources.push(`/audio/words/categories/${categoryName.toLowerCase()}/${safeWordName}.mp3`);
    
    // 3. Alternative audio formats
    sources.push(`/audio/words/categories/${categoryName.toLowerCase()}/${safeWordName}.wav`);
    sources.push(`/audio/words/categories/${categoryName.toLowerCase()}/${safeWordName}.ogg`);
    
    // 4. Category-specific audio
    sources.push(`/audio/words/placeholders/${categoryName.toLowerCase()}_sample.mp3`);
    
    // 5. Default pronunciation audio
    sources.push(`/audio/words/placeholders/default_pronunciation.mp3`);
    
    console.log('🎵 Audio sources generated:', sources);
    return sources;
  };

  // Main play audio function
  const playAudio = async (customMessageSuccess?: string, customMessageError?: string) => {
    if (!word) {
      console.log('❌ No word data available');
      return;
    }

    console.log('🎵 Word sounds data:', wordSounds);
    
    // Try to get sound from the FastAPI endpoint first, but use React public folder
    if (wordSounds && wordSounds.length > 0) {
      const primarySound = wordSounds.find(sound => sound.sound_type === 'pronunciation') || wordSounds[0];
      
      let audioUrl: string | null = null;
      
      if (primarySound.sound_path) {
        // Use React public folder - just use the sound_path directly
        audioUrl = primarySound.sound_path; // e.g., "/audio/1.mp3" -> served by React at localhost:3000
        console.log('🔄 Using React public folder URL:', audioUrl);
      } else {
        console.log('❌ No valid audio path found in FastAPI response');
      }
      
      if (audioUrl) {
        console.log('🔄 Trying React public folder audio URL:', audioUrl);
        
        try {
          const audio = new Audio(audioUrl);
          
          // Test if audio can load
          await new Promise((resolve, reject) => {
            audio.addEventListener('canplaythrough', () => {
              console.log(`✅ Audio loaded successfully from React public: ${audioUrl}`);
              resolve(true);
            }, { once: true });
            audio.addEventListener('error', (e) => {
              console.log(`❌ React public audio failed to load: ${audioUrl}`, e);
              reject(e);
            }, { once: true });
            audio.load();
          });
          
          // If successful, play the audio
          await audio.play();
          console.log(`🎵 Audio playing from React public: ${audioUrl}`);
          toast.success(customMessageSuccess || 'Audio played successfully');
          return;
          
        } catch (error) {
          console.log(`❌ React public audio failed: ${audioUrl}`, error);
          // Fall through to fallback system below
        }
      }
    }

    // Fallback to old system if FastAPI sound fails or is not available
    console.log('🔄 Falling back to old audio system...');
    
    // Get pronunciation data from word object if available
    const pronunciation = 'pronunciations' in word ? word.pronunciations?.[0] : undefined;
    console.log('🗣️ Pronunciation data:', pronunciation);
    
    const fallbackSources = [
      pronunciation?.audio_file_path,
      ...getAudioSources()
    ].filter(Boolean);
    
    // Try each fallback source
    for (let i = 0; i < fallbackSources.length; i++) {
      const audioSrc = fallbackSources[i];
      console.log(`🔄 Trying fallback source ${i + 1}/${fallbackSources.length}: ${audioSrc}`);
      
      try {
        const audio = new Audio(audioSrc);
        
        await new Promise((resolve, reject) => {
          audio.addEventListener('canplaythrough', () => {
            resolve(true);
          }, { once: true });
          audio.addEventListener('error', (e) => {
            reject(e);
          }, { once: true });
          audio.load();
        });
        
        await audio.play();
        console.log(`🎵 Fallback audio playing: ${audioSrc}`);
        toast.success(customMessageSuccess || 'Audio played successfully');
        return;
        
      } catch (error) {
        console.log(`❌ Fallback source failed: ${audioSrc}`, error);
      }
    }
    
    // If all sources fail
    console.log('❌ All audio sources failed');
    toast.error(customMessageError || 'Audio not available');
  };

  // Play individual sound from WordSound object
  const playIndividualSound = async (sound: WordSound, customMessageSuccess?: string, customMessageError?: string) => {
    console.log('🎵 Individual sound button clicked for sound object:', sound);
    
    let audioUrl: string | null = null;
    
    if (sound.sound_path) {
      // Use React public folder - just use the sound_path directly
      audioUrl = sound.sound_path; // e.g., "/audio/1.mp3"
      console.log('🔧 Using React public folder URL:', audioUrl);
    } else {
      console.log('❌ No sound_path available');
      toast.error(customMessageError || 'No audio path available');
      return;
    }
    
    console.log('🔄 Trying to play from React public folder:', audioUrl);
    
    try {
      const audio = new Audio(audioUrl);
      
      audio.addEventListener('error', (e) => {
        console.log('🔍 Audio error details:', e);
        console.log('🔍 Audio error type:', audio.error?.code, audio.error?.message);
      });
      
      await audio.play();
      console.log(`✅ Successfully played from React public: ${audioUrl}`);
      toast.success(customMessageSuccess || 'Audio played successfully');
    } catch (error) {
      console.log(`❌ Failed to play from React public: ${audioUrl}`, error);
      toast.error(customMessageError || 'Audio file not found in public folder');
    }
  };

  return {
    wordSounds,
    playAudio,
    playIndividualSound,
    hasAudio: (wordSounds && wordSounds.length > 0) || false
  };
};