// The never-ending "this or that" Twin quiz. Each answer writes a
// q:<key> dimension into the fingerprint (a => 1, b => 0), which
// lib/matching.ts folds into Thought Twin similarity.
// `field` intentionally matches the #stem / #humanities hashtag dimension.

export type QuizQuestion = {
  key: string;
  tag?: string;       // small label above the pair
  a: { label: string; emoji: string };
  b: { label: string; emoji: string };
};

export const QUIZ: QuizQuestion[] = [
  // --- light ---
  { key: "weather", tag: "Weather", a: { label: "Hot weather", emoji: "☀️" }, b: { label: "Cold weather", emoji: "❄️" } },
  { key: "taste", tag: "Cravings", a: { label: "Sweets", emoji: "🍰" }, b: { label: "Savory", emoji: "🧀" } },
  { key: "clock", tag: "Your hours", a: { label: "Early bird", emoji: "🌅" }, b: { label: "Night owl", emoji: "🌙" } },
  { key: "terrain", tag: "Escape to", a: { label: "Beach", emoji: "🏖️" }, b: { label: "Mountains", emoji: "🏔️" } },
  { key: "brew", tag: "Fuel", a: { label: "Coffee", emoji: "☕" }, b: { label: "Tea", emoji: "🍵" } },
  { key: "story", tag: "A good night", a: { label: "Books", emoji: "📖" }, b: { label: "Films", emoji: "🎬" } },
  { key: "place", tag: "Live in", a: { label: "City", emoji: "🌆" }, b: { label: "Countryside", emoji: "🌾" } },
  { key: "plan", tag: "Your style", a: { label: "Planner", emoji: "🗓️" }, b: { label: "Spontaneous", emoji: "🎲" } },
  { key: "reach", tag: "Reach out by", a: { label: "Texting", emoji: "💬" }, b: { label: "Calling", emoji: "📞" } },
  { key: "energy", tag: "Recharge", a: { label: "Quiet night in", emoji: "🛋️" }, b: { label: "Out with people", emoji: "🎉" } },
  { key: "pace", tag: "Move through life", a: { label: "Fast", emoji: "⚡" }, b: { label: "Slow", emoji: "🐢" } },
  { key: "season", tag: "Best season", a: { label: "Summer", emoji: "🌻" }, b: { label: "Winter", emoji: "⛄" } },

  // --- deeper ---
  { key: "field", tag: "Pulled toward", a: { label: "Humanities", emoji: "📚" }, b: { label: "STEM", emoji: "🔬" } },
  { key: "drive", tag: "I trust", a: { label: "Logic", emoji: "🧮" }, b: { label: "Emotion", emoji: "❤️" } },
  { key: "aim", tag: "I want to", a: { label: "Change the world", emoji: "🚀" }, b: { label: "Understand it", emoji: "🔭" } },
  { key: "value", tag: "I'd choose", a: { label: "Freedom", emoji: "🕊️" }, b: { label: "Security", emoji: "🏛️" } },
  { key: "unit", tag: "Progress is", a: { label: "Individual", emoji: "🧍" }, b: { label: "Collective", emoji: "🤝" } },
  { key: "truth", tag: "Drawn to", a: { label: "The question", emoji: "❓" }, b: { label: "The answer", emoji: "✅" } },
  { key: "risk", tag: "By nature", a: { label: "Risk-taker", emoji: "🎯" }, b: { label: "Cautious", emoji: "🛡️" } },
  { key: "time", tag: "I live in", a: { label: "The future", emoji: "🔮" }, b: { label: "The present", emoji: "🌼" } },
  { key: "make", tag: "I'd rather", a: { label: "Create", emoji: "🎨" }, b: { label: "Curate", emoji: "🗂️" } },
  { key: "belief", tag: "Convinced by", a: { label: "Evidence", emoji: "📊" }, b: { label: "Intuition", emoji: "🌀" } },
  { key: "scale", tag: "Think about", a: { label: "Big ideas", emoji: "🌌" }, b: { label: "Small details", emoji: "🔎" } },
  { key: "world", tag: "At heart", a: { label: "Optimist", emoji: "🌈" }, b: { label: "Realist", emoji: "⚖️" } },
];
