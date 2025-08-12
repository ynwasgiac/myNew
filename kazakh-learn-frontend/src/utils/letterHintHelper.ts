// src/utils/letterHintHelper.ts
export interface LetterHintState {
    target: string;            // исходная целевая строка
    hintedPart: string;        // то, что надо показать/подставить в инпут
    remainingPart: string;     // остаток (для UI)
    lastRevealedIndex: number; // последний раскрытый raw-индекс
    errors: number;            // накопленные ошибки ввода
    isCompleted: boolean;      // всё раскрыто?
    matchedLength: number;     // длина корректного префикса (в нормализованных символах)
    progressPct: number;       // прогресс в %
  }
  
  const SEP_RE = /[\s\-\u2011\u2013\u2014'’.,]/;
  
  /** Нормализация: нижний регистр + удаление диакритики. Пробелы/знаки не схлопываем. */
  function norm(s: string): string {
    return s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }
  
  /** Построение маппинга "нормализованная позиция" -> "raw-индекс" */
  function buildNormMap(raw: string) {
    const rawToNorm: number[] = [];        // для каждого raw-индекса — какая это позиция в norm
    const normToRaw: number[] = [];        // для каждой norm-позиции — raw-индекс символа-источника
    const normalized = norm(raw);
  
    // Пройдём по raw и normalized параллельно
    // После удаления диакритики длины, как правило, совпадают или norm короче (редко длиннее).
    // Идём по raw, для каждого "базового" символа двигаем norm-курсоры.
    let iRaw = 0;
    let iNorm = 0;
  
    while (iRaw < raw.length) {
      const chRaw = raw[iRaw];
      const chNorm = norm(chRaw);
  
      if (chNorm.length === 0) {
        // чистая диакритика — не даёт символ в normalized, просто пометим как «тот же iNorm»
        rawToNorm[iRaw] = iNorm; 
        iRaw++;
        continue;
      }
  
      // берём только первый символ нормализованной версии (обычно длина 1)
      rawToNorm[iRaw] = iNorm;
      normToRaw[iNorm] = iRaw;
  
      iRaw++;
      iNorm++;
    }
  
    const normTarget = normalized.slice(0, iNorm); // отрезаем на случай несовпадений
  
    return { normTarget, rawToNorm, normToRaw };
  }
  
  export class LetterHintHelper {
    private targetRaw: string;
    private normTarget: string;
    private rawToNorm: number[];
    private normToRaw: number[];
  
    private revealedRawIndex: number = 0; // сколько raw-символов открыто подсказками (сепараторы включаются автоматически)
    private userMatchedNorm: number = 0;  // корректный префикс от пользователя (в нормализованных символах)
    private errors: number = 0;
  
    constructor(target: string) {
      this.targetRaw = target;
      const map = buildNormMap(target);
      this.normTarget = map.normTarget;
      this.rawToNorm = map.rawToNorm;
      this.normToRaw = map.normToRaw;
    }
  
    /** Длина корректного префикса между input и target (в нормализованных символах) */
    private computeMatchedNorm(input: string): number {
      const a = norm(input);
      const b = this.normTarget;
      const len = Math.min(a.length, b.length);
      let i = 0;
      while (i < len && a[i] === b[i]) i++;
      return i;
    }
  
    /** Конвертирует нормализованную позицию в raw-индекс начала среза */
    private rawIndexFromNormCount(n: number): number {
      if (n <= 0) return 0;
      if (n >= this.normToRaw.length) return this.targetRaw.length;
      // norm-позиция указывает на конкретный raw-индекс символа;
      // хотим raw-индекс, следующий сразу после n-го норм-символа:
      const rawIdx = this.normToRaw[n - 1] + 1;
      return Math.min(rawIdx, this.targetRaw.length);
    }
  
    /** Собираем hintedPart и состояние */
    private buildState(): LetterHintState {
      // hinted = максимум из (то, до чего дошёл пользователь корректно) и (то, до чего раскрыли подсказками)
      const hintedEnd = Math.max(this.revealedRawIndex, this.rawIndexFromNormCount(this.userMatchedNorm));
      const hintedPart = this.targetRaw.slice(0, hintedEnd);
      const isCompleted = hintedEnd >= this.targetRaw.length;
      const progressPct = Math.round((hintedEnd / this.targetRaw.length) * 100);
  
      return {
        target: this.targetRaw,
        hintedPart,
        remainingPart: isCompleted ? '' : this.targetRaw.slice(hintedEnd),
        lastRevealedIndex: Math.max(-1, hintedEnd - 1),
        errors: this.errors,
        isCompleted,
        matchedLength: this.userMatchedNorm,
        progressPct,
      };
    }
  
    /** Обновляем состояние по пользовательскому вводу */
    updateUserInput(input: string): LetterHintState {
      const matched = this.computeMatchedNorm(input);
      const extraWrong = Math.max(0, norm(input).length - matched);
      this.userMatchedNorm = matched;
      if (extraWrong > 0) this.errors += extraWrong;
      return this.getState();
    }
  
    /**
     * Открыть следующую букву с учётом того, что пользователь уже ввёл.
     * ВАЖНО: сюда передаём ТЕКУЩИЙ userInput, чтобы хелпер сам «достроил» результат.
     */
    getNextHint(userInput: string): LetterHintState {
      // обновим matched по текущему вводу (это также посчитает ошибки)
      this.updateUserInput(userInput);
  
      if (this.revealedRawIndex >= this.targetRaw.length) {
        return this.getState();
      }
  
      // стартовая точка — дальше из двух: куда дошёл пользователь корректно, и куда дошли подсказки
      let pos = Math.max(this.revealedRawIndex, this.rawIndexFromNormCount(this.userMatchedNorm));
  
      // автопропуск разделителей
      while (pos < this.targetRaw.length && SEP_RE.test(this.targetRaw[pos])) {
        pos++;
      }
  
      // открыть один «полезный» символ, если возможно
      if (pos < this.targetRaw.length) {
        pos++;
      }
  
      this.revealedRawIndex = Math.max(this.revealedRawIndex, pos);
  
      // вернуть актуальное состояние
      return this.getState();
    }
  
    /** Текущее состояние без изменений */
    getState(): LetterHintState {
      return this.buildState();
    }
  
    /** Прогресс в процентах (по raw-строке) */
    getProgress(): number {
      return this.getState().progressPct;
    }
  }
  