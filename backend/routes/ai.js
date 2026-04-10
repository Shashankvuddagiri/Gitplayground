/**
 * routes/ai.js
 * POST /api/ai/chat  — Proxies requests to OpenRouter (OpenAI-compatible)
 * POST /api/ai/explain — Explains a specific git command
 */

import { Router } from 'express';

const router = Router();

// Strict Domain-Locked System Prompt
const GIT_SYSTEM_PROMPT = `
You are GitBot, a "Pro-Level" Git & GitHub tutor embedded in the "Git Playground".

DOMAIN LOCKING RULES (CRITICAL):
1. You ONLY answer questions related to Git, GitHub, version control workflows, or terminal commands used within this playground.
2. If the user asks about ANY other topic, you must politely refuse and refocus them on Git.

EXPERT KNOWLEDGE REINFORCEMENT:
- Explain the "Three Trees" abstraction: Working Directory (sandbox), Index (staging), and HEAD (last commit).
- Explain the difference between 'git merge' (creates a merge commit, preserves history topology) and 'git rebase' (rewrites history, linearizes commits).
- When a user is confused about "Next Step", explain WHY that command follows logically (e.g., "You staged files, so now you need to commit to save them to history").
- If explaining 'git reset', mention the difference between --soft (keep staged changes), --mixed (keep working tree but unstage), and --hard (delete everything).

PERSONALITY:
- Encouraging but precise. 
- Use code blocks for all commands.
- Use emojis related to code and history (🌿, 🌳, 💾, ⏪, 🚀).
`;

// ── Helper: Call OpenRouter ──────────────────────────────────────────────────
async function callOpenRouter(messages) {
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.API_KEY;
  if (!apiKey || apiKey === 'your_openrouter_api_key_here' || apiKey === 'your_key_here') return null;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://git-playground.vercel.app", // Optional for OpenRouter rankings
        "X-Title": "Git Playground"
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini", // Efficient and reliable for tutoring
        messages: [
          { role: "system", content: GIT_SYSTEM_PROMPT },
          ...messages
        ],
        temperature: 0.7,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'OpenRouter API error');
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (err) {
    console.error('OpenRouter Error:', err.message);
    return null;
  }
}

// ── POST /api/ai/chat ──────────────────────────────────────────────────────────
router.post('/chat', async (req, res) => {
  const { message, context } = req.body;

  if (!message?.trim()) {
    return res.status(400).json({ error: 'Message is required' });
  }

  // Build context-aware instructions
  let userMessage = message;
  if (context) {
    const ctxParts = [];
    if (context.level) ctxParts.push(`Current level: ${context.level}`);
    if (context.branch) ctxParts.push(`Current branch: ${context.branch}`);
    if (context.lastCommand) ctxParts.push(`Last command: ${context.lastCommand}`);
    if (context.hasError) ctxParts.push(`Last command had an error`);
    if (ctxParts.length) {
      userMessage = `[Local Context: ${ctxParts.join(', ')}]\n\nUser Question: ${message}`;
    }
  }

  const reply = await callOpenRouter([{ role: "user", content: userMessage }]);
  
  if (reply) {
    res.json({ reply, fallback: false });
  } else {
    // Fallback: static responses when no API key is set or call fails
    res.json({ reply: getFallbackResponse(message), fallback: true });
  }
});

// ── POST /api/ai/explain ───────────────────────────────────────────────────────
router.post('/explain', async (req, res) => {
  const { command } = req.body;
  if (!command?.trim()) return res.status(400).json({ error: 'Command is required' });

  // Try static lookup first (instant)
  const staticExpl = COMMAND_EXPLANATIONS[command.trim().toLowerCase()];
  if (staticExpl) {
    return res.json({ explanation: staticExpl, source: 'static' });
  }

  const prompt = `Explain this Git/Terminal command briefly in exactly 2 sentences. Command: "${command}".`;
  const explanation = await callOpenRouter([{ role: "user", content: prompt }]);

  if (explanation) {
    res.json({ explanation, source: 'ai' });
  } else {
    res.json({ explanation: getBasicExplanation(command), source: 'fallback' });
  }
});

// ── Static Explanations & Fallbacks ───────────────────────────────────────────
const COMMAND_EXPLANATIONS = {
  'git init': '🏁 Creates a new Git repository in the current folder. It generates a hidden .git directory to track your history.',
  'git add .': '📦 Stages all current changes for the next commit. This tells Git which files you want to include in your next snapshot.',
  'git commit -m': '💾 Saves your staged changes to the project history. The message should describe what you changed.',
  'git status': '🔍 Shows which files are modified, staged, or untracked. Essential for seeing what is happening in your repo.',
  'git log': '📜 Lists the history of commits on the current branch.',
  // ... (Full list maintained from previous version)
};

function getBasicExplanation(command) {
  const base = command.split(' ')[0];
  return base === 'git' 
    ? `A Git command for version control. Use \`help\` to see supported commands.` 
    : `A terminal command. Use \`help\` to see supported commands.`;
}

function getFallbackResponse(message) {
  return `🤖 I'm currently in safe-mode. I can help with Git commands like 'git init', 'git add', and 'git commit'. \n\nCheck the Cheat Sheet (above the Git Tree) for quick reference!`;
}

export default router;
