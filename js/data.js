/**
 * data.js
 * -----------------------------------------------------------------------
 * Pure content. This is the ONLY file you touch to add sentences.
 * No UI code, no engine code, nothing "smart" lives here — just facts
 * about sentences. lessonEngine, testEngine, progressEngine and every
 * page derive everything else (lesson count, test schedule, progress %)
 * from this array at runtime.
 *
 * To add a sentence: append an object with a new unique id.
 * To add a lesson: use a new `lesson` number — the app notices automatically.
 * To add a language: add a new languageCode block here, and one entry in
 * LANGUAGES (config.js). Nothing else changes.
 *
 * Shape:
 * {
 *   id,              unique integer across the whole language
 *   languageCode,    must match a code in LANGUAGES (config.js)
 *   lesson,          lesson number this sentence belongs to (1-based)
 *   target,          sentence in the target language
 *   pronunciation,   phonetic guide
 *   english,         English translation shown as the prompt
 *   answers          array of accepted spoken/typed answers (gender
 *                    variants, alternate spellings, etc.)
 * }
 */
const SENTENCES = [
  { id: 1,  languageCode: 'es', lesson: 1, target: 'Buenos días',           pronunciation: 'بوينوس دياس',        english: 'Good morning',                answers: ['Buenos días', 'Buenos dias'] },
  { id: 2,  languageCode: 'es', lesson: 1, target: 'Buenas tardes',         pronunciation: 'بويناس تارديس',      english: 'Good afternoon',              answers: ['Buenas tardes'] },
  { id: 3,  languageCode: 'es', lesson: 1, target: 'Buenas noches',         pronunciation: 'بويناس نوتشيس',      english: 'Good evening / night',        answers: ['Buenas noches'] },
  { id: 4,  languageCode: 'es', lesson: 1, target: '¿Cómo estás?',          pronunciation: 'كومو إسطاس',         english: 'How are you?',                answers: ['¿Cómo estás?', 'Como estas', '¿Como estas?'] },
  { id: 5,  languageCode: 'es', lesson: 1, target: 'Estoy bien',            pronunciation: 'إسطوي بيان',         english: 'I am fine',                   answers: ['Estoy bien'] },
  { id: 6,  languageCode: 'es', lesson: 1, target: 'Estoy cansado/a',       pronunciation: 'إسطوي كانسادو',      english: 'I am tired',                  answers: ['Estoy cansado', 'Estoy cansada', 'Estoy cansado/a'] },
  { id: 7,  languageCode: 'es', lesson: 1, target: 'Tengo sueño',           pronunciation: 'تينغو سويينو',       english: 'I am sleepy',                 answers: ['Tengo sueño', 'Tengo sueno'] },
  { id: 8,  languageCode: 'es', lesson: 1, target: 'Tengo hambre',          pronunciation: 'تينغو أمبري',        english: 'I am hungry',                 answers: ['Tengo hambre'] },
  { id: 9,  languageCode: 'es', lesson: 1, target: 'Tengo sed',             pronunciation: 'تينغو سيد',          english: 'I am thirsty',                answers: ['Tengo sed'] },
  { id: 10, languageCode: 'es', lesson: 1, target: 'Necesito descansar',    pronunciation: 'نيسيسيتو ديسكانسار', english: 'I need to rest',               answers: ['Necesito descansar'] },

  { id: 11, languageCode: 'es', lesson: 2, target: 'Me desperté temprano',  pronunciation: 'مي ديسبيرتي تيمبرانو', english: 'I woke up early',            answers: ['Me desperté temprano', 'Me desperte temprano'] },
  { id: 12, languageCode: 'es', lesson: 2, target: 'Voy al trabajo',        pronunciation: 'بوي أل تراباخو',     english: "I'm going to work",           answers: ['Voy al trabajo'] },
  { id: 13, languageCode: 'es', lesson: 2, target: 'Ya llegué',             pronunciation: 'يا ييغي',            english: 'I arrived',                   answers: ['Ya llegué', 'Ya llegue'] },
  { id: 14, languageCode: 'es', lesson: 2, target: 'Estoy ocupado/a',       pronunciation: 'إسطوي أوكوبادو',     english: 'I am busy',                   answers: ['Estoy ocupado', 'Estoy ocupada', 'Estoy ocupado/a'] },
  { id: 15, languageCode: 'es', lesson: 2, target: 'Espera un momento',     pronunciation: 'إسبيرا أون مومينتو', english: 'Wait a moment',               answers: ['Espera un momento'] },
  { id: 16, languageCode: 'es', lesson: 2, target: 'Ahora vuelvo',          pronunciation: 'أورا بويلفو',        english: "I'll be back",                answers: ['Ahora vuelvo'] },
  { id: 17, languageCode: 'es', lesson: 2, target: 'No entiendo',           pronunciation: 'نو إنتييندو',        english: "I don't understand",          answers: ['No entiendo'] },
  { id: 18, languageCode: 'es', lesson: 2, target: 'Entiendo',              pronunciation: 'إنتييندو',           english: 'I understand',                answers: ['Entiendo'] },
  { id: 19, languageCode: 'es', lesson: 2, target: '¿Puedes repetir?',      pronunciation: 'بوديس ريباتير',      english: 'Can you repeat?',             answers: ['¿Puedes repetir?', 'Puedes repetir'] },
  { id: 20, languageCode: 'es', lesson: 2, target: 'Habla más despacio',    pronunciation: 'آبلا ماس ديسباثيو',  english: 'Speak slower',                answers: ['Habla más despacio', 'Habla mas despacio'] },

  { id: 21, languageCode: 'es', lesson: 3, target: '¿Qué pasó?',            pronunciation: 'كي باسو',            english: 'What happened?',              answers: ['¿Qué pasó?', 'Que paso'] },
  { id: 22, languageCode: 'es', lesson: 3, target: 'No pasa nada',          pronunciation: 'نو باسا نادا',       english: "It's okay / Nothing happened", answers: ['No pasa nada'] },
  { id: 23, languageCode: 'es', lesson: 3, target: 'Tengo un error',        pronunciation: 'تينغو أون إيرور',    english: 'I made a mistake',            answers: ['Tengo un error'] },
  { id: 24, languageCode: 'es', lesson: 3, target: 'Me equivoqué',          pronunciation: 'مي إكيوفوكي',        english: 'I was wrong',                 answers: ['Me equivoqué', 'Me equivoque'] },
  { id: 25, languageCode: 'es', lesson: 3, target: 'Lo siento',             pronunciation: 'لو سيينتو',          english: "I'm sorry",                   answers: ['Lo siento'] },
  { id: 26, languageCode: 'es', lesson: 3, target: 'Perdón',                pronunciation: 'بيردون',             english: 'Sorry / Excuse me',           answers: ['Perdón', 'Perdon'] },
  { id: 27, languageCode: 'es', lesson: 3, target: 'Fue mi culpa',          pronunciation: 'فوي مي كولبا',       english: 'It was my fault',             answers: ['Fue mi culpa'] },
  { id: 28, languageCode: 'es', lesson: 3, target: 'No fue mi culpa',       pronunciation: 'نو فوي مي كولبا',    english: "It wasn't my fault",          answers: ['No fue mi culpa'] },
  { id: 29, languageCode: 'es', lesson: 3, target: 'Estoy nervioso/a',      pronunciation: 'إسطوي نيرفيوسّو',    english: 'I am nervous',                answers: ['Estoy nervioso', 'Estoy nerviosa', 'Estoy nervioso/a'] },
  { id: 30, languageCode: 'es', lesson: 3, target: 'Estoy enojado/a',       pronunciation: 'إسطوي إينوخادو',     english: 'I am angry',                  answers: ['Estoy enojado', 'Estoy enojada', 'Estoy enojado/a'] },

  { id: 31, languageCode: 'es', lesson: 4, target: 'Estoy frustrado/a',     pronunciation: 'إسطوي فروسترا دو',   english: 'I am frustrated',             answers: ['Estoy frustrado', 'Estoy frustrada', 'Estoy frustrado/a'] },
  { id: 32, languageCode: 'es', lesson: 4, target: 'Necesito calma',        pronunciation: 'نيسيسيتو كالما',     english: 'I need calm',                 answers: ['Necesito calma'] },
  { id: 33, languageCode: 'es', lesson: 4, target: 'Déjame pensar',         pronunciation: 'ديخامي بينسار',      english: 'Let me think',                answers: ['Déjame pensar', 'Dejame pensar'] },
  { id: 34, languageCode: 'es', lesson: 4, target: 'No estoy de acuerdo',   pronunciation: 'نو إسطوي دي أكويردو', english: "I don't agree",              answers: ['No estoy de acuerdo'] },
  { id: 35, languageCode: 'es', lesson: 4, target: 'Tienes razón',          pronunciation: 'تيينيس راثون',       english: "You're right",                answers: ['Tienes razón', 'Tienes razon'] },
  { id: 36, languageCode: 'es', lesson: 4, target: 'No tienes razón',       pronunciation: 'نو تيينيس راثون',    english: "You're not right",            answers: ['No tienes razón', 'No tienes razon'] },
  { id: 37, languageCode: 'es', lesson: 4, target: 'Qué gracioso',          pronunciation: 'كي غراسيوسو',        english: 'How funny',                   answers: ['Qué gracioso', 'Que gracioso'] },
  { id: 38, languageCode: 'es', lesson: 4, target: 'Me hiciste reír',       pronunciation: 'مي إيستيثتي ريير',   english: 'You made me laugh',           answers: ['Me hiciste reír', 'Me hiciste reir'] },
  { id: 39, languageCode: 'es', lesson: 4, target: 'Estoy feliz',           pronunciation: 'إسطوي فيليس',        english: 'I am happy',                  answers: ['Estoy feliz'] },
  { id: 40, languageCode: 'es', lesson: 4, target: 'Me gusta',              pronunciation: 'مي غوستا',           english: 'I like it',                   answers: ['Me gusta'] },

  { id: 41, languageCode: 'es', lesson: 5, target: 'No me gusta',           pronunciation: 'نو مي غوستا',        english: "I don't like it",             answers: ['No me gusta'] },
  { id: 42, languageCode: 'es', lesson: 5, target: 'Qué interesante',       pronunciation: 'كي إنتيريسانتي',     english: 'How interesting',             answers: ['Qué interesante', 'Que interesante'] },
  { id: 43, languageCode: 'es', lesson: 5, target: 'Tengo mucho trabajo',   pronunciation: 'تينغو موتشو تراباخو', english: 'I have a lot of work',       answers: ['Tengo mucho trabajo'] },
  { id: 44, languageCode: 'es', lesson: 5, target: 'Estoy ocupado hoy',     pronunciation: 'إسطوي أوكوبادو أوي', english: 'I am busy today',             answers: ['Estoy ocupado hoy', 'Estoy ocupada hoy'] },
  { id: 45, languageCode: 'es', lesson: 5, target: 'Necesito ayuda',        pronunciation: 'نيسيسيتو أيودا',     english: 'I need help',                 answers: ['Necesito ayuda'] },
  { id: 46, languageCode: 'es', lesson: 5, target: 'Gracias por tu ayuda',  pronunciation: 'غراسياس بور تو أيودا', english: 'Thanks for your help',      answers: ['Gracias por tu ayuda'] },
  { id: 47, languageCode: 'es', lesson: 5, target: 'No hay problema',       pronunciation: 'نو آي بروبليما',     english: 'No problem',                  answers: ['No hay problema'] },
  { id: 48, languageCode: 'es', lesson: 5, target: 'Todo está bien',        pronunciation: 'تودو إسطا بيان',     english: 'Everything is fine',          answers: ['Todo está bien', 'Todo esta bien'] },
  { id: 49, languageCode: 'es', lesson: 5, target: 'Estoy listo/a',         pronunciation: 'إسطوي ليستو',        english: 'I am ready',                  answers: ['Estoy listo', 'Estoy lista', 'Estoy listo/a'] },
  { id: 50, languageCode: 'es', lesson: 5, target: 'Vamos',                 pronunciation: 'باموس',              english: "Let's go",                    answers: ['Vamos'] }
];

// Optional friendly titles per lesson number. If a lesson number has no
// entry here, the UI just falls back to "Lesson N" — adding sentences to
// a new lesson number never requires touching this map.
const LESSON_TITLES = {
  1: 'Greetings & Feelings',
  2: 'Morning & Work',
  3: 'Mistakes & Apologies',
  4: 'Opinions & Emotions',
  5: 'Wrapping Up'
};
