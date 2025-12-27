import { Utils } from './src/utils/index.js';

// Mock Data representing the new layout
const deck = [
    {
        front: "Whispering\n\nThe <b>whispering</b> palms...",
        back: "[English Translation]",
        start: 10
    },
    {
        front: "Quotes\n\nHe said \"Hello\" to the <b>quotes</b>.",
        back: "Translation with, comma",
        start: 20
    }
];

console.log("Testing CSV Generation...");
const csv = Utils.generateCSV(deck);

console.log("--- OUTPUT START ---");
console.log(csv);
console.log("--- OUTPUT END ---");

// Validation Logic
const lines = csv.split('\n').filter(l => l.length > 0);
if (lines.length !== 3) { // Header + 2 rows
    console.error("FAIL: Expected 3 lines, got " + lines.length);
    // Note: properly escaped newlines inside quotes should NOT split the row in a CSV parser, 
    // but simple split('\n') might see them. 
    // Let's see how Utils.escapeCsv handles it. 
    // If it uses "...", Excel/Anki respects the newline inside.
} else {
    console.log("PASS: Line count looks correct (assuming regex split usually used for CSV)");
}

// Check for correct quoting
if (csv.includes('"Whispering\n\nThe <b>whispering</b> palms..."')) {
    console.log("PASS: Multiline Front field correctly quoted.");
} else {
    console.error("FAIL: Multiline Front field NOT correctly quoted.");
}
