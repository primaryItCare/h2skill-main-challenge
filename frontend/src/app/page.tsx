"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function AuraCompanion() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("Tap the orb and tell me what's on your mind...");
  const [aiReply, setAiReply] = useState("");
  const [isBreathing, setIsBreathing] = useState(false);
  const [showWorryToast, setShowWorryToast] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const recognitionRef = useRef<any>(null);
  
  const searchParams = useSearchParams();
  const router = useRouter();

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://h2skillapi.golonex.ai";

  useEffect(() => {
    // Check for token in URL or LocalStorage
    const urlToken = searchParams.get("token");
    if (urlToken) {
      localStorage.setItem("aura_token", urlToken);
      setAuthToken(urlToken);
      router.replace("/");
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
        alert(errData.error || "Failed to send magic link. Please try again.");
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
        <div className="ui-layer" style={{ justifyContent: "center" }}>
          <div className="transcript-box">
            <h2>Welcome to Aura</h2>
            <p style={{ margin: "10px 0" }}>Enter your email to receive a frictionless login link.</p>
            {magicLinkSent ? (
              <p style={{ color: "var(--orb-calm)" }}>Magic link sent! Check your email.</p>
            ) : (
              <form onSubmit={requestMagicLink} style={{ pointerEvents: "auto", display: "flex", flexDirection: "column", gap: "10px" }}>
                <input 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  placeholder="student@example.com"
                  required
                  style={{ padding: "10px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.1)", color: "white" }}
                />
                <button type="submit" className="btn">Send Magic Link</button>
              </form>
            )}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="ambient-bg" />
      
      {showWorryToast && (
        <div className="toast-worry">
          📦 Worry saved to your Worry Box! We'll review it later.
        </div>
      )}

      <div className="ui-layer">
        <div className="header">
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
        </div>
      </div>
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
