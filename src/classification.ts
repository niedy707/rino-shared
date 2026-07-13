/**
 * Bir takvim etkinliğinin ameliyat sayılması için TÜMÜ gereklidir:
 *   1. 🔪 emoji içermeli
 *   2. Süre >= 60 dakika olmalı
 *   3. Renk KIRMIZI (colorId=11) olmamalı
 *   4. ℹ️ içermemeli
 *   5. Hariç tutma kelimeleri içermemeli:
 *      ERT, ERTELEME, İPT, İPTAL, İZİN, KONGRE, XXX, TOPLANTI, BOŞLUK
 *      (Türkçe karakter + büyük/küçük harf bağımsız)
 *   6. Temizlenmiş isim >= 2 kelime olmalı
 */
export function categorizeEvent(
    title: string,
    color?: string,
    start?: Date | string,
    end?: Date | string
): 'surgery' | 'checkup' | 'appointment' | 'blocked' | 'ignore' | 'info' {

    // Türkçe karakter + büyük/küçük harf normalize
    const tNorm = title.normalize('NFC').toLocaleLowerCase('tr-TR')
        .replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ö/g, 'o')
        .replace(/ü/g, 'u').replace(/ı/g, 'i').replace(/ğ/g, 'g')
        .replace(/İ/g, 'i');

    // ── KURAL 3: Kırmızı renk → iptal/ertelendi ───────────────────────────────
    if (color === '#dc2127' || color === '#DC2127' || color === '11') {
        return 'ignore';
    }

    // ── KURAL 4: ℹ️ sembolü → bilgi notu ──────────────────────────────────────
    if (title.includes('ℹ️') || title.includes('ℹ')) {
        return 'info';
    }

    // ── KURAL 5: Hariç tutma kelimeleri ───────────────────────────────────────
    // KURAL: Tüm erteleme/iptal kelimeleri TAM KELIME olarak eşleşmeli (\b...\b).
    //   ✅ "ert"      → tam kelime → yakalanır
    //   ✅ "erteleme" → tam kelime → yakalanır
    //   ✅ "ipt"      → tam kelime → yakalanır
    //   ❌ "roberta"  → 'ert' ortada → GEÇER
    //   ❌ "erta"     → 'ert' başta ama tam kelime değil → GEÇER
    //   ❌ "expert"   → 'ert' sonda → GEÇER
    const EXCLUSION_EXACT  = ['ert', 'erteleme', 'ertelendi', 'ipt', 'iptal', 'iptall'];
    const EXCLUSION_SUBSTR = ['izin', 'kongre', 'xxx', 'toplanti', 'bosluk'];
    if (EXCLUSION_EXACT.some(kw => new RegExp(`\\b${kw}\\b`).test(tNorm))) {
        return 'ignore';
    }
    if (EXCLUSION_SUBSTR.some(kw => tNorm.includes(kw))) {
        return 'ignore';
    }

    // ── KURAL 1: 🔪 YOK → ameliyat değil ────────────────────────────────────
    if (!title.includes('🔪')) {
        // K/K1/K2 prefix → kontrol muayenesi
        if (/^k\d*\s/i.test(title.trim())) return 'checkup';
        // Nm (1m, 3m, 1.5m) → kontrol
        if (/^\d+\.?\d*m\s/i.test(title)) return 'checkup';
        if (tNorm.includes('kontrol') || /^op\s/i.test(title)) return 'checkup';
        // M prefix / muayene / online → randevu
        if (/^[mM]\s/.test(title) || tNorm.includes('muayene') || tNorm.includes('online')) return 'appointment';
        return 'appointment';
    }

    // ── KURAL 2: Süre >= 60 dk ────────────────────────────────────────────────
    if (start && end) {
        const s = typeof start === 'string' ? new Date(start) : start;
        const e = typeof end   === 'string' ? new Date(end)   : end;
        const durationMinutes = (e.getTime() - s.getTime()) / (1000 * 60);
        if (durationMinutes < 60) return 'appointment';
    }

    // ── KURAL 6: Temizlenmiş isim >= 2 kelime ────────────────────────────────
    const cleanedName = cleanDisplayName(title);
    if (cleanedName.trim().split(/\s+/).filter(Boolean).length < 2) {
        return 'appointment';
    }

    // ── Tüm kriterler sağlandı → AMELİYAT ✅ ─────────────────────────────────
    return 'surgery';
}

// calculateControlLabel → ./controlDuration.ts'e taşındı (tek doğru kaynak, tüm projelerle senkron).

