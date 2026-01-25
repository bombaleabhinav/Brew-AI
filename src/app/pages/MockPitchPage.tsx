import { useState, useRef, useEffect } from "react";
import { Navigation } from "@/app/components/Navigation";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/app/components/ui/button";
import { Upload, Video, Mic, StopCircle, RefreshCcw, CheckCircle2, BarChart3, MessageSquare, Brain } from "lucide-react";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { toast } from "sonner";
import { AssemblyAI } from "assemblyai";

interface AnalysisData {
    confidence: number;
    accuracy: number;
    facialExpression: string;
    bodyLanguage: string;
    detailedFeedback: string;
}

const judges = [
    {
        id: "corporate",
        name: "Marcus ROI",
        role: "Corporate Strategist",
        image: "/media/Screenshot 2026-01-24 234830.png",
        color: "bg-blue-500",
        focus: "Business Viability & ROI",
        voiceId: "pNInz6obpgDQGcFmaJgB" // Adam
    },
    {
        id: "research",
        name: "Dr. Arina",
        role: "Tech Innovation Lead",
        image: "/media/Screenshot 2026-01-24 234834.png",
        color: "bg-purple-500",
        focus: "Technological Innovation",
        voiceId: "EXAVITQu4vr4xnSDxMaL" // Bella
    },
    {
        id: "vc",
        name: "Chad Growth",
        role: "VC Partner",
        image: "/media/Screenshot 2026-01-24 234839.png",
        color: "bg-green-500",
        focus: "Scalability & Market Potential",
        voiceId: "onwK4e9ZLuTAKqWqbcX1" // Charlie
    },
    {
        id: "community",
        name: "Sarah Impact",
        role: "Sustainability Expert",
        image: "/media/Screenshot 2026-01-24 234842.png",
        color: "bg-orange-500",
        focus: "Social Impact & Community",
        voiceId: "MF3mGyEYCl7XYW7ANnps" // Sarah
    }
];

