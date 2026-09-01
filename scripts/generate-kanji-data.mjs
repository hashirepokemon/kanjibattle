import fs from 'node:fs';
import path from 'node:path';

const dataPath = path.join(process.cwd(), 'server', 'data', 'kanjiData.json');
const sourceListPath = path.join(process.cwd(), 'server', 'data', 'sourceKanjiLists.json');
const existing = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const sourceLists = fs.existsSync(sourceListPath) ? JSON.parse(fs.readFileSync(sourceListPath, 'utf8')) : {};

const gradeKeys = ['grade1', 'grade2', 'grade3', 'grade4', 'grade5', 'grade6'];

const weekdayHints = {
  日: { ニチ: 'ニチようび', にち: 'にちようび' },
  月: { ゲツ: 'ゲツようび' },
  火: { カ: 'カようび' },
  水: { スイ: 'スイようび' },
  木: { モク: 'モクようび' },
  金: { キン: 'キンようび' },
  土: { ド: 'ドようび' }
};

const preferredKun = { 日: 'ひ', 月: 'つき', 火: 'ひ', 水: 'みず', 木: 'き', 金: 'かね', 土: 'つち' };
const currentMextMoves = {
  toGrade4: '茨媛岡潟岐熊香佐埼崎滋鹿縄井沖栃奈梨阪阜賀群徳富城',
  toGrade5: '囲紀喜救型航告殺士史象賞貯停堂得毒費粉脈歴',
  toGrade6: '胃腸恩券承舌銭退敵俵預'
};
const manual = new Map(Object.values(existing).flat().map((entry) => [entry.kanji, entry]));

async function getApiEntry(kanji, gradeNumber) {
  const cached = manual.get(kanji);
  if (cached?.reading?.length && cached?.meaning?.length && !String(cached.meaning[0]).includes('MEXT Grade')) {
    return { ...cached, grade: gradeNumber, ...(weekdayHints[kanji] ? { readingHints: weekdayHints[kanji] } : {}) };
  }

  const response = await fetch(`https://kanjiapi.dev/v1/kanji/${encodeURIComponent(kanji)}`);
  if (!response.ok) throw new Error(`API failed for ${kanji}: ${response.status}`);
  const item = await response.json();
  const kunyomi = item.kun_readings ?? [];
  const onyomi = item.on_readings ?? [];
  const preferred = preferredKun[kanji] ? [preferredKun[kanji]] : [];
  const reading = Array.from(new Set([...preferred, ...kunyomi.slice(0, 1), ...onyomi.slice(0, 1)])).filter(Boolean).slice(0, 3);
  const meaning = (item.meanings ?? []).slice(0, 3);

  return {
    kanji,
    reading: reading.length ? reading : [kanji],
    meaning: meaning.length ? meaning : ['MEXT grade kanji'],
    grade: gradeNumber,
    onyomi,
    kunyomi,
    ...(weekdayHints[kanji] ? { readingHints: weekdayHints[kanji] } : {}),
    promptTypes: ['reading', 'meaning'],
    distractors: []
  };
}

function withDistractors(entries) {
  const chars = entries.map((entry) => entry.kanji);
  return entries.map((entry, index) => ({
    ...entry,
    distractors: chars
      .filter((kanji) => kanji !== entry.kanji)
      .slice(index + 1, index + 5)
      .concat(chars.filter((kanji) => kanji !== entry.kanji).slice(0, 4))
      .slice(0, 4)
  }));
}

function applyCurrentMextGradeDistribution(data) {
  const allEntries = Object.values(data).flat();
  const byKanji = new Map(allEntries.map((entry) => [entry.kanji, entry]));
  const moves = [
    ['grade4', currentMextMoves.toGrade4],
    ['grade5', currentMextMoves.toGrade5],
    ['grade6', currentMextMoves.toGrade6]
  ];
  const moved = new Set(moves.flatMap(([, kanji]) => [...kanji]));

  for (const gradeKey of gradeKeys) data[gradeKey] = data[gradeKey].filter((entry) => !moved.has(entry.kanji));
  for (const [gradeKey, kanji] of moves) {
    const gradeNumber = Number(gradeKey.replace('grade', ''));
    data[gradeKey].push(...[...kanji].map((character) => byKanji.get(character)).filter(Boolean).map((entry) => ({ ...entry, grade: gradeNumber })));
    data[gradeKey] = withDistractors(data[gradeKey]);
  }
}

async function getGradeKanji(gradeNumber) {
  const response = await fetch(`https://kanjiapi.dev/v1/kanji/grade-${gradeNumber}`);
  if (!response.ok) throw new Error(`Grade list failed for grade ${gradeNumber}: ${response.status}`);
  return response.json();
}

for (const [index, gradeKey] of gradeKeys.entries()) {
  const gradeNumber = index + 1;
  const kanjiList = await getGradeKanji(index + 1);
  const entries = [];
  for (const kanji of kanjiList) entries.push(await getApiEntry(kanji, gradeNumber));
  existing[gradeKey] = withDistractors(entries);
  console.log(`${gradeKey}: ${entries.length}`);
}

{
  const kanjiList = await getGradeKanji(8);
  const entries = [];
  for (const kanji of kanjiList) entries.push(await getApiEntry(kanji, 'Junior High and above'));
  existing.juniorHigh = withDistractors(entries);
  console.log(`juniorHigh: ${entries.length}`);
}

applyCurrentMextGradeDistribution(existing);

for (const key of ['jlptN5', 'jlptN4', 'jlptN3', 'jlptN2', 'jlptN1', 'advanced']) {
  const source = sourceLists[key]?.kanji ?? '';
  if (!source) continue;
  const label = key === 'advanced' ? 'AP Japanese' : key.replace('jlpt', 'JLPT ');
  const entries = [];
  for (const kanji of [...source]) entries.push(await getApiEntry(kanji, label));
  existing[key] = withDistractors(entries);
  console.log(`${key}: ${entries.length}`);
}

fs.writeFileSync(dataPath, `${JSON.stringify(existing, null, 2)}\n`, 'utf8');
