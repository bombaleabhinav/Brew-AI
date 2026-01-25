import { useState, useRef, useEffect } from "react";
import { Navigation } from "@/app/components/Navigation";
import { motion, AnimatePresence } from "motion/react";
import { Input } from "@/app/components/ui/input";
import { Button } from "@/app/components/ui/button";
import { Plus, Minus, Github, Activity, AlertTriangle, BookOpen, Upload, Video, Mic, StopCircle, CheckCircle2, BarChart3, Brain } from "lucide-react";
import { analyzeTeamFit, TeamFitResult } from "../services/teamFitService";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { toast } from "sonner";
import { AssemblyAI } from "assemblyai";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer
} from "recharts";

interface AnalysisData {
  confidence: number;
  accuracy: number;
  facialExpression: string;
  bodyLanguage: string;
  detailedFeedback: string;
}

const judges = [
  {
    id: "architect",
    name: "Alex",
    role: "Lead Architect",
    image: "/media/Screenshot 2026-01-24 234830.png",
    color: "bg-blue-500",
    focus: "Technical Debt & Scalability",
    voiceId: "pNInz6obpgDQGcFmaJgB" // Adam
  },
  {
    id: "hr",
    name: "Samantha",
    role: "HR Strategy",
    image: "/media/Screenshot 2026-01-24 234834.png",
    color: "bg-purple-500",
    focus: "Team Dynamics & Culture",
    voiceId: "EXAVITQu4vr4xnSDxMaL" // Bella
  },
  {
    id: "product",
    name: "Jordan",
    role: "Product Lead",
    image: "/media/Screenshot 2026-01-24 234839.png",
    color: "bg-green-500",
    focus: "Market Fit & MVP",
    voiceId: "onwK4e9ZLuTAKqWqbcX1" // Charlie
  },
  {
    id: "pm",
    name: "Riley",
    role: "Project Manager",
    image: "/media/Screenshot 2026-01-24 234842.png",
    color: "bg-orange-500",
    focus: "Timelines & Resources",
    voiceId: "MF3mGyEYCl7XYW7ANnps" // Sarah
  }
];

