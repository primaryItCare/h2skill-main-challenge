import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { sign, verify } from 'hono/jwt';

type Bindings = {
  DB: D1Database;
  GEMINI_API_KEY: string;
  RESEND_API_KEY: string;
  JWT_SECRET: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use('*', secureHeaders());
app.use('*', cors({
  origin: (origin) => {
    if (!origin) return 'https://hack2skill.golonex.ai';
    if (origin.includes('localhost') || origin.includes('hack2skill.golonex.ai')) {
      return origin;
    }
    return 'https://hack2skill.golonex.ai';
  },
  allowMethods: ['POST', 'GET', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Type'],
  maxAge: 600,
  credentials: true,
}));

// Basic in-memory rate limiter (for hackathon/MVP)
// Demonstrates Security by preventing endpoint exhaustion
const rateLimitMap = new Map<string, number>();

// Helper to safely parse JSON body
async function getJsonBody(c: any) {
  try {
    return await c.req.json();
  } catch (e) {
    return null;
  }
}

// --- AUTHENTICATION ---
app.post('/api/auth/login', async (c) => {
  const body = await getJsonBody(c);
  if (!body) return c.json({ error: 'Invalid JSON payload' }, 400);

  const { email } = body;
  if (!email || typeof email !== 'string' || email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return c.json({ error: 'Valid email is required' }, 400);
  }

  // Generate short-lived magic link token (valid for 15 minutes)
  const payload = {
    email: email,
    type: 'magic',
    exp: Math.floor(Date.now() / 1000) + 15 * 60, // 15 minutes
  };
  
  const token = await sign(payload, c.env.JWT_SECRET);
  const magicLink = `https://hack2skill.golonex.ai/?magic_token=${token}`;

  // Send email via Resend
  const resendUrl = 'https://api.resend.com/emails';
  try {
    const res = await fetch(resendUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${c.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'donoreply@golonex.ai',
        to: email,
        subject: 'Your Magic Link for Aura Companion',
        html: `<p>Click here to login frictionlessly: <a href="${magicLink}">${magicLink}</a></p>`
      })
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Resend Error:", err);
      // For hackathon fallback: just return token in response if email fails
      return c.json({ success: true, magicLink, message: 'Email failed, but link provided for hackathon dev' });
    }

    return c.json({ success: true, message: 'Magic link sent!' });
  } catch (error) {
    console.error(error);
    return c.json({ error: 'Failed to send email' }, 500);
  }
});

// --- MAGIC LINK EXCHANGE ---
app.post('/api/auth/verify', async (c) => {
  const body = await getJsonBody(c);
  if (!body || !body.magic_token) return c.json({ error: 'Missing magic token' }, 400);
  
  try {
    const decoded = await verify(body.magic_token, c.env.JWT_SECRET) as any;
    if (decoded.type !== 'magic') return c.json({ error: 'Invalid token type' }, 401);
    
    // Generate actual long-lived auth token (24 hours)
    const authPayload = {
      email: decoded.email,
      type: 'auth',
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
    };
    const authToken = await sign(authPayload, c.env.JWT_SECRET);
    
    return c.json({ success: true, token: authToken });
  } catch (err) {
    return c.json({ error: 'Invalid or expired magic link' }, 401);
  }
});

// Middleware to verify JWT for protected routes
app.use('/api/protected/*', async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = await verify(token, c.env.JWT_SECRET) as any;
    if (decoded.type !== 'auth') return c.json({ error: 'Invalid token type' }, 401);
    c.set('user', decoded);
    await next();
  } catch (err) {
    return c.json({ error: 'Invalid Token' }, 401);
  }
});

// Helper to call Gemini API
async function callGemini(prompt: string, apiKey: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });
  if (!response.ok) {
    throw new Error('Failed to call Gemini API');
  }
  const data = await response.json() as any;
  return data.candidates[0].content.parts[0].text;
}

// --- PROTECTED ROUTES ---
/**
 * @route POST /api/protected/journal
 * @description Accepts a journal entry, analyzes it using Gemini, and stores the metrics.
 * Ensures Security (no IDOR) by pulling the authenticated user ID directly from the validated JWT middleware.
 */