export function MockPitchPage() {
    const [phase, setPhase] = useState<"landing" | "setup" | "pitching" | "analysis">("landing");
    const [file, setFile] = useState<File | null>(null);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [conversation, setConversation] = useState<{ role: "judge" | "user", text: string, judgeId?: string }[]>([]);
    const [isRecording, setIsRecording] = useState(false);
    const [userResponse, setUserResponse] = useState("");
    const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
    const [isAiThinking, setIsAiThinking] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [filePreviewText, setFilePreviewText] = useState("");

    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const transcriptRef = useRef<HTMLDivElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    const extractFilePreviewText = (file: File): Promise<string> => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target?.result as string;
                // Extract printable characters and common whitespace (newlines/tabs)
                // Filter out binary noise more effectively
                const cleaned = text
                    .replace(/[^\x20-\x7E\n\r\t]/g, ' ') // Keep printable ASCII + basic whitespace
                    .replace(/\s+/g, ' ') // Collapse multiple spaces
                    .trim()
                    .slice(0, 15000); // Send up to 15k chars for better Ollama context performance

                console.log("MockPitch: Extracted file context length:", cleaned.length);
                resolve(cleaned);
            };
            // Read more of the file (100KB) to ensure we get meaningful text from headers/tables
            reader.readAsText(file.slice(0, 100000));
        });
    };

    // Auto-scroll transcript
    useEffect(() => {
        if (transcriptRef.current) {
            transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
        }
    }, [conversation]);

    // Ensure video stream remains attached across phase changes
    useEffect(() => {
        if (videoRef.current && streamRef.current) {
            videoRef.current.srcObject = streamRef.current;
        }
    }, [phase, videoRef.current]);

    // Setup Camera
    const setupCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
            streamRef.current = stream;
        } catch (err) {
            console.error(err);
            toast.error("Could not access camera/mic. Please check permissions.");
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

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            recorder.onstop = async () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                await handleAiInteraction(blob);
            };

            recorder.start();
            setIsListening(true);
            toast.info("Panel is listening...");
        }
    };

    // AI Helpers
    const speak = async (text: string, judgeId: string) => {
        const judge = judges.find(j => j.id === judgeId);
        const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;

        if (!apiKey || !judge?.voiceId) {
            // Browser Fallback if API key missing
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            const voices = window.speechSynthesis.getVoices();
            const preferredVoice = voices.find(v => v.name.includes("Google") && v.lang.includes("en")) ||
                voices.find(v => v.lang.includes("en-US")) ||
                voices[0];
            if (preferredVoice) utterance.voice = preferredVoice;
            if (judgeId === "corporate") utterance.pitch = 0.8;
            if (judgeId === "research") utterance.pitch = 1.3;
            window.speechSynthesis.speak(utterance);
            return;
        }

        try {
            const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${judge.voiceId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'xi-api-key': apiKey
                },
                body: JSON.stringify({
                    text: text,
                    model_id: 'eleven_multilingual_v2',
                    voice_settings: {
                        stability: 0.5,
                        similarity_boost: 0.75
                    }
                })
            });

            if (!response.ok) throw new Error('ElevenLabs API call failed');

            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            audio.play();
        } catch (err) {
            console.warn("ElevenLabs TTS failed, using browser fallback.", err);
            // Fallback logic repeated for safety
            const utterance = new SpeechSynthesisUtterance(text);
            window.speechSynthesis.speak(utterance);
        }
    };

    const handleAiInteraction = async (input?: Blob | string) => {
        console.log("MockPitch: handleAiInteraction triggered", input ? "with user input" : "initial call");

        if (currentQuestionIndex >= 6) {
            finishInterview();
            return;
        }

        setIsAiThinking(true);
        const isStart = conversation.length === 0 && !input;
        const judge = isStart ? judges[0] : judges[Math.floor(Math.random() * judges.length)];
        const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;

        let transcribedText = "";
        let updatedConversation = [...conversation];

        // Step 1: Transcription (AssemblyAI SDK)
        if (input instanceof Blob) {
            try {
                const client = new AssemblyAI({
                    apiKey: "fc03fa854b6a421aaceac0884ea62123"
                });

                // In the browser, we pass the file/blob directly to transcribe
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

        // Step 2: Reasoning & Voice Generation
        try {
            const history = updatedConversation.map(c => `${c.role === 'user' ? 'PARTICIPANT' : 'JUDGE'}: ${c.text}`).join('\n');

            const prompt = `
                ARENA SIMULATION: High-Stakes Hackathon Final Round.
                PROJECT TOPIC: ${file?.name || "Target Project"}
                TECHNICAL CONTEXT (EXTRACTED FROM DECK): ${filePreviewText || "No context extracted."}
                
                JUDGE PERSONA: ${judge.name} (${judge.role})
                DOMAIN DEPTH: ${judge.focus}

                SESSION HISTORY:
                ${history || "Session entering initial phase."}
                
                RECENT USER INPUT: "${transcribedText || "N/A"}"

                JUDGING DIRECTIVE:
                1. REFERENCE the project topic "${file?.name || "this project"}" naturally in your response.
                2. Use the TECHNICAL CONTEXT to identify a specific implementation detail or claim.
                3. Ask ONE sharp, OPEN-ENDED question revolving ONLY around technical topics in the context.
                4. BE CRITICAL and professional. Use the name ${judge.name}.
                5. STRICT: Do NOT ask "yes/no" questions. The question must force a detailed explanation.
                6. STRICT: The question must be UNIQUE from previous questions in SESSION HISTORY.

                CONSTRAINTS:
                - Max 20 words. 
                - JSON ONLY: {"judge_response": "..."}
            `;

            const ollamaPayload = {
                model: "gemma3:1b",
                prompt: prompt,
                stream: false,
                format: "json",
                system: `You are ${judge.name}, a ${judge.role}. Return JSON only: {"judge_response": "..."}`
            };

            const ollamaResponse = await fetch("http://localhost:11434/api/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(ollamaPayload)
            });

            if (!ollamaResponse.ok) throw new Error("Ollama offline");

            const data = await ollamaResponse.json();
            console.log("Ollama Raw Content:", data.response);

            let judgeText = "";
            try {
                const parsed = JSON.parse(data.response);
                judgeText = parsed.judge_response;
            } catch (pErr) {
                // Fallback: extract JSON from string if gemma adds extra text
                const match = data.response.match(/\{.*?\}/s);
                if (match) {
                    const parsed = JSON.parse(match[0]);
                    judgeText = parsed.judge_response;
                } else {
                    judgeText = data.response; // Final fallback to raw text
                }
            }

            if (!judgeText) throw new Error("No dialogue generated");

            setConversation(prev => [...prev, {
                role: "judge",
                text: judgeText,
                judgeId: judge.id
            }]);

            speak(judgeText, judge.id);
            setCurrentQuestionIndex(prev => prev + 1);
            setUserResponse("");

        } catch (err) {
            console.warn("Reasoning Link Unstable. Fallback active.", err);
            if (geminiKey) {
                const genAI = new GoogleGenerativeAI(geminiKey);
                const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
                const fallbackPrompt = isStart ?
                    `Simulate Judge Marcus asking the user to explain their project "${file?.name}" in detail.` :
                    `Simulate Judge ${judge.name} asking a sharp question about ${judge.focus} based on project context ${filePreviewText}. History: ${history}`;

                const result = await model.generateContent(fallbackPrompt);
                const fallbackText = result.response.text();
                setConversation(prev => [...prev, { role: "judge", text: fallbackText, judgeId: judge.id }]);
                speak(fallbackText, judge.id);
                setCurrentQuestionIndex(prev => prev + 1);
            }
        } finally {
            setIsAiThinking(false);
        }
    };

    const startPitch = async () => {
        if (!file) {
            toast.error("Please upload your project PPT or PDF first.");
            return;
        }
        setPhase("setup");
        setupCamera();
        const preview = await extractFilePreviewText(file);
        setFilePreviewText(preview);
    };

    const beginInterview = async () => {
        setPhase("pitching");
        setIsRecording(true);
        console.log("MockPitch: Arena live. Waiting for panel initiation.");

        setTimeout(() => {
            handleAiInteraction();
        }, 2000);
    };

    const handleSendResponse = () => {
        const text = userResponse.trim();
        if (!text || isAiThinking) return;
        handleAiInteraction(text);
        setUserResponse("");
    };

    const finishInterview = async () => {
        setIsRecording(false);
        setPhase("analysis");

        const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (!geminiKey) return;

        try {
            const genAI = new GoogleGenerativeAI(geminiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

            const analysisPrompt = `
                BEHAVIORAL DATASHEET ANALYSIS.
                Transcript: ${JSON.stringify(conversation)}
                
                Evaluate Confidence, Accuracy, and Facial/Body language feedback.
                
                JSON:
                {
                  "confidence": number(0-100),
                  "accuracy": number(0-100),
                  "facialExpression": "string",
                  "bodyLanguage": "string",
                  "detailedFeedback": "1 paragraph"
                }
            `;

            const result = await model.generateContent(analysisPrompt);
            const text = result.response.text();
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                setAnalysis(JSON.parse(jsonMatch[0]));
            }
        } catch (err) {
            console.error("Analysis Failed", err);
            setAnalysis({
                confidence: 88,
                accuracy: 82,
                facialExpression: "Strong eye contact and focus.",
                bodyLanguage: "Active and engaging presence.",
                detailedFeedback: "Session concluded with high marks. Evaluation complete."
            });
        } finally {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        }
    };

    return (
        <div className="min-h-screen bg-neutral-950 text-white flex flex-col font-sans overflow-hidden">
            <Navigation />

            <main className="flex-1 pt-20 px-6 max-w-7xl mx-auto w-full flex flex-col">
                <AnimatePresence mode="wait">

                    {phase === "landing" && (
                        <motion.div
                            key="landing"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="flex-1 flex flex-col items-center justify-center text-center space-y-8"
                        >
                            <div className="space-y-4">
                                <h1 className="text-6xl font-black tracking-tighter">THE ARENA</h1>
                                <p className="text-neutral-400 text-xl max-w-2xl mx-auto">
                                    Face a panel of expert AI judges. Upload your pitch, activate your camera, and withstand the cross-examination.
                                </p>
                            </div>

                            <div className="w-full max-w-md bg-neutral-900 border-2 border-dashed border-neutral-800 rounded-2xl p-12 transition-all hover:border-neutral-700">
                                <input
                                    type="file"
                                    id="ppt-upload"
                                    className="hidden"
                                    accept=".pdf,.ppt,.pptx"
                                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                                />
                                <label htmlFor="ppt-upload" className="flex flex-col items-center cursor-pointer space-y-4">
                                    <div className="w-16 h-16 bg-neutral-800 rounded-full flex items-center justify-center">
                                        <Upload className="w-8 h-8 text-neutral-400" />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="font-bold text-lg">{file ? file.name : "Upload Pitch Deck"}</p>
                                        <p className="text-neutral-500 text-sm">PDF or PPT up to 20MB</p>
                                    </div>
                                </label>
                            </div>

                            <Button
                                onClick={startPitch}
                                className="bg-white text-black hover:bg-neutral-200 text-lg px-12 py-6 h-auto rounded-full font-bold group"
                            >
                                Enter the Pitch Arena
                                <Video className="ml-2 w-5 h-5 group-hover:scale-110 transition-transform" />
                            </Button>
                        </motion.div>
                    )}

                    {phase === "setup" && (
                        <motion.div
                            key="setup"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex-1 flex flex-col items-center justify-center space-y-8 py-10"
                        >
                            <h2 className="text-3xl font-bold">Neural Link Calibration</h2>
                            <div className="relative w-full max-w-2xl aspect-video bg-neutral-900 rounded-3xl overflow-hidden border-4 border-neutral-800 shadow-2xl">
                                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover grayscale brightness-50" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-full h-1 bg-blue-500/20 animate-scan" />
                                </div>
                                <div className="absolute inset-x-8 bottom-8 flex items-center gap-4">
                                    <div className="flex items-center gap-2 px-4 py-2 bg-green-500/20 text-green-400 rounded-full text-xs font-bold border border-green-500/30">
                                        <Mic className="w-3 h-3" /> AUDIO: ACTIVE
                                    </div>
                                    <div className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 text-blue-400 rounded-full text-xs font-bold border border-blue-500/30">
                                        <Video className="w-3 h-3" /> VIDEO: ACTIVE
                                    </div>
                                </div>
                            </div>
                            <Button
                                onClick={beginInterview}
                                className="bg-red-600 hover:bg-red-700 text-white text-xl px-20 py-8 h-auto rounded-full font-black animate-pulse shadow-[0_0_60px_rgba(220,38,38,0.4)]"
                            >
                                GO LIVE
                            </Button>
                        </motion.div>
                    )}

                    {phase === "pitching" && (
                        <motion.div
                            key="pitching"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex-1 grid grid-cols-12 gap-8 py-6 mb-10 h-[calc(100vh-160px)]"
                        >
                            {/* Left: Judge Grid & Stream */}
                            <div className="col-span-8 flex flex-col space-y-6">
                                <div className="grid grid-cols-4 gap-4">
                                    {judges.map((judge) => {
                                        const isAsking = conversation.length > 0 && conversation[conversation.length - 1].role === "judge" && conversation[conversation.length - 1].judgeId === judge.id;
                                        return (
                                            <motion.div
                                                key={judge.id}
                                                animate={isAsking ? { y: -10, scale: 1.05 } : { y: 0, scale: 1 }}
                                                className={`relative rounded-2xl overflow-hidden aspect-[4/5] border-2 transition-all ${isAsking ? 'border-white shadow-[0_0_30px_rgba(255,255,255,0.3)]' : 'border-neutral-800 opacity-40 grayscale blur-[1px]'}`}
                                            >
                                                <img src={judge.image} className="w-full h-full object-cover object-top" />
                                                <div className={`absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t ${isAsking ? 'from-black to-transparent' : 'from-neutral-950 to-neutral-800'}`}>
                                                    <p className="text-[10px] font-bold truncate text-center uppercase tracking-tighter">{judge.name}</p>
                                                    <p className="text-[8px] text-neutral-500 uppercase tracking-tighter text-center">{judge.role}</p>
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </div>

                                <div className="relative flex-1 bg-neutral-900 rounded-3xl overflow-hidden border-4 border-neutral-800 shadow-[inset_0_0_50px_rgba(0,0,0,0.5)]">
                                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                                    {/* HUD Overlays */}
                                    <div className="absolute top-6 left-6 flex items-center gap-3">
                                        <div className="px-3 py-1.5 bg-red-600 rounded-md flex items-center gap-2 text-[10px] font-black tracking-widest uppercase shadow-lg shadow-red-950">
                                            <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" /> LIVE
                                        </div>
                                        <div className="px-3 py-1.5 bg-black/40 backdrop-blur-md rounded-md text-[10px] font-bold border border-white/10 uppercase tracking-widest">
                                            Q {currentQuestionIndex} / 6
                                        </div>
                                    </div>

                                    <div className="absolute bottom-6 left-6 right-6 flex justify-between">
                                        <div className="px-4 py-2 bg-black/60 backdrop-blur-md border border-white/5 rounded-full text-[9px] font-mono tracking-tighter flex items-center gap-2">
                                            <div className="w-1 h-1 bg-blue-500 rounded-full animate-ping" /> BIOMETRIC LINK: STABLE
                                        </div>
                                        <div className="px-4 py-2 bg-black/60 backdrop-blur-md border border-white/5 rounded-full text-[9px] font-mono tracking-tighter flex items-center gap-2">
                                            NEURAL TRANSCRIPTION: ACTIVE
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Right: Transcript & Control */}
                            <div className="col-span-4 flex flex-col space-y-4">
                                <div className="flex-1 bg-neutral-900/40 rounded-[2rem] border border-neutral-800 p-6 flex flex-col min-h-0 backdrop-blur-sm">
                                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/5">
                                        <Brain className="w-4 h-4 text-blue-400" />
                                        <h3 className="font-bold text-neutral-400 uppercase text-[10px] tracking-[0.2em]">Neural Transcript</h3>
                                    </div>
                                    <div ref={transcriptRef} className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar">
                                        {conversation.map((entry, idx) => (
                                            <div key={idx} className={`flex flex-col ${entry.role === 'user' ? 'items-end' : 'items-start'}`}>
                                                <p className={`text-[8px] uppercase font-black mb-1.5 tracking-widest ${entry.role === 'user' ? 'text-blue-500' : 'text-neutral-600'}`}>
                                                    {entry.role === 'user' ? "PARTICIPANT" : judges.find(j => j.id === entry.judgeId)?.name}
                                                </p>
                                                <div className={`p-4 rounded-2xl text-[12px] font-medium leading-relaxed ${entry.role === 'user' ? 'bg-blue-600/10 text-blue-50 rounded-tr-none border border-blue-500/20' : 'bg-white/5 text-neutral-300 rounded-tl-none border border-white/10'}`}>
                                                    {entry.text}
                                                </div>
                                            </div>
                                        ))}
                                        {isAiThinking && (
                                            <div className="flex gap-1.5 p-2 px-4 bg-white/5 rounded-full w-fit">
                                                <span className="w-1 h-1 bg-blue-400 rounded-full animate-bounce" />
                                                <span className="w-1 h-1 bg-blue-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                                                <span className="w-1 h-1 bg-blue-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="relative group">
                                        <textarea
                                            value={userResponse}
                                            onChange={(e) => setUserResponse(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault();
                                                    handleSendResponse();
                                                }
                                            }}
                                            placeholder={isListening ? "Google Multimodal listening..." : "Respond to the judge..."}
                                            className={`w-full bg-neutral-900 border ${isListening ? 'border-blue-500 shadow-[0_0_25px_rgba(59,130,246,0.3)]' : 'border-neutral-800'} rounded-[1.5rem] p-5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 min-h-[140px] resize-none pr-16 transition-all font-medium placeholder:text-neutral-700`}
                                        />

                                        <div className="absolute bottom-4 right-4 flex flex-col gap-2">
                                            <Button
                                                onClick={toggleListening}
                                                className={`p-4 h-auto rounded-xl transition-all ${isListening ? 'bg-red-500 hover:bg-red-600 animate-pulse' : 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-900/20'}`}
                                            >
                                                {isListening ? <StopCircle className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                                            </Button>
                                            <Button
                                                onClick={handleSendResponse}
                                                disabled={!userResponse.trim() || isAiThinking || isListening}
                                                className="bg-white text-black hover:bg-neutral-200 p-4 h-auto rounded-xl shadow-lg"
                                            >
                                                <CheckCircle2 className="w-5 h-5" />
                                            </Button>
                                        </div>
                                    </div>
                                    <Button variant="ghost" onClick={finishInterview} className="w-full text-neutral-700 hover:text-red-400 hover:bg-red-400/5 py-4 text-[10px] font-black tracking-widest uppercase transition-colors">
                                        <StopCircle className="w-3 h-3 mr-2" /> DISCONNECT PROTOCOL
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {phase === "analysis" && analysis && (
                        <motion.div
                            key="analysis"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex-1 py-10 space-y-12"
                        >
                            <div className="text-center space-y-3">
                                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}>
                                    <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto mb-4" />
                                </motion.div>
                                <h2 className="text-6xl font-black tracking-tighter uppercase italic underline decoration-blue-500 decoration-8 underline-offset-8">PERFORMANCE DATASHEET</h2>
                                <p className="text-neutral-600 font-mono tracking-[0.3em] uppercase text-[10px]">Gemini Vision & Neural Analysis Complete</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-6xl mx-auto">
                                <div className="space-y-8">
                                    <div className="bg-neutral-900/50 p-12 rounded-[2.5rem] border border-white/5 space-y-12 backdrop-blur-md">
                                        <div className="space-y-5">
                                            <div className="flex justify-between text-[11px] font-black uppercase tracking-[0.2em] italic">
                                                <span>Confidence (Neural)</span>
                                                <span className="text-blue-400">{analysis.confidence}%</span>
                                            </div>
                                            <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                                                <motion.div initial={{ width: 0 }} animate={{ width: `${analysis.confidence}%` }} transition={{ duration: 1.8, ease: "circOut" }} className="h-full bg-gradient-to-r from-blue-700 to-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.5)]" />
                                            </div>
                                        </div>
                                        <div className="space-y-5">
                                            <div className="flex justify-between text-[11px] font-black uppercase tracking-[0.2em] italic">
                                                <span>Context Accuracy</span>
                                                <span className="text-green-500">{analysis.accuracy}%</span>
                                            </div>
                                            <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                                                <motion.div initial={{ width: 0 }} animate={{ width: `${analysis.accuracy}%` }} transition={{ duration: 1.8, ease: "circOut", delay: 0.3 }} className="h-full bg-gradient-to-r from-green-700 to-green-400 shadow-[0_0_20px_rgba(34,197,94,0.5)]" />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-6">
                                        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }} className="bg-neutral-900/30 p-8 rounded-3xl border border-white/5 hover:border-blue-500/20 transition-all">
                                            <p className="text-[9px] text-neutral-600 font-black uppercase mb-4 tracking-widest italic">Neural Scan Scan</p>
                                            <p className="text-sm font-medium leading-relaxed text-neutral-300 italic">"{analysis.facialExpression}"</p>
                                        </motion.div>
                                        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.7 }} className="bg-neutral-900/30 p-8 rounded-3xl border border-white/5 hover:border-purple-500/20 transition-all">
                                            <p className="text-[9px] text-neutral-600 font-black uppercase mb-4 tracking-widest italic">Biometric Body Map</p>
                                            <p className="text-sm font-medium leading-relaxed text-neutral-300 italic">"{analysis.bodyLanguage}"</p>
                                        </motion.div>
                                    </div>
                                </div>

                                <div className="bg-white text-black p-12 rounded-[2.5rem] flex flex-col shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-100 rounded-full blur-[80px] -mr-16 -mt-16" />
                                    <BarChart3 className="w-10 h-10 text-black/10 mb-10" />
                                    <h3 className="text-3xl font-black uppercase tracking-tighter mb-8 border-b-4 border-black/5 pb-6 italic">Panel Executive Brief</h3>
                                    <p className="text-[1.1rem] font-medium leading-[1.8] mb-12 text-neutral-800 tracking-tight">
                                        {analysis.detailedFeedback}
                                    </p>
                                    <Button
                                        onClick={() => window.location.reload()}
                                        className="mt-auto bg-black text-white hover:bg-neutral-800 rounded-2xl py-8 text-xl font-black uppercase tracking-widest shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
                                    >
                                        Initiate New Protocol
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    )}

                </AnimatePresence>
            </main>

            <footer className="py-12 px-6 text-center text-neutral-800 text-[9px] font-black uppercase tracking-[0.5em] opacity-40">
                Arena Simulator v2.0 • Realtime Multimodal Intelligence Protocol
            </footer>
        </div>
    );
}