/**
 * Normalizes patient names by removing noise (titles, dates, phone numbers, specific keywords).
 * Implements user-specified rules:
 * - Case/Char insensitive (Turkish support)
 * - Remove 'tel' + numbers
 * - Remove 'yas'/'yaş' + numbers
 * - Remove specific keywords and everything after ('yabancı', 'ortak', 'rino', 'kosta', 'revizyon'...)
 */
export function normalizeName(name: string): string {
    let n = name.normalize('NFC').toLocaleLowerCase('tr-TR');

    // 1. Remove "tel" and digits (and common separators)
    n = n.replace(/tel\s*[:.]?\s*[\d\s]+/gi, ' ');

    // 2. Remove "yas"/"yaş" and digits
    n = n.replace(/(yas|yaş)\s*[:.]?\s*\d+/gi, ' ');

    // 3. Cut off from specific keywords to the end
    n = n.replace(/(yabancı|ortak|rino|kosta|revizyon|sekonder|septorin|tiplasti|kbb|implant|iy\s|İy\s).*$/gi, '');

    // 4. Standard cleanups
    n = n.replace(/iptal/gi, ' ')
        .replace(/🔪/g, ' ')
        .replace(/\([^)]*\)/g, ' ')
        .replace(/\d{1,2}[:.]\d{2}/g, ' '); // clocks

    // 5. Turkish char normalization aliases
    n = n.replace(/ı/g, 'i')
        .replace(/ş/g, 's')
        .replace(/ç/g, 'c')
        .replace(/ö/g, 'o')
        .replace(/ü/g, 'u')
        .replace(/ğ/g, 'g');

    // 6. Remove remaining non-word chars (but KEEP unicode letters)
    n = n.replace(/[^\p{L}\s\d]/gu, ' ');

    // Saygı unvanları da key'den çıkarılır (miss, mr, mrs, ms, prof)
    const ignoredWords = new Set(['anestezi', 'pcr', 'yenidogan', 'yatis', 'yatış', 'plasti', 'plasty', 'op', 'bilgi', 'formu', 'hazırlık', 'dosya', 'dr', 'protokol', 've', 'iy', 'miss', 'mr', 'mrs', 'ms', 'prof']);

    return n.trim().split(/\s+/)
        .filter(w => w.length > 1 && !ignoredWords.has(w))
        .map(w => w.charAt(0).toLocaleUpperCase('tr-TR') + w.slice(1))
        .join(' ');
}

/**
 * Cleans the display name for storage and UI while preserving original characters and case.
 * Rules:
 * - Remove emoji 🔪
 * - Remove time patterns (e.g. 09:00, 14.30)
 * - Remove parentheses and their content: (abc)
 * - Remove standalone word "iy" (case-insensitive)
 * - Remove "tel" or "telefon" followed by digits
 * - Remove "yas" or "yaş" followed by a 2-digit age
 * - Remove specific keywords: Kosta, kostalı, rino, revizyon, ortak, vaka
 * - PRESERVE: 🎂YYYY birth-year annotations (e.g. 🎂2002)
 * - PRESERVE: [Rev1], [Rev2] revision tags
 */
