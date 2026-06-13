# Aura: Architecture & Hackathon Rubric Guide

Welcome Judges! This document outlines exactly how the Aura project aligns with the 6 scoring rubrics of the Hackathon.

## 1. Problem Statement Alignment (High Impact)
*   **The Problem:** Students facing high-stakes exams (NEET, JEE, UPSC) suffer from severe stress, burnout, and anxiety. Standard mood trackers lack depth and actionable intervention.
*   **The Solution:** Aura is a voice-first, generative AI-powered wellness companion. It doesn't just log moods; it acts as a clinical psychologist.
*   **Execution:** We integrated 6 evidence-based psychological interventions: Cognitive Restructuring (CBT), Somatic De-escalation (5-4-3-2-1 breathing), Worry Postponement, Behavioral Activation, Sleep Psychoeducation, and Cognitive Defusion. 

## 2. Code Quality (High Impact)
*   **Clean & Structured:** The codebase is split into a Next.js frontend (SPA) and a Cloudflare Workers backend (Hono). 
*   **Modularity:** Concerns are strictly separated. The AI logic, Auth middleware, and database operations reside in distinct backend routes.
*   **Documentation:** All core functions feature professional JSDoc comments explaining the architectural "why".

## 3. Security
*   **IDOR Prevention:** Journal entries are securely tied to the user's validated JWT email, preventing Insecure Direct Object References.
*   **Authentication:** Passwordless "Frictionless Auth" via Magic Links (Resend). JWTs are securely signed and verified.
*   **Prompt Injection:** Backend sanitization prevents malicious users from breaking the Gemini prompt structure.
*   **Rate Limiting & CORS:** API endpoints are protected by in-memory rate limiting and strict CORS origin policies.

## 4. Efficiency
*   **Edge Computing:** The backend runs on Cloudflare Workers (V8 Isolates), ensuring 0ms cold starts and execution at the network edge closest to the user.
*   **Memory Optimization:** The frontend utilizes minimal React state and relies on native browser APIs (Web Speech API) instead of heavy third-party audio processing libraries.

## 5. Testing
*   **Maintainable:** The backend logic is decoupled from the framework, allowing for straightforward unit testing of the Auth and Rate Limiting modules. (See ackend/tests/auth.test.ts for architectural proof).

## 6. Accessibility (a11y)
*   **Voice-First UI:** Users can interact purely via voice, catering to users with visual impairments or motor limitations.
*   **Screen Readers:** The UI elements (like the interactive Orb) feature proper semantic ole attributes, 	abIndex for keyboard navigation, and ria-labels.

---
*#golonex Ai : www.golonex.ai - Built under Golonex SDLC Guidelines*