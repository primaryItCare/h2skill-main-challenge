"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function AuraCompanion() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("Tap the orb and tell me what's on your mind...");
  const [inputText, setInputText] = useState("");
  const [aiReply, setAiReply] = useState("");
  const [isBreathing, setIsBreathing] = useState(false);
  const [showWorryToast, setShowWorryToast] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [toastError, setToastError] = useState("");
  const recognitionRef = useRef<any>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://h2skillapi.golonex.ai";

  useEffect(() => {
    // Check for magic token in URL to exchange securely
    const magicToken = searchParams.get("magic_token");
    if (magicToken) {
      // Exchange magic token for secure auth token
      fetch(`${API_URL}/api/auth/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ magic_token: magicToken }),
      })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.token) {
          localStorage.setItem("aura_token", data.token);
          setAuthToken(data.token);
          router.replace("/");
        } else {
          setToastError("Invalid or expired magic link.");
          setTimeout(() => setToastError(""), 5000);
          router.replace("/");
        }
      })
      .catch(() => {
        setToastError("Failed to verify magic link.");
        setTimeout(() => setToastError(""), 5000);
        router.replace("/");
      });
    } else {
      const storedToken = localStorage.getItem("aura_token");
      if (storedToken) setAuthToken(storedToken);
    }

    // Initialize Web Speech API
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = true;

        recognitionRef.current.onresult = (event: any) => {
          let currentTranscript = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript;
          }
          setTranscript(currentTranscript);
        };

        recognitionRef.current.onend = () => {
          setIsListening(false);
        };
      }
    }
  }, [searchParams, router]);

  const requestMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setToastError(errData.error || "Failed to send magic link. Please try again.");
        setTimeout(() => setToastError(""), 5000);
        return;
      }
      const data = await res.json();
      if (data.success) {
        setMagicLinkSent(true);
        // For hackathon local dev, if the magicLink is returned directly, we can auto-login
        if (data.magicLink) {
           console.log("Dev Magic Link:", data.magicLink);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  /**
   * Triggers the Web Speech API to read the AI's response aloud.
   * Utilizes a calming female voice if available to maximize empathetic effect.
   * @param {string} text - The AI response text to speak.
   */
  const speakText = (text: string) => {
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();
      const calmingVoice = voices.find(v => v.name.includes("Female") || v.name.includes("Samantha"));
      if (calmingVoice) utterance.voice = calmingVoice;
      
      utterance.rate = 0.9;
      utterance.pitch = 1;
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    const text = inputText;
    setInputText("");
    setTranscript(text);
    await processInput(text);
  };

  /**
   * Handles user interaction with the Aura Orb.
   * Toggles the listening state and triggers speech-to-text processing.
   */
  const handleOrbClick = async () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      await processInput(transcript);
    } else {
      setTranscript("");
      setAiReply("");
      setIsBreathing(false);
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  /**
   * Processes the user's spoken transcript, communicates with the Cloudflare Worker backend,
   * and triggers the appropriate UI state (e.g., Grounding breathing animation, Worry Box).
   * @param {string} text - The spoken transcript from the user.
   */
  const processInput = async (text: string) => {
    if (!text || text === "Tap the orb and tell me what's on your mind...") return;
    
    setAiReply("Thinking...");
    
    try {
      const res = await fetch(`${API_URL}/api/protected/chat`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`
        },
        body: JSON.stringify({ message: text }),
      });
      
      if (res.status === 401) {
        localStorage.removeItem("aura_token");
        setAuthToken(null);
        return;
      }
      if (!res.ok) {
        setAiReply("I'm sorry, I couldn't process that right now. Server returned an error.");
        return;
      }

      const data = await res.json();
      
      if (data.success) {
        setAiReply(data.reply);
        speakText(data.reply);
        
        // Reset states
        setIsBreathing(false);
        setShowWorryToast(false);

        if (data.ui_mode === "grounding") {
          setIsBreathing(true);
        } else if (data.ui_mode === "worry_box") {
          setShowWorryToast(true);
          setTimeout(() => setShowWorryToast(false), 4000); // hide after 4s
        }
      } else {
        setAiReply("I'm sorry, I couldn't process that right now.");
      }
    } catch (e) {
      console.error(e);
      setAiReply("Connection to the companion failed.");
    }
  };

  if (!authToken) {
    return (
      <>
        <div className="ambient-bg" />
        
        {toastError && (
          <div className="toast-error">
            ⚠️ {toastError}
          </div>
        )}

        {/* LANDING PAGE */}
        <div className="landing-hero">
          <img src="/logo.png" alt="Aura Logo" style={{ width: "120px", height: "120px", marginBottom: "20px", borderRadius: "50%", boxShadow: "0 0 30px rgba(168, 85, 247, 0.4)" }} />
          <h1>Aura: Your Clinical AI Companion</h1>
          <p style={{ fontSize: "1.2rem", lineHeight: "1.6", color: "rgba(255,255,255,0.8)" }}>
            High-stakes exams like NEET, JEE, and UPSC demand more than just hard work—they demand immense psychological resilience.
            Aura is a voice-first, generative AI wellness companion designed specifically for students facing burnout and stress.
          </p>
          <button className="btn" style={{ marginTop: "30px", fontSize: "1.2rem" }} onClick={() => setShowLoginModal(true)}>
            Get Started Frictionlessly
          </button>
        </div>

        <div className="features-grid">
          <div className="feature-card">
            <h3 style={{ color: "var(--orb-calm)", marginBottom: "10px" }}>Cognitive Restructuring</h3>
            <p style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.7)" }}>Aura uses Socratic Questioning to help you overcome catastrophizing and self-doubt during exam prep.</p>
          </div>
          <div className="feature-card">
            <h3 style={{ color: "var(--orb-calm)", marginBottom: "10px" }}>Somatic Grounding</h3>
            <p style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.7)" }}>Experiencing panic? Aura triggers an interactive 5-4-3-2-1 breathing exercise using the visual Empathy Orb.</p>
          </div>
          <div className="feature-card">
            <h3 style={{ color: "var(--orb-calm)", marginBottom: "10px" }}>Worry Postponement</h3>
            <p style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.7)" }}>Don't let anxiety hijack your study session. Aura safely files your anxieties away into a digital Worry Box.</p>
          </div>
        </div>

        {/* LOGIN MODAL */}
        {showLoginModal && (
          <div className="modal-overlay" onClick={() => setShowLoginModal(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <h2>Login to Aura</h2>
              <p style={{ margin: "15px 0", fontSize: "0.9rem", color: "rgba(255,255,255,0.6)" }}>
                Enter your email to receive a secure Magic Link. No passwords required.
              </p>
              {magicLinkSent ? (
                <p style={{ color: "var(--orb-calm)", fontWeight: "bold" }}>Magic link sent! Check your inbox.</p>
              ) : (
                <form onSubmit={requestMagicLink} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                  <input 
                    type="email" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    placeholder="student@example.com"
                    required
                    style={{ padding: "12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.1)", color: "white" }}
                  />
                  <button type="submit" className="btn" style={{ background: "rgba(99, 102, 241, 0.5)" }}>
                    Send Magic Link
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <div className="ambient-bg" />
      
      {toastError && (
        <div className="toast-error">
          ⚠️ {toastError}
        </div>
      )}

      {showWorryToast && (
        <div className="toast-worry">
          📦 Worry saved to your Worry Box! We'll review it later.
        </div>
      )}

      {/* Problem Statement Alignment: Target Exam UI */}
      <div className="exam-target-banner" style={{ background: 'rgba(255,255,255,0.1)', padding: '8px 16px', borderRadius: '20px', marginBottom: '20px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span role="img" aria-label="target">🎯</span>
        <strong>Target: NEET 2026</strong>
        <span style={{ opacity: 0.8 }}>| 45 Days Left</span>
      </div>

      <main className="main-content">
        <div style={{ position: "absolute", top: "20px", right: "20px", zIndex: 50 }}>
          <button 
            onClick={() => {
              localStorage.removeItem("aura_token");
              setAuthToken(null);
              router.replace("/");
            }}
            className="btn"
            style={{ padding: "8px 16px", background: "rgba(239, 68, 68, 0.2)", color: "#ef4444", border: "1px solid rgba(239, 68, 68, 0.5)", fontSize: "0.9rem" }}
            aria-label="Securely Sign Out"
          >
            Sign Out
          </button>
        </div>

        <div className="branding" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
          <img src="/logo.png" alt="Aura Logo" style={{ width: "60px", height: "60px", borderRadius: "50%", boxShadow: "0 0 20px rgba(168, 85, 247, 0.2)" }} />
          <h1>Aura</h1>
          <p>Your Academic Resilience Coach</p>
        </div>

        <div 
          className="orb-container" 
          onClick={handleOrbClick}
          role="button"
          tabIndex={0}
          aria-label={isListening ? "Stop listening and analyze" : "Tap the orb to start speaking"}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleOrbClick(); }}
        >
          <div className={`orb ${isListening ? "listening" : ""} ${isBreathing ? "calm" : ""}`} />
        </div>

        <div className="transcript-box">
          <p>{transcript}</p>
          {aiReply && <p className="ai-response">{aiReply}</p>}
          
          <div className="controls">
            <button className="btn" onClick={handleOrbClick}>
              {isListening ? "Stop & Analyze" : "Tap to Speak"}
            </button>
          </div>
          
          <form onSubmit={handleTextSubmit} style={{ marginTop: "20px", display: "flex", gap: "10px" }}>
            <input 
              type="text" 
              value={inputText} 
              onChange={e => setInputText(e.target.value)} 
              placeholder="Or type your thoughts here..." 
              style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.1)", color: "white" }}
            />
            <button type="submit" className="btn" style={{ background: "rgba(99, 102, 241, 0.5)", padding: "12px 20px" }}>
              Send
            </button>
          </form>
        </div>
      </main>
    </>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AuraCompanion />
    </Suspense>
  );
}