export function cleanDisplayName(name: string): string {
    let n = name.normalize('NFC');

    // 0. Extract preserved suffixes (🎂YYYY and [RevN]) before cleaning
    const cakeMatch = n.match(/\s*(🎂\S*)/);
    const revMatch = n.match(/\s*(\[Rev\d+\])/);
    const cakeSuffix = cakeMatch ? cakeMatch[1] : '';
    const revSuffix = revMatch ? revMatch[1] : '';
    if (cakeSuffix) n = n.replace(cakeMatch![0], '');
    if (revSuffix) n = n.replace(revMatch![0], '');

    // 1. KURAL: 🔪 varsa → önceki her şey (saat, prefix) isim değildir.
    //    Sadece 🔪 SONRASINI al.
    if (n.includes('🔪')) {
        n = n.substring(n.indexOf('🔪') + '🔪'.length);
    } else {
        n = n.replace(/[\u{1F000}-\u{1FFFF}]/gu, ' ');
    }

    // 1b. Saat kalıbı: "08:00", "08.00"
    n = n.replace(/\d{1,2}[:.]\d{2}/g, ' ');

    // 2. Remove parentheses and content
    n = n.replace(/\([^)]*\)/g, ' ');

    // 3. Remove "tel/telefon" + optional "no" + numbers (e.g. "tel no 05344878265")
    n = n.replace(/\b(tel|telefon)\b\s*(no\b)?\s*[:.]?\s*[\d\s]+/gi, ' ');
    // 3a. Also remove orphan "no" + pure-digit string left over (e.g. "No 05344878265")
    n = n.replace(/\bno\b\s+[\d\s]{6,}/gi, ' ');
    // 3b. Remove bare phone numbers (9+ consecutive digits, with optional spaces) appended to name
    n = n.replace(/\b0?\d[\d\s]{8,}\d\b/g, ' ');

    // 3b. ? işareti → noise'den önce temizle (kosta? → kosta → NOISE)
    n = n.replace(/[?~]/g, '');

    // 4. Remove standalone "yas/yaş" + 2-digit numbers (e.g. "yaş 24", "yas24")
    n = n.replace(/(?<!\p{L})(yas|yaş)(?!\p{L})\s*[:.]?\s*\d{2}/gui, ' ');
    // 4a. Also handle "iy yaş 20" → remove "iy" noise + yaş number combo  
    n = n.replace(/\biy\s+(yas|yaş)\s*\d{0,2}\b/gi, ' ');


    // 4.5. Remove [iy] bracket-prefix
    n = n.replace(/^\s*\[iy\]\s*/i, '');

    // 5. Remove noise keywords (case-insensitive with Turkish locale)
    const noise = ['kosta', 'kostalı', 'kostali', 'rino', 'revizyon', 'rev', 'ortak', 'vaka', 'iy', 'sekonder'];
    n = n.split(/\s+/)
        .filter(word => {
            if (!word) return false;
            const low = word.toLocaleLowerCase('tr-TR')
                .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ç/g, 'c')
                .replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ğ/g, 'g');
            return !noise.includes(low) && !noise.includes(word.toLocaleLowerCase('tr-TR'));
        })
        .join(' ');

    // 5.5. Strip leading comma/punctuation (e.g. ", Hatice Kaya" → "Hatice Kaya")
    n = n.replace(/^[,;.\-/\s]+/, '');

    // NOTE: "|" is intentionally NOT removed — it denotes a separate procedure
    // e.g. "Özge Kaplan | Otoplasti" = same patient, different operation type

    // 6. Title Case Formatting
    const cleaned = n.replace(/\s+/g, ' ').trim()
        .split(' ')
        .map(word => {
            if (!word) return '';
            return word.charAt(0).toLocaleUpperCase('tr-TR') + word.slice(1).toLocaleLowerCase('tr-TR');
        })
        .join(' ');

    // 7. Reattach preserved suffixes
    const extras = [cakeSuffix, revSuffix].filter(Boolean).join(' ');
    return extras ? `${cleaned} ${extras}` : cleaned;
}

export const SURGERY_TAGS = [
    "ATS",
    "Adenoidektomi",
    "Bişektomi",
    "Blefaroplasti",
    "Boyun Eksplorasyonu",
    "Burun Kırığı",
    "Dudak",
    "Epistaksis",
    "FESS",
    "Frenilum-Plasti",
    "Konka RF",
    "Kosta",
    "Kulak",
    "MLS",
    "Mentoplasti",
    "Miringoplasti",
    "Otoplasti",
    "Peritonsillar Apse",
    "Rev.Rinoplasti",
    "Revizyon Otoplasti (Lokal)",
    "Rinoplasti",
    "Septal Perf Onarımı",
    "Septoplasti (SMR)",
    "Sistrunk",
    "Temporal Lift",
    "Timpanoplasti",
    "Tipplasti",
    "Tonsillektomi",
    "Tonsillektomi-Adenoidektomi",
    "Tonsillektomi-Adenoidektomi-VT",
    "Tuboplasti",
    "UPPP (Uvulopalatofaringoplasti)",
    "Ventilasyon Tüpü",
    "Ventilasyon Tüpü Çıkarma",
    "Yabancı Cisim Çıkarma",
];

const mappedTags: Record<string, string> = {
    "ats (açık teknik smr)": "ATS",
    "blef": "Blefaroplasti",
    "boyun eksplorasyonu": "Boyun Eksplorasyonu",
    "burun kemiklerinin kırığı": "Burun Kırığı",
    "frenulum operasyonu": "Frenilum-Plasti",
    "rf": "Konka RF",
    "rf ablasyon": "Konka RF",
    "radyofrekans": "Konka RF",
    "revizyon": "Rev.Rinoplasti",
    "rinoplasti revizyon": "Rev.Rinoplasti",
    "smr": "Septoplasti (SMR)",
    "septoplasti": "Septoplasti (SMR)",
    "septorino": "Rinoplasti",
    "tv-vt": "Tonsillektomi-Adenoidektomi-VT",
    "vt": "Ventilasyon Tüpü",
    "ventilasyon tüpü": "Ventilasyon Tüpü",
    "vt çıkartılması": "Ventilasyon Tüpü Çıkarma",
    "uppp": "UPPP (Uvulopalatofaringoplasti)",
    "otoplasti": "Otoplasti",
};

