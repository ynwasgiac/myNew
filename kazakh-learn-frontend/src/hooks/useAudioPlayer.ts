// src/hooks/useAudioPlayer.ts - ИСПРАВЛЕНО: использует sound_url из word_sounds
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { wordsAPI } from '../services/api';
import type { KazakhWord, KazakhWordSummary, WordSound } from '../types/api';

interface UseAudioPlayerProps {
  wordId: number;
  word?: KazakhWord | KazakhWordSummary | any; // Добавляем any для совместимости с LearningWord
}

export const useAudioPlayer = ({ wordId, word }: UseAudioPlayerProps) => {
  // Загружаем звуки слова из FastAPI
  const { data: wordSounds } = useQuery({
    queryKey: ['word-sounds', wordId],
    queryFn: () => wordsAPI.getWordSounds(wordId),
    enabled: !!wordId,
    staleTime: 5 * 60 * 1000, // 5 минут
    retry: 1 // Уменьшаем количество повторов для быстрой отработки
  });

  // Генерация fallback источников аудио (только если нет данных из БД)
  const getAudioFallbackSources = (): string[] => {
    if (!word) return [];
    
    const sources = [];
    
    // Структурированные пути по категории ID
    const categoryId = word.category_id || (word.category && word.category.id);
    if (categoryId) {
      sources.push(`/audio/words/categories/${categoryId}/${word.id}.mp3`);
      sources.push(`/audio/words/categories/${categoryId}/${word.id}.wav`);
      sources.push(`/audio/words/categories/${categoryId}/${word.id}.ogg`);
    }
    
    // Структурированные пути по имени категории
    const categoryName = word.category_name || (word.category && word.category.category_name);
    if (categoryName) {
      const safeWordName = word.kazakh_word.replace(/\s+/g, '_').toLowerCase();
      const safeCategoryName = categoryName.toLowerCase();
      
      sources.push(`/audio/words/categories/${safeCategoryName}/${safeWordName}.mp3`);
      sources.push(`/audio/words/categories/${safeCategoryName}/${safeWordName}.wav`);
      sources.push(`/audio/words/categories/${safeCategoryName}/${word.id}.mp3`);
      sources.push(`/audio/words/categories/${safeCategoryName}/${word.id}.wav`);
    }
    
    // Прямые пути по ID слова
    sources.push(`/audio/words/${word.id}.mp3`);
    sources.push(`/audio/words/${word.id}.wav`);
    
    // Старые форматы для совместимости
    sources.push(`/audio/${word.id}.mp3`);
    
    // Fallback аудио для категории
    if (categoryName) {
      sources.push(`/audio/words/placeholders/${categoryName.toLowerCase()}_sample.mp3`);
    }
    
    // Дефолтное произношение
    sources.push(`/audio/words/placeholders/default_pronunciation.mp3`);
    
    console.log(`🎵 Generated ${sources.length} fallback audio sources for word ${word.id}:`, sources);
    return sources;
  };

  // Основная функция воспроизведения аудио
  const playAudio = async (customMessageSuccess?: string, customMessageError?: string) => {
    if (!word) {
      console.log('❌ No word data available for audio playback');
      toast.error('Нет данных о слове');
      return;
    }

    console.log(`🎵 Starting audio playback for word: ${word.kazakh_word} (id: ${word.id})`);
    console.log('🎵 WordSounds from database:', wordSounds);
    
    let audioSources: string[] = [];
    
    // ПРИОРИТЕТ 1: Используем sound_url из word_sounds (база данных)
    if (wordSounds && wordSounds.length > 0) {
      console.log('🎵 Using audio from database (word_sounds)');
      
      // Предпочитаем звуки с типом 'pronunciation', затем любые другие
      const pronunciationSounds = wordSounds.filter(sound => sound.sound_type === 'pronunciation');
      const otherSounds = wordSounds.filter(sound => sound.sound_type !== 'pronunciation');
      const orderedSounds = [...pronunciationSounds, ...otherSounds];
      
      // Добавляем все sound_url из базы данных
      orderedSounds.forEach(sound => {
        if (sound.sound_url) {
          audioSources.push(sound.sound_url);
          console.log(`🎵 Added database audio: ${sound.sound_url} (type: ${sound.sound_type})`);
        }
      });
    }
    
    // ПРИОРИТЕТ 2: Пробуем старые pronunciations (если есть в объекте слова)
    if ('pronunciations' in word && word.pronunciations && word.pronunciations.length > 0) {
      word.pronunciations.forEach((pronunciation: any) => {
        if (pronunciation.audio_file_path) {
          audioSources.push(pronunciation.audio_file_path);
          console.log(`🎵 Added pronunciation audio: ${pronunciation.audio_file_path}`);
        }
      });
    }
    
    // ПРИОРИТЕТ 3: Только если нет аудио из БД, используем fallback пути
    if (audioSources.length === 0) {
      console.log('🎵 No database audio found, using fallback sources');
      audioSources = getAudioFallbackSources();
    }
    
    if (audioSources.length === 0) {
      console.log('❌ No audio sources available');
      toast.error(customMessageError || 'Аудио недоступно');
      return;
    }
    
    // Убираем дубликаты
    const uniqueSources = audioSources.filter((source, index) => audioSources.indexOf(source) === index);
    console.log(`🔄 Trying ${uniqueSources.length} unique audio sources`);
    
    // Пробуем каждый источник по очереди
    for (let i = 0; i < uniqueSources.length; i++) {
      const audioSrc = uniqueSources[i];
      console.log(`🔄 Attempting source ${i + 1}/${uniqueSources.length}: ${audioSrc}`);
      
      try {
        const audio = new Audio(audioSrc);
        
        // Проверяем, может ли аудио загрузиться
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Audio load timeout'));
          }, 5000);
          
          audio.addEventListener('canplaythrough', () => {
            clearTimeout(timeout);
            resolve(true);
          }, { once: true });
          
          audio.addEventListener('error', (e) => {
            clearTimeout(timeout);
            reject(e);
          }, { once: true });
          
          audio.load();
        });
        
        // Если загрузилось успешно, воспроизводим
        await audio.play();
        console.log(`✅ Successfully played audio from: ${audioSrc}`);
        toast.success(customMessageSuccess || 'Произношение воспроизведено');
        return;
        
      } catch (error) {
        console.log(`❌ Failed to play from: ${audioSrc}`, error);
        continue;
      }
    }
    
    // Если все источники не сработали
    console.log('❌ All audio sources failed');
    toast.error(customMessageError || 'Аудио недоступно');
  };

  // Функция для воспроизведения конкретного звука (WordSound объект)
  const playIndividualSound = async (sound: WordSound, customMessageSuccess?: string, customMessageError?: string) => {
    console.log('🎵 Playing individual sound:', sound);
    
    if (!sound.sound_url) {
      console.log('❌ No sound_url available in WordSound object');
      toast.error(customMessageError || 'URL аудио недоступен');
      return;
    }
    
    const audioUrl = sound.sound_url;
    console.log('🔄 Trying to play individual sound from sound_url:', audioUrl);
    
    try {
      const audio = new Audio(audioUrl);
      
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Audio timeout'));
        }, 5000);
        
        audio.addEventListener('canplaythrough', () => {
          clearTimeout(timeout);
          resolve(true);
        }, { once: true });
        
        audio.addEventListener('error', (e) => {
          clearTimeout(timeout);
          reject(e);
        }, { once: true });
        
        audio.load();
      });
      
      await audio.play();
      console.log(`✅ Successfully played individual sound: ${audioUrl}`);
      toast.success(customMessageSuccess || 'Аудио воспроизведено');
    } catch (error) {
      console.log(`❌ Failed to play individual sound: ${audioUrl}`, error);
      toast.error(customMessageError || 'Аудио файл недоступен');
    }
  };

  // Проверка наличия аудио
  const hasAudio = wordSounds && wordSounds.length > 0;

  return {
    wordSounds,
    playAudio,
    playIndividualSound,
    hasAudio: hasAudio || false, // Теперь показываем только если реально есть в БД
    getAudioSources: getAudioFallbackSources
  };
};