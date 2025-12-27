import nlp from 'compromise';
import { removeStopwords, eng, por } from 'stopword';

export const Utils = {
    // ...

    extractVocab: (sentences, lang = 'en') => {
        const vocabDeck = [];
        const seenWords = new Set();

        // Extended stopwords (pronouns, common verbs, numbers)
        // English Extras
        const extraStopwordsEN = [
            'she', 'he', 'it', 'they', 'we', 'you', 'i', 'me', 'him', 'her', 'us', 'them',
            'one', 'two', 'three', 'first', 'second',
            'did', 'do', 'does', 'done', 'doing', 'wont', 'will', 'would', 'could', 'should',
            'is', 'are', 'was', 'were', 'be', 'been', 'being',
            'have', 'has', 'had', 'having',
            'go', 'went', 'gone', 'going',
            'say', 'said', 'says',
            'get', 'got', 'getting',
            'make', 'made', 'making',
            'know', 'knew', 'known', 'knowing',
            'take', 'took', 'taken', 'taking',
            'see', 'saw', 'seen', 'seeing',
            'come', 'came', 'coming',
            'think', 'thought', 'thinking',
            'look', 'looked', 'looking',
            'want', 'wanted', 'wanting',
            'give', 'gave', 'given', 'giving',
            'use', 'used', 'using',
            'find', 'found', 'finding',
            'tell', 'told', 'telling',
            'ask', 'asked', 'asking',
            'work', 'worked', 'working',
            'seem', 'seemed', 'seeming',
            'feel', 'felt', 'feeling',
            'try', 'tried', 'trying',
            'leave', 'left', 'leaving',
            'call', 'called', 'calling',
            'next', 'down', 'up', 'out', 'back', 'just', 'now', 'then', 'here', 'there',
            'the', 'a', 'an', 'and', 'or', 'but', 'if', 'of', 'in', 'on', 'at', 'to', 'from', 'with', 'by', 'for'
        ];

        // Portuguese Extras (Common functional words/verbs that might be missed)
        const extraStopwordsPT = [
            'o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas',
            'e', 'ou', 'mas', 'se', 'por', 'para', 'pelo', 'pela', 'no', 'na', 'nos', 'nas', 'do', 'da', 'dos', 'das',
            'em', 'de', 'com', 'sem', 'sob', 'sobre', 'que',
            'eu', 'tu', 'ele', 'ela', 'nós', 'vós', 'eles', 'elas', 'você', 'vocês',
            'me', 'te', 'se', 'lhe', 'nos', 'vos', 'lhes',
            'meu', 'teu', 'seu', 'nosso', 'vosso',
            'ser', 'estar', 'ter', 'haver', 'foi', 'era', 'é', 'são', 'está', 'estão', 'têm', 'tem', 'tinha',
            'fazer', 'ir', 'vir', 'ver', 'dar', 'dizer',
            'aqui', 'ali', 'lá', 'agora', 'então', 'depois', 'antes', 'hoje', 'ontem', 'amanhã',
            'sim', 'não', 'talvez', 'jamais', 'nunca', 'sempre',
            'muito', 'pouco', 'mais', 'menos'
        ];

        sentences.forEach(sentence => {
            const doc = nlp(sentence.text); // Note: Compromise is mainly English, but tokenization works ok

            // Get terms
            const terms = doc.terms().out('array');

            // Basic cleaning
            const cleanTerms = terms.map(t => t.toLowerCase().replace(/[^a-z0-9áàâãéèêíïóòôõöúçñ]/g, ''));

            // Select Language Stopwords
            let stopList = [];
            if (lang === 'pt' || lang === 'Portuguese' || lang === 'Português') {
                stopList = [...por, ...extraStopwordsPT];
            } else {
                stopList = [...eng, ...extraStopwordsEN];
            }

            const meaningful = removeStopwords(cleanTerms, stopList);

            meaningful.forEach(word => {
                const lowerWord = word.toLowerCase();

                if (word.length < 3) return; // Skip short noise
                if (seenWords.has(lowerWord)) return; // Dedupe

                // Add to deck
                seenWords.add(lowerWord);

                // Highlight word in context
                const regex = new RegExp(`\\b${word}\\b`, 'gi');
                const context = sentence.text.replace(regex, `<b>${word}</b>`);

                // Title Case for front
                const front = word.charAt(0).toUpperCase() + word.slice(1);

                vocabDeck.push({
                    word: lowerWord, // Raw word for translation
                    context: sentence.text, // Full sentence for context-aware translation
                    front: `${front}\n\n${context}`,
                    back: `[English Translation]`,
                    start: sentence.start
                });
            });
        });

        return vocabDeck;
    },

    // Helper to escape CSV fields
    escapeCsv: (text) => {
        if (!text) return "";
        let result = text.replace(/"/g, '""');
        if (result.search(/("|,|\n)/g) >= 0) {
            result = '"' + result + '"';
        }
        return result;
    },

    parseTranscript: (input) => {
        // Check if input is likely JSON
        let isJson = false;
        try {
            JSON.parse(input);
            isJson = true;
        } catch (e) { isJson = false; }

        if (isJson) {
            console.log("YT2Anki: Parsing JSON3 format");
            const data = JSON.parse(input);
            const events = data.events;
            if (!events) return [];

            const lines = [];
            events.forEach(e => {
                if (!e.segs || !e.segs[0]) return;
                const text = e.segs.map(s => s.utf8).join('');
                if (!text || text === '\n') return;

                lines.push({
                    start: e.tStartMs / 1000,
                    dur: e.dDurationMs / 1000,
                    end: (e.tStartMs + (e.dDurationMs || 0)) / 1000,
                    text: Utils.decodeHtml(text).replace(/\n/g, ' ').trim()
                });
            });
            return lines;
        }

        // Fallback to XML parsing
        console.log("YT2Anki: Parsing XML string length:", input.length);
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(input, "text/xml");
        let textNodes = xmlDoc.getElementsByTagName("text");
        if (textNodes.length === 0) {
            textNodes = xmlDoc.getElementsByTagName("p");
        }
        console.log("YT2Anki: Found nodes:", textNodes.length);

        const lines = [];
        for (let i = 0; i < textNodes.length; i++) {
            const node = textNodes[i];
            let start = parseFloat(node.getAttribute("start"));
            if (isNaN(start)) start = parseFloat(node.getAttribute("t")) / 1000;
            if (isNaN(start)) start = 0;

            let dur = parseFloat(node.getAttribute("dur"));
            if (isNaN(dur)) dur = parseFloat(node.getAttribute("d")) / 1000;
            if (isNaN(dur)) dur = 0;

            const text = node.textContent;
            const decodedText = Utils.decodeHtml(text).replace(/\n/g, ' ');

            if (decodedText.trim().length > 0) {
                lines.push({
                    start: start,
                    dur: dur,
                    end: start + dur,
                    text: decodedText
                });
            }
        }
        return lines;
    },

    decodeHtml: (html) => {
        const txt = document.createElement("textarea");
        txt.innerHTML = html;
        return txt.value;
    },

    removeFillerWords: (lines, lang = 'en') => {
        const fillers = {
            'en': ['um', 'uh', 'like', 'you know', 'actually', 'literally', 'so', 'basically', 'i mean', 'right'],
            'pt': ['é', 'hum', 'tipo', 'sabe', 'né', 'então', 'aí', 'tá'],
            'es': ['eh', 'este', 'pues', 'bueno', 'o sea', 'a ver', 'entonces'],
            'auto': ['um', 'uh', 'ah', 'like']
        };

        const targetFillers = fillers[lang] || fillers['auto'];
        // Sort by length desc to remove "you know" before "you"
        targetFillers.sort((a, b) => b.length - a.length);

        const regex = new RegExp(`\\b(${targetFillers.join('|')})\\b`, 'gi');

        return lines.map(line => {
            // Only remove if it doesn't leave the line empty?
            // Replace, then collapse spaces
            let cleaned = line.text.replace(regex, '').replace(/\s+/g, ' ').trim();
            // Capitalization check? Keep original start char case if possible
            return { ...line, text: cleaned };
        }).filter(line => line.text.length > 0);
    },

    // New Function: Combine subtitle segments into full sentences
    combineSegments: (lines) => {
        const combined = [];
        let currentGroup = { text: "", start: 0, end: 0, dur: 0 };

        lines.forEach((line, index) => {
            if (currentGroup.text.length === 0) {
                currentGroup.start = line.start;
            }

            // Append text
            const hasSpace = currentGroup.text.endsWith(" ") || line.text.startsWith(" ");
            currentGroup.text += (hasSpace ? "" : " ") + line.text;
            currentGroup.end = line.end;
            currentGroup.dur += line.dur;

            // Check for sentence endings (. ? !)
            // OR if pauses are huge (> 1.5s gap to next line)
            // OR if group is too long (> 100 chars)
            const isEndOfSentence = /[.?!"]$/.test(line.text.trim());

            let bigPause = false;
            if (index < lines.length - 1) {
                const gap = lines[index + 1].start - line.end;
                if (gap > 1.0) bigPause = true;
            }

            if (isEndOfSentence || bigPause || currentGroup.text.length > 150) {
                // Determine duration for the whole group
                const duration = currentGroup.end - currentGroup.start;

                combined.push({
                    start: currentGroup.start,
                    end: currentGroup.end,
                    dur: duration,
                    text: currentGroup.text.trim()
                });
                // Reset
                currentGroup = { text: "", start: 0, end: 0, dur: 0 };
            }
        });

        // Add remaining
        if (currentGroup.text.length > 0) {
            combined.push({
                start: currentGroup.start,
                end: currentGroup.end,
                dur: currentGroup.end - currentGroup.start,
                text: currentGroup.text.trim()
            });
        }

        return combined;
    },

    alignTranscripts: (source, target) => {
        // Simple alignment based on time overlap
        // If target is empty, we just return source in Front, empty Back
        if (!target || target.length === 0) {
            return source.map(s => ({ front: s.text, back: "" }));
        }

        return source.map(sLine => {
            // Find English line that overlaps the most with this source line
            let bestMatch = null;

            if (target && target.length > 0) {
                // Find candidates that overlap in time
                // sLine.start to sLine.end
                const candidates = target.filter(tLine =>
                    (tLine.start < sLine.end) && (tLine.end > sLine.start)
                );

                if (candidates.length > 0) {
                    // Join them if multiple?
                    bestMatch = candidates.map(c => c.text).join(' ');
                } else if (target.length < source.length && target[0].text === "[Translation Error]") {
                    // special case for translation failure
                    bestMatch = "";
                }
            }

            return {
                front: sLine.text,
                back: bestMatch || ""
            };
        });
    },

    generateCSV: (deck) => {
        let csv = "Front,Back\n";
        deck.forEach(card => {
            csv += `${Utils.escapeCsv(card.front)},${Utils.escapeCsv(card.back)}\n`;
        });
        return csv;
    }
};