export function normalizeSurgery(raw: string | undefined): string | undefined {
    if (!raw) return raw;
    const s = raw.trim();
    if (!s) return undefined;

    const lowerS = s.toLowerCase();

    if (lowerS.includes("tonsillektomi") && lowerS.includes("adenoidektomi")) {
        if (lowerS.includes("vt") || lowerS.includes("tüp")) {
            return "Tonsillektomi-Adenoidektomi-VT";
        }
        return "Tonsillektomi-Adenoidektomi";
    }

    if (mappedTags[lowerS]) {
        return mappedTags[lowerS];
    }

    const parts = s.split('+').map(p => p.trim()).filter(p => p.length > 0);
    const newParts = parts.map(part => {
        const lowerPart = part.toLowerCase();
        return mappedTags[lowerPart] !== undefined ? mappedTags[lowerPart] : part;
    });

    const finalized = newParts.map(p => p === 'uPPP' ? 'UPPP (Uvulopalatofaringoplasti)' : p);
    return finalized.join(' + ');
}

/**
 * Takvim etkinliği başlığından ameliyat adını çıkarır.
 *
 * Kurallar (öncelik sırasıyla):
 *   1. Pipe notasyonu: "Ad Soyad | Otoplasti" → "Otoplasti"
 *   2. Keyword tarama (Türkçe karakter + büyük/küçük harf bağımsız)
 *   3. Varsayılan: "Rinoplasti"
 */
export function getSurgeryName(title: string): string {
    // Türkçe normalize
    const t = title.normalize('NFC').toLocaleLowerCase('tr-TR')
        .replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ö/g, 'o')
        .replace(/ü/g, 'u').replace(/ı/g, 'i').replace(/ğ/g, 'g')
        .replace(/İ/g, 'i');

    // 1. Pipe notasyonu → en güvenilir
    if (title.includes('|')) {
        const part = title.split('|')[1].trim();
        if (part.length >= 3) return normalizeSurgery(part) ?? part;
    }

    // 2. Keyword eşlemesi — öncelik sırasına göre
    const rules: [RegExp, string][] = [
        // Revizyon Rinoplasti (rev/revizyon/sekonder + rinoplasti veya tek başına)
        [/revizyon|sekonder/, 'Revizyon Rinoplasti'],
        // Temporal Lift
        [/temporal|sakak/, 'Temporal Lift'],
        // Otoplasti
        [/otoplasti/, 'Otoplasti'],
        // Septoplasti
        [/septoplast|smr/, 'Septoplasti (SMR)'],
        // Blefaroplasti
        [/blefar/, 'Blefaroplasti'],
        // Tipplasti
        [/tipplast|tip plast/, 'Tipplasti'],
        // Mentoplasti
        [/mentoplast|genioplast/, 'Mentoplasti'],
        // FESS
        [/fess|endoskop/, 'FESS'],
    ];

    for (const [pattern, label] of rules) {
        if (pattern.test(t)) return label;
    }

    // 3. Varsayılan
    return 'Rinoplasti';
}

/**
 * @deprecated getSurgeryName() kullanın.
 * Takvim etkinliği başlığından ameliyat türünü çıkarır.
 * Bulunamazsa undefined döner (varsayılan yok).
 */
export function extractSurgeryType(title: string): string | undefined {
    // Pipe notasyonu — en güvenilir kaynak
    if (title.includes('|')) {
        const part = title.split('|')[1].trim();
        if (part.length >= 3) return normalizeSurgery(part);
    }

    const t = title.toLowerCase();
    const map: [RegExp, string][] = [
        [/septorino|septorinoplast/, 'Rinoplasti'],
        [/rinoplast revizyon|revizyon rino|sekonder/, 'Rev.Rinoplasti'],
        [/rinoplast|rhinoplast|rino/, 'Rinoplasti'],
        [/otoplast/, 'Otoplasti'],
        [/septoplast|smr/, 'Septoplasti (SMR)'],
        [/blefar|blef/, 'Blefaroplasti'],
        [/tipplast|tip plast/, 'Tipplasti'],
        [/mentoplast|genioplast/, 'Mentoplasti'],
        [/temporal|sakak/, 'Temporal Lift'],
        [/fess|endoskop/, 'FESS'],
        [/dudak/, 'Dudak'],
        [/kulak|kulağ/, 'Kulak'],
        [/radyofrekans|rf/, 'Konka RF'],
    ];

    for (const [pattern, label] of map) {
        if (pattern.test(t)) return normalizeSurgery(label);
    }

    return undefined;
}
