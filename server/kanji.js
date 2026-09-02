import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dataPath = existsSync(join(process.cwd(), 'server/data/kanjiData.json'))
  ? join(process.cwd(), 'server/data/kanjiData.json')
  : join(process.cwd(), 'data/kanjiData.json');
const kanjiData = JSON.parse(readFileSync(dataPath, 'utf8'));
const vocabularyPath = existsSync(join(process.cwd(), 'server/data/vocabularyData.json'))
  ? join(process.cwd(), 'server/data/vocabularyData.json')
  : join(process.cwd(), 'data/vocabularyData.json');
const vocabularyData = JSON.parse(readFileSync(vocabularyPath, 'utf8'));

const elementaryReadingOverrides = {
  一: 'ひとつ', 二: 'ふたつ', 三: 'みっつ', 四: 'よっつ', 五: 'いつつ', 六: 'むっつ', 七: 'ななつ', 八: 'やっつ', 九: 'ここのつ', 十: 'じゅう',
  日: 'ひ', 月: 'つき', 火: 'ひ', 水: 'みず', 木: 'き', 金: 'かね', 土: 'つち',
  山: 'やま', 川: 'かわ', 田: 'た', 空: 'そら', 雨: 'あめ', 石: 'いし', 林: 'はやし', 森: 'もり', 花: 'はな', 草: 'くさ', 竹: 'たけ',
  人: 'ひと', 子: 'こ', 女: 'おんな', 男: 'おとこ', 父: 'ちち', 母: 'はは', 口: 'くち', 目: 'め', 耳: 'みみ', 手: 'て', 足: 'あし',
  犬: 'いぬ', 魚: 'さかな', 鳥: 'とり', 虫: 'むし', 貝: 'かい', 糸: 'いと', 力: 'ちから', 音: 'おと', 肉: 'にく', 米: 'こめ',
  上: 'うえ', 下: 'した', 今: 'いま', 生: 'せい', 行: 'こう', 食: 'しょく', 京: 'きょう', 暖: 'だん'
};

function toHiragana(reading = '') {
  return reading.replace(/[ァ-ヶ]/g, (character) => String.fromCharCode(character.charCodeAt(0) - 0x60));
}

export function educationalReading(entry) {
  const override = elementaryReadingOverrides[entry.kanji];
  if (override) return override;
  const standardOnyomi = [...(entry.onyomi ?? [])].reverse().find((reading) => reading && !reading.includes('-'));
  const standardKunyomi = entry.kunyomi?.find((reading) => reading && !reading.startsWith('-') && !reading.endsWith('-'));
  return toHiragana(standardOnyomi ?? standardKunyomi ?? entry.reading?.[0] ?? entry.kanji);
}

function vocabularyEntries(grade) {
  if (vocabularyData[grade]) return vocabularyData[grade];
  return Object.values(vocabularyData).flat();
}

export function parseCustomKanji(input = '') {
  return Array.from(new Set(input.split(/[\\s,\\u3001\\uff0c]+/).map((item) => item.trim()).filter(Boolean)));
}

export function getEntriesForSettings(settings) {
  if (settings.mode === 'grade') {
    const kanjiEntries = kanjiData[settings.grade] ?? [];
    const words = vocabularyEntries(settings.grade);
    if (settings.questionFormat === 'vocabulary') return words;
    if (settings.questionFormat === 'mixed') return [...kanjiEntries, ...words];
    return kanjiEntries;
  }
  const custom = parseCustomKanji(settings.customKanjiInput);
  return custom.map((kanji) => {
    const known = Object.values(kanjiData).flat().find((entry) => entry.kanji === kanji);
    return known ?? {
      kanji,
      reading: ['Unknown'],
      meaning: ['Teacher custom kanji'],
      grade: 'custom',
      onyomi: [],
      kunyomi: [],
      promptTypes: ['meaning'],
      distractors: custom.filter((item) => item !== kanji).slice(0, 6)
    };
  });
}

export function allKnownEntries() {
  return Object.values(kanjiData).flat();
}

export function allKnownKanji() {
  return Array.from(new Set(allKnownEntries().map((entry) => entry.kanji)));
}