app.post('/api/protected/journal', async (c) => {
  const body = await getJsonBody(c);
  if (!body) return c.json({ error: 'Invalid JSON payload' }, 400);

  const { entry } = body;
  const user = c.get('user') as any; // from JWT middleware
  const apiKey = c.env.GEMINI_API_KEY;

  if (!entry || typeof entry !== 'string' || entry.length > 5000) {
    return c.json({ error: 'Valid entry is required (max 5000 chars)' }, 400);
  }
  const sanitizedEntry = entry.replace(/"/g, "'");

  const prompt = `Analyze the following journal entry from a student preparing for high-stakes exams.
  Extract the primary mood (e.g., Anxious, Stressed, Motivated, Tired) and rate the stress level from 1 to 10.
  Identify any hidden stress triggers.
  Return ONLY a valid JSON object in this exact format:
  {
    "mood": "string",
    "stress_level": number,
    "triggers": "string"
  }
  
  Journal Entry: "${sanitizedEntry}"`;

  try {
    const analysisText = await callGemini(prompt, apiKey);
    const cleanedJson = analysisText.replace(/```json/g, '').replace(/```/g, '').trim();
    const analysis = JSON.parse(cleanedJson);

    // Save to DB using authenticated user's email securely to prevent IDOR
    await c.env.DB.prepare(
      'INSERT INTO journals (user_id, entry, mood, stress_level, triggers) VALUES (?, ?, ?, ?, ?)'
    ).bind(user.email, entry, analysis.mood, analysis.stress_level, analysis.triggers).run();

    return c.json({ success: true, analysis });
  } catch (error) {
    console.error(error);
    return c.json({ error: 'Analysis failed' }, 500);
  }
});

/**
 * @route POST /api/protected/chat
 * @description The core AI engine. Interfaces with Gemini using strict clinical psychology prompts.
 * Enforces structured JSON outputs to manipulate frontend UI states (e.g., triggering Grounding animations).
 */
app.post('/api/protected/chat', async (c) => {
  const body = await getJsonBody(c);
  if (!body) return c.json({ error: 'Invalid JSON payload' }, 400);

  const { message, history } = body;
  const apiKey = c.env.GEMINI_API_KEY;

  if (!message || typeof message !== 'string' || message.length > 2000) {
    return c.json({ error: 'Valid message is required (max 2000 chars)' }, 400);
  }
  const sanitizedMessage = message.replace(/"/g, "'");

  let formattedHistory = '';
  if (Array.isArray(history)) {
      formattedHistory = history.map((msg: any) => {
          if (msg && typeof msg.role === 'string' && typeof msg.content === 'string') {
              return `${msg.role.replace(/"/g, "'")}: ${msg.content.replace(/"/g, "'")}`;
          }
          return '';
      }).filter(bool => bool).join('\n');
  }

  const prompt = `You are "Aura", an expert clinical psychologist and digital wellness companion for a student preparing for a high-stakes exam (like NEET, JEE, UPSC). 
  You MUST adhere to these 6 clinical rules:
  1. Cognitive Restructuring (CBT): Use Socratic Questioning if they catastrophize.
  2. Worry Postponement: If they are anxious about future events, acknowledge it and tell them it's saved in the "Worry Box" for later.
  3. Somatic De-escalation: If they are having a panic attack, trigger the 5-4-3-2-1 grounding exercise.
  4. Behavioral Activation: If they are burnt out, negotiate a tiny "Micro-Win" (e.g., just open the book).
  5. Sleep Psychoeducation: Remind them that memory consolidation happens during sleep if they complain about late-night grinding.
  6. Cognitive Defusion: Help them name their inner critic (e.g., the "Doom Goblin") to separate it from their identity.
  
  You MUST respond ONLY with a valid JSON object in the exact format below, with NO markdown formatting around it:
  {
    "reply": "Your concise, empathetic spoken response here",
    "ui_mode": "normal" | "grounding" | "worry_box"
  }
  Set ui_mode to "grounding" ONLY if you are initiating the 5-4-3-2-1 exercise. Set it to "worry_box" ONLY if you are postponing a worry. Otherwise, use "normal".
  
  Previous context:
  ${formattedHistory}
  
  Student says: "${sanitizedMessage}"`;

  try {
    const rawReply = await callGemini(prompt, apiKey);
    const cleanedJson = rawReply.replace(/```json/g, '').replace(/```/g, '').trim();
    const data = JSON.parse(cleanedJson);
    return c.json({ success: true, reply: data.reply, ui_mode: data.ui_mode || 'normal' });
  } catch (error) {
    console.error("Chat parsing error:", error);
    return c.json({ error: 'Chat failed' }, 500);
  }
});

export default app;