export function TeamFitPage() {
  const [phase, setPhase] = useState<"landing" | "setup" | "pitching" | "analysis" | "static-analysis">("landing");
  const [file, setFile] = useState<File | null>(null);
  const [filePreviewText, setFilePreviewText] = useState("");
  const [problemStatement, setProblemStatement] = useState("");
  const [teamSize, setTeamSize] = useState(3);
  const [githubLinks, setGithubLinks] = useState<string[]>(["", "", ""]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [staticAnalysisResult, setStaticAnalysisResult] = useState<TeamFitResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Arena States
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [conversation, setConversation] = useState<{ role: "judge" | "user", text: string, judgeId?: string }[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [userResponse, setUserResponse] = useState("");
  const [arenaAnalysis, setArenaAnalysis] = useState<AnalysisData | null>(null);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [conversation]);

  // Ensure video stream remains attached
  useEffect(() => {
    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [phase]);

  const extractFilePreviewText = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const cleaned = text
          .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 15000);
        resolve(cleaned);
      };
      reader.readAsText(file.slice(0, 100000));
    });
  };

  const setupCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (videoRef.current) videoRef.current.srcObject = stream;
      streamRef.current = stream;
    } catch (err) {
      console.error(err);
      toast.error("Could not access camera/mic.");
    }
  };

  const toggleListening = () => {
    if (isListening) {
      mediaRecorderRef.current?.stop();
      setIsListening(false);
    } else {
      if (!streamRef.current) return;
      chunksRef.current = [];
      const recorder = new MediaRecorder(streamRef.current);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await handleAiInteraction(blob);
      };
      recorder.start();
      setIsListening(true);
      toast.info("Listening...");
    }
  };

  const speak = async (text: string, judgeId: string) => {
    const judge = judges.find(j => j.id === judgeId);
    const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;

    if (!apiKey || !judge?.voiceId) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(v => v.name.includes("Google") && v.lang.includes("en")) ||
        voices.find(v => v.lang.includes("en-US")) || voices[0];
      if (preferredVoice) utterance.voice = preferredVoice;
      window.speechSynthesis.speak(utterance);
      return;
    }

    try {
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${judge.voiceId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'xi-api-key': apiKey },
        body: JSON.stringify({
          text: text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 }
        })
      });
      if (!response.ok) throw new Error('ElevenLabs failed');
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.play();
    } catch (err) {
      console.warn("TTS Fallback", err);
      const utterance = new SpeechSynthesisUtterance(text);
      window.speechSynthesis.speak(utterance);
    }
  };

  // ... inside the component ...
  const handleAiInteraction = async (input?: Blob | string) => {
    if (currentQuestionIndex >= 6) { finishInterview(); return; }
    setIsAiThinking(true);
    const isStart = conversation.length === 0 && !input;
    const judge = isStart ? judges[0] : judges[Math.floor(Math.random() * judges.length)];
    const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;

    let transcribedText = "";
    let updatedConversation = [...conversation];

    if (input instanceof Blob) {
      try {
        const client = new AssemblyAI({
          apiKey: "fc03fa854b6a421aaceac0884ea62123"
        });

        const transcript = await client.transcripts.transcribe({
          audio: input,
          speech_model: "universal"
        });

        transcribedText = transcript.text || "";

        if (transcribedText) {
          const userMsg = { role: "user" as const, text: transcribedText };
          updatedConversation.push(userMsg);
          setConversation(prev => [...prev, userMsg]);
        }
      } catch (err) {
        console.error("AssemblyAI SDK Error:", err);
        toast.error("Audio transcription failed.");
      }
    } else if (typeof input === "string") {
      transcribedText = input;
      const userMsg = { role: "user" as const, text: transcribedText };
      updatedConversation.push(userMsg);
      setConversation(prev => [...prev, userMsg]);
    }

    try {
      const history = updatedConversation.map(c => `${c.role === 'user' ? 'PARTICIPANT' : 'JUDGE'}: ${c.text}`).join('\n');
      const prompt = `
        ARENA SIMULATION: High-Stakes Hackathon Final Round.
        PROJECT TOPIC: ${file?.name || "The user's project"}
        TECHNICAL CONTEXT (FROM DECK): ${filePreviewText || "No context extracted."}
        
        JUDGE PERSONA: ${judge.name} (${judge.role})
        DOMAIN DEPTH: ${judge.focus}

        SESSION HISTORY (DO NOT REPEAT PREVIOUS QUESTIONS):
        ${history || "Session entering initial phase."}
        
        RECENT USER INPUT: "${transcribedText || "N/A"}"

        JUDGING DIRECTIVE:
        1. Act as a world-class ${judge.role}. Be skeptical, technical, and brutally efficient.
        2. REFERENCE the project topic "${file?.name || "the project"}" naturally.
        3. Use the TECHNICAL CONTEXT to find a specific implementation flaw, market gap, or scaling bottleneck.
        4. Ask ONE sharp, critical follow-up question. Avoid "Great job" or filler. Go straight for the technical jugular.
        5. Ensure the question is UNIQUE and evolves logically from the HISTORY.
        6. Move beyond the surface. If they mentioned tech, ask about its constraints. If they mentioned market, ask about customer acquisition cost.

        CONSTRAINTS:
        - Max 35 words. 
        - Tone: Professional, Sharp, High-Pressure.
        - JSON ONLY: {"judge_response": "..."}
      `;

      const ollamaResponse = await fetch("http://localhost:11434/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gemma3:1b",
          prompt: prompt,
          stream: false,
          format: "json",
          system: `You are ${judge.name}, a ${judge.role}. Return JSON only: {"judge_response": "..."}`
        })
      });

      if (!ollamaResponse.ok) throw new Error("Ollama offline");
      const data = await ollamaResponse.json();

      let judgeText = "";
      try {
        const parsed = JSON.parse(data.response);
        judgeText = parsed.judge_response;
      } catch (pErr) {
        const match = data.response.match(/\{.*?\}/s);
        if (match) {
          const parsed = JSON.parse(match[0]);
          judgeText = parsed.judge_response;
        } else {
          judgeText = data.response;
        }
      }

      if (!judgeText) throw new Error("No dialogue generated");

      setConversation(prev => [...prev, { role: "judge", text: judgeText, judgeId: judge.id }]);
      speak(judgeText, judge.id);
      setCurrentQuestionIndex(prev => prev + 1);
      setUserResponse("");
    } catch (err) {
      console.warn("Fallback to Gemini", err);
      if (geminiKey) {
        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const fallbackPrompt = isStart ? `Ask to explain project "${file?.name}" and team roles.` : `Ask a question about ${judge.focus} for project context ${filePreviewText}. History: ${updatedConversation.map(c => c.text).join('\n')}`;
        const result = await model.generateContent(fallbackPrompt);
        const fallbackText = result.response.text();
        setConversation(prev => [...prev, { role: "judge", text: fallbackText, judgeId: judge.id }]);
        speak(fallbackText, judge.id);
        setCurrentQuestionIndex(prev => prev + 1);
      }
    } finally { setIsAiThinking(false); }
  };

  const handleStaticSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!problemStatement || githubLinks.every(link => !link)) return;
    setIsAnalyzing(true);
    setStaticAnalysisResult(null);
    setError(null);
    setPhase("static-analysis");
    try {
      const firecrawlKey = import.meta.env.VITE_FIRECRAWL_API_KEY;
      const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
      const result = await analyzeTeamFit(problemStatement, githubLinks, geminiKey, firecrawlKey);
      setStaticAnalysisResult(result);
    } catch (err) { console.error(err); setError("Analysis failed."); } finally { setIsAnalyzing(false); }
  };

  const startArena = async () => {
    if (!file) { toast.error("Upload pitch deck first."); return; }
    setPhase("setup");
    setupCamera();
    const preview = await extractFilePreviewText(file);
    setFilePreviewText(preview);
  };

  const beginInterview = async () => {
    setPhase("pitching");
    setIsRecording(true);
    setTimeout(() => handleAiInteraction(), 1500);
  };

  const finishInterview = async () => {
    setIsRecording(false);
    setPhase("analysis");
    const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!geminiKey) return;
    try {
      const genAI = new GoogleGenerativeAI(geminiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const prompt = `Perform behavioral analysis: ${JSON.stringify(conversation)}. JSON: {"confidence":0-100, "accuracy":0-100, "facialExpression":"", "bodyLanguage":"", "detailedFeedback":""}`;
      const result = await model.generateContent(prompt);
      const jsonMatch = result.response.text().match(/\{[\s\S]*\}/);
      if (jsonMatch) setArenaAnalysis(JSON.parse(jsonMatch[0]));
    } catch (err) { setArenaAnalysis({ confidence: 85, accuracy: 80, facialExpression: "Focused", bodyLanguage: "Engaging", detailedFeedback: "Solid performance." }); }
    finally { streamRef.current?.getTracks().forEach(t => t.stop()); }
  };

  const handleTeamSizeChange = (newSize: number) => {
    if (newSize < 1 || newSize > 10) return;
    setTeamSize(newSize);
    setGithubLinks(prev => {
      const newLinks = [...prev];
      while (newLinks.length < newSize) newLinks.push("");
      return newLinks.slice(0, newSize);
    });
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col font-sans">
      <Navigation />

      <main className="flex-1 pt-24 px-6 max-w-7xl mx-auto w-full flex flex-col">
        <AnimatePresence mode="wait">

          {phase === "landing" && (
            <motion.div key="landing" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-8">
                <h1 className="text-7xl font-black tracking-tighter uppercase italic">Team Fit <span className="text-blue-500">Arena</span></h1>
                <p className="text-neutral-400 text-xl leading-relaxed">Validate your team's chemistry and project alignment. Run a static GitHub analysis or face the Interactive Panel.</p>
                <div className="flex gap-4 pt-10">
                  <Button onClick={() => setPhase("static-analysis")} className="bg-white text-black hover:bg-neutral-200 h-16 px-10 rounded-2xl font-bold flex gap-2">Static Analysis <Github className="w-5 h-5" /></Button>
                  <label htmlFor="deck-upload" className="cursor-pointer bg-blue-600 hover:bg-blue-700 h-16 px-10 rounded-2xl font-bold flex items-center gap-2 transition-all">
                    Start Interactive Assessment <Upload className="w-5 h-5" />
                    <input type="file" id="deck-upload" className="hidden" accept=".pdf,.ppt,.pptx" onChange={(e) => { setFile(e.target.files?.[0] || null); startArena(); }} />
                  </label>
                </div>
              </div>
              <div className="relative group overflow-hidden rounded-[3rem] border border-white/5 bg-neutral-900/50 p-8 h-[500px] flex items-center justify-center">
                <div className="absolute inset-0 bg-blue-500/10 blur-[120px] rounded-full group-hover:bg-blue-500/20 transition-all duration-700" />
                <Activity className="w-40 h-40 text-blue-500/30 animate-pulse" />
                <div className="absolute bottom-10 left-10 right-10 grid grid-cols-2 gap-4">
                  <div className="bg-black/60 p-4 rounded-xl border border-white/5 backdrop-blur-md">
                    <p className="text-[10px] font-black uppercase text-neutral-500 mb-1">Active Listeners</p>
                    <p className="text-xl font-bold">4 AI Judges</p>
                  </div>
                  <div className="bg-black/60 p-4 rounded-xl border border-white/5 backdrop-blur-md">
                    <p className="text-[10px] font-black uppercase text-neutral-500 mb-1">Engine</p>
                    <p className="text-xl font-bold">Gemma 3 : 1B</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {phase === "setup" && (
            <motion.div key="setup" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex-1 flex flex-col items-center justify-center space-y-8">
              <h2 className="text-4xl font-black italic uppercase tracking-tighter">Biometric Registration</h2>
              <div className="relative w-full max-w-3xl aspect-video bg-neutral-900 rounded-[3rem] overflow-hidden border-8 border-neutral-800 shadow-[0_0_100px_rgba(59,130,246,0.1)]">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover grayscale brightness-50" />
                <div className="absolute inset-0 bg-gradient-to-t from-blue-500/20 to-transparent animate-scan-slow opacity-30" />
              </div>
              <Button onClick={beginInterview} className="bg-blue-600 hover:bg-blue-700 h-20 px-24 rounded-full text-2xl font-black uppercase tracking-widest shadow-2xl shadow-blue-500/20">Enter the Room</Button>
            </motion.div>
          )}

          {phase === "pitching" && (
            <motion.div key="pitching" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 grid grid-cols-12 gap-10 py-6 h-[calc(100vh-160px)]">
              <div className="col-span-8 flex flex-col space-y-6">
                <div className="grid grid-cols-4 gap-4">
                  {judges.map(judge => {
                    const isAsking = conversation.length > 0 && conversation[conversation.length - 1].role === "judge" && conversation[conversation.length - 1].judgeId === judge.id;
                    return (
                      <motion.div key={judge.id} animate={isAsking ? { y: -10, scale: 1.05 } : { y: 0, scale: 1 }} className={`relative rounded-3xl overflow-hidden aspect-[4/5] border-4 transition-all ${isAsking ? 'border-blue-500 shadow-[0_0_40px_rgba(59,130,246,0.3)]' : 'border-neutral-800 opacity-30 blur-[2px]'}`}>
                        <img src={judge.image} className="w-full h-full object-cover object-top" />
                        <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black to-transparent">
                          <p className="text-xs font-black uppercase">{judge.name}</p>
                          <p className="text-[10px] text-neutral-400 font-bold uppercase">{judge.role}</p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
                <div className="relative flex-1 bg-neutral-900 rounded-[3rem] overflow-hidden border-8 border-neutral-800 shadow-inner">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                  <div className="absolute top-8 left-8 flex gap-4">
                    <div className="px-4 py-2 bg-red-600 rounded-xl text-xs font-bold uppercase tracking-widest animate-pulse">Vibe-Check Live</div>
                    <div className="px-4 py-2 bg-black/60 backdrop-blur-md rounded-xl text-xs font-bold border border-white/10 uppercase">Q {currentQuestionIndex} / 6</div>
                  </div>
                </div>
              </div>
              <div className="col-span-4 flex flex-col space-y-6">
                <div className="flex-1 bg-neutral-900/60 rounded-[3rem] border border-white/5 p-8 flex flex-col min-h-0">
                  <h3 className="text-xs font-black uppercase text-neutral-500 mb-6 tracking-widest flex items-center gap-2"><Brain className="w-4 h-4" /> Transcription Link</h3>
                  <div ref={transcriptRef} className="flex-1 overflow-y-auto space-y-6 pr-4 custom-scrollbar">
                    {conversation.map((entry, idx) => (
                      <div key={idx} className={`flex flex-col ${entry.role === 'user' ? 'items-end' : 'items-start'}`}>
                        <p className={`text-[9px] font-black mb-2 uppercase tracking-tighter ${entry.role === 'user' ? 'text-blue-400' : 'text-neutral-600'}`}> {entry.role === 'user' ? "PARTICIPANT" : judges.find(j => j.id === entry.judgeId)?.name}</p>
                        <div className={`p-5 rounded-2xl text-[13px] leading-relaxed font-medium ${entry.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white/5 text-neutral-300 rounded-tl-none border border-white/5'}`}>{entry.text}</div>
                      </div>
                    ))}
                    {isAiThinking && <div className="p-4 bg-white/5 rounded-full w-fit flex gap-1"><span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" /><span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]" /><span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]" /></div>}
                  </div>
                </div>
                <div className="relative">
                  <textarea value={userResponse} onChange={(e) => setUserResponse(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAiInteraction(userResponse); setUserResponse(""); } }} placeholder="Respond to the panel..." className="w-full bg-neutral-900 border-2 border-neutral-800 rounded-[2rem] p-6 text-sm focus:outline-none focus:border-blue-500 min-h-[160px] resize-none pr-16 transition-all" />
                  <div className="absolute bottom-6 right-6 flex flex-col gap-3">
                    <Button onClick={toggleListening} className={`p-4 h-auto rounded-2xl transition-all ${isListening ? 'bg-red-500 animate-pulse' : 'bg-blue-600'}`}><Mic className="w-5 h-5" /></Button>
                    <Button onClick={() => { handleAiInteraction(userResponse); setUserResponse(""); }} disabled={!userResponse.trim() || isAiThinking} className="bg-white text-black p-4 h-auto rounded-2xl"><CheckCircle2 className="w-5 h-5" /></Button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {phase === "analysis" && arenaAnalysis && (
            <motion.div key="analysis" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 py-12 px-6 space-y-12 h-screen overflow-y-auto custom-scrollbar">
              <div className="text-center space-y-4">
                <CheckCircle2 className="w-20 h-20 text-green-500 mx-auto" />
                <h2 className="text-7xl font-black tracking-tighter uppercase italic">Team Alignment <span className="text-green-500">Verified</span></h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10 max-w-5xl mx-auto">
                <div className="bg-neutral-900/50 p-12 rounded-[3.5rem] border border-white/5 space-y-10">
                  <div className="space-y-4">
                    <div className="flex justify-between text-xs font-black uppercase"><span>Engagement Level</span><span className="text-blue-400">{arenaAnalysis.confidence}%</span></div>
                    <div className="h-2.5 bg-neutral-800 rounded-full overflow-hidden"><motion.div initial={{ width: 0 }} animate={{ width: `${arenaAnalysis.confidence}%` }} className="h-full bg-gradient-to-r from-blue-600 to-blue-400" /></div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex justify-between text-xs font-black uppercase"><span>Accuracy of Fit</span><span className="text-green-500">{arenaAnalysis.accuracy}%</span></div>
                    <div className="h-2.5 bg-neutral-800 rounded-full overflow-hidden"><motion.div initial={{ width: 0 }} animate={{ width: `${arenaAnalysis.accuracy}%` }} className="h-full bg-gradient-to-r from-green-600 to-green-400" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-6">
                    <div className="p-6 bg-black/40 rounded-3xl border border-white/5"><p className="text-[9px] font-black text-neutral-600 uppercase mb-2">Facial Sync</p><p className="text-xs italic text-neutral-300">"{arenaAnalysis.facialExpression}"</p></div>
                    <div className="p-6 bg-black/40 rounded-3xl border border-white/5"><p className="text-[9px] font-black text-neutral-600 uppercase mb-2">Body Sync</p><p className="text-xs italic text-neutral-300">"{arenaAnalysis.bodyLanguage}"</p></div>
                  </div>
                </div>
                <div className="bg-white text-black p-12 rounded-[3.5rem] flex flex-col shadow-2xl">
                  <BarChart3 className="w-10 h-10 mb-8" />
                  <h3 className="text-3xl font-black uppercase italic mb-6">Expert Verdict</h3>
                  <p className="text-xl font-medium leading-[1.6] text-neutral-800 flex-1">{arenaAnalysis.detailedFeedback}</p>
                  <Button onClick={() => window.location.reload()} className="mt-10 bg-black text-white hover:bg-neutral-800 h-20 rounded-3xl text-xl font-black uppercase">New Assessment</Button>
                </div>
              </div>
            </motion.div>
          )}

          {phase === "static-analysis" && (
            <motion.div key="static" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 grid grid-cols-1 lg:grid-cols-5 gap-10 py-10 overflow-y-auto no-scrollbar">
              <div className="lg:col-span-2 space-y-8">
                <Button onClick={() => setPhase("landing")} variant="ghost" className="mb-4">← Return to Lobby</Button>
                <div className="bg-neutral-900 border border-white/10 p-8 rounded-[2.5rem] shadow-xl">
                  <form onSubmit={handleStaticSubmit} className="space-y-8">
                    <div className="space-y-4">
                      <label className="text-sm font-black uppercase tracking-widest text-neutral-500">Project / Stack Blueprint</label>
                      <textarea className="w-full bg-black/40 border border-white/10 rounded-2xl p-5 text-sm min-h-[150px] focus:border-blue-500 focus:outline-none transition-all" value={problemStatement} onChange={(e) => setProblemStatement(e.target.value)} required placeholder="Describe the stack requirements..." />
                    </div>
                    <div className="space-y-4">
                      <label className="text-sm font-black uppercase tracking-widest text-neutral-500">Squad Unit Size</label>
                      <div className="flex items-center gap-6 bg-black/40 p-2 rounded-2xl border border-white/5">
                        <Button type="button" variant="ghost" onClick={() => handleTeamSizeChange(teamSize - 1)} disabled={teamSize <= 1} className="w-12 h-12 rounded-xl"> <Minus className="w-5 h-5" /> </Button>
                        <span className="text-2xl font-black flex-1 text-center">{teamSize}</span>
                        <Button type="button" variant="ghost" onClick={() => handleTeamSizeChange(teamSize + 1)} disabled={teamSize >= 10} className="w-12 h-12 rounded-xl"> <Plus className="w-5 h-5" /> </Button>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <label className="text-sm font-black uppercase tracking-widest text-neutral-500">GitHub Identity Links</label>
                      <div className="space-y-3">
                        {githubLinks.map((link, idx) => (
                          <div key={idx} className="flex items-center gap-3 bg-black/20 p-1.5 rounded-xl border border-white/5">
                            <Github className="w-5 h-5 ml-3 text-neutral-600" />
                            <input type="url" className="bg-transparent text-sm w-full p-2.5 focus:outline-none" value={link} onChange={(e) => { const n = [...githubLinks]; n[idx] = e.target.value; setGithubLinks(n); }} placeholder="github.com/username" />
                          </div>
                        ))}
                      </div>
                    </div>
                    <Button type="submit" disabled={isAnalyzing} className="w-full h-16 rounded-2xl bg-blue-600 hover:bg-blue-700 text-lg font-black uppercase tracking-widest">{isAnalyzing ? "Mining GitHub Data..." : "Run Global Analysis"}</Button>
                  </form>
                </div>
              </div>
              <div className="lg:col-span-3 pb-20">
                {!staticAnalysisResult && !isAnalyzing && (
                  <div className="h-full flex items-center justify-center border-2 border-dashed border-white/10 rounded-[3rem] text-neutral-600 font-bold">Waiting for Squad Parameters...</div>
                )}
                {isAnalyzing && (
                  <div className="h-full flex flex-col items-center justify-center space-y-6">
                    <div className="w-20 h-20 border-t-4 border-blue-500 rounded-full animate-spin" />
                    <p className="text-xl font-black uppercase tracking-[0.3em] text-neutral-500 italic">Processing Team DNA</p>
                  </div>
                )}
                {staticAnalysisResult && (
                  <div className="space-y-10">
                    <div className="bg-white text-black p-10 rounded-[3.5rem] shadow-2xl relative overflow-hidden">
                      <div className="flex justify-between items-center relative z-10">
                        <div><h2 className="text-4xl font-black uppercase italic tracking-tighter">Compatibility <span className="text-blue-600">Metric</span></h2><p className="font-bold text-neutral-400">Squad Alignment Index</p></div>
                        <div className="text-7xl font-black text-blue-600">{staticAnalysisResult.compatibilityScore}%</div>
                      </div>
                      <div className="h-[300px] w-full mt-10"><ResponsiveContainer><BarChart data={staticAnalysisResult.compatibilityGraphData} layout="vertical"> <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eee" /> <XAxis type="number" hide /><YAxis dataKey="skill" type="category" width={140} tick={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase' }} /> <RechartsTooltip cursor={{ fill: '#f0f0f0' }} /> <Bar dataKey="score" fill="#2563eb" radius={[0, 10, 10, 0]} barSize={24} /> </BarChart></ResponsiveContainer></div>
                    </div>
                    <div className="grid grid-cols-2 gap-8">
                      <div className="bg-orange-500/10 p-8 rounded-[2.5rem] border border-orange-500/20"><div className="flex gap-3 mb-4"><AlertTriangle className="text-orange-500" /> <h3 className="font-black uppercase tracking-widest">Skill Gaps</h3></div><p className="text-sm font-medium leading-relaxed text-orange-200">{staticAnalysisResult.missingSkills}</p></div>
                      <div className="bg-blue-500/10 p-8 rounded-[2.5rem] border border-blue-500/20"><div className="flex gap-3 mb-4"><BookOpen className="text-blue-500" /> <h3 className="font-black uppercase tracking-widest">Growth Vector</h3></div><p className="text-sm font-medium leading-relaxed text-blue-200">{staticAnalysisResult.skillGapAnalysis}</p></div>
                    </div>
                    {staticAnalysisResult.teamMembers.map((member, idx) => (
                      <div key={idx} className="bg-neutral-900 border border-white/5 p-8 rounded-[3rem] space-y-8">
                        <div className="flex justify-between items-center"><div className="flex items-center gap-4"><Github className="w-8 h-8" /><span className="text-2xl font-black italic uppercase">{member.username}</span></div><div className="px-4 py-1.5 bg-blue-500/10 rounded-full text-blue-400 text-xs font-black uppercase">Technical Expert</div></div>
                        <div className="grid md:grid-cols-2 gap-8 pt-4">
                          <div className="space-y-6">
                            <div><p className="text-[10px] font-black uppercase text-neutral-500 mb-3">Core Mastery</p><div className="flex flex-wrap gap-2">{member.topSkills.map((s, i) => <span key={i} className="px-3 py-1 bg-white text-black text-[10px] font-black uppercase rounded-lg">{s}</span>)}</div></div>
                            <div><p className="text-[10px] font-black uppercase text-neutral-500 mb-3">Portfolio Intel</p><p className="text-xs font-medium leading-relaxed text-neutral-400 bg-black/40 p-4 rounded-2xl">{member.projectsSummary}</p></div>
                          </div>
                          <div className="space-y-6">
                            <div><p className="text-[10px] font-black uppercase text-neutral-500 mb-3">Internal Review</p><p className="text-xs italic text-neutral-300 border-l-4 border-blue-500 pl-4">{member.skillSummary}</p></div>
                            <div className="bg-blue-600 p-6 rounded-[2rem]"><div className="flex gap-2 mb-2"><Activity className="w-4 h-4 text-white" /> <p className="text-xs font-black uppercase text-white/70">Top Relevance Project</p></div><h4 className="font-bold text-white mb-2">{member.bestProject?.name}</h4><p className="text-[11px] text-white/80 leading-relaxed">{member.bestProject?.description}</p></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </div>
  );
}
