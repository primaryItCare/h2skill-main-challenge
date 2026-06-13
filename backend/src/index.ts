import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { sign, verify } from 'hono/jwt';

type Bindings = {
  DB: D1Database;
  GEMINI_API_KEY: string;
  RESEND_API_KEY: string;
  JWT_SECRET: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use('*', cors());

// --- AUTHENTICATION ---
app.post('/api/auth/login', async (c) => {
  const { email } = await c.req.json();
  if (!email) return c.json({ error: 'Email is required' }, 400);

  // Generate JWT token valid for 24 hours
  const payload = {
    email: email,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // 24 hours
  };
  
  const token = await sign(payload, c.env.JWT_SECRET);
  const magicLink = `https://hack2skill.golonex.ai/?token=${token}`;

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

// Middleware to verify JWT for protected routes
app.use('/api/protected/*', async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = await verify(token, c.env.JWT_SECRET);
    c.set('user', decoded);
    await next();
  } catch (err) {
    return c.json({ error: 'Invalid Token' }, 401);
  }
});

// Helper to call Gemini API
async function callGemini(prompt: string, apiKey: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
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
app.post('/api/protected/chat', async (c) => {
  const { message, history } = await c.req.json();
  const apiKey = c.env.GEMINI_API_KEY;

  if (!message) return c.json({ error: 'Message is required' }, 400);

  let formattedHistory = '';
  if (history && history.length > 0) {
      formattedHistory = history.map((msg: any) => `${msg.role}: ${msg.content}`).join('\n');
  }

  const prompt = `You are "Aura", a highly empathetic, supportive digital wellness companion for a student preparing for a high-stakes exam (like NEET, JEE, UPSC). 
  Your goal is to provide hyper-personalized contextual wellness support, real-time coping strategies, mindfulness exercises, and motivational encouragement. 
  Keep your responses concise (1-3 sentences), warm, and conversational. Do not sound like a robot. Do not use markdown formatting.
  
  Previous context:
  ${formattedHistory}
  
  Student says: "${message}"`;

  try {
    const reply = await callGemini(prompt, apiKey);
    return c.json({ success: true, reply });
  } catch (error) {
    console.error(error);
    return c.json({ error: 'Chat failed' }, 500);
  }
});

export default app;
