import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";

interface Judge {
  id: string;
  role: string;
  color: string;
  focus: string;
  image: string;
}

interface JudgeVerdict {
  judgeId: string;
  score: number;
  feedback: string[];
  improvement: string;
}

const judges: Judge[] = [
  {
    id: "corporate",
    role: "Corporate Judge",
    color: "bg-blue-100",
    focus: "ROI obsessed",
    image: "/media/Screenshot 2026-01-24 234830.png"
  },
  {
    id: "research",
    role: "Research Judge",
    color: "bg-purple-100",
    focus: "Innovation nerd",
    image: "/media/Screenshot 2026-01-24 234834.png"
  },
  {
    id: "vc",
    role: "VC Judge",
    color: "bg-green-100",
    focus: "Scalability bro",
    image: "/media/Screenshot 2026-01-24 234839.png"
  },
  {
    id: "community",
    role: "Community Judge",
    color: "bg-orange-100",
    focus: "Impact first",
    image: "/media/Screenshot 2026-01-24 234842.png"
  }
];

interface JudgePanelProps {
  verdicts: JudgeVerdict[];
  currentJudgeIndex: number;
  isEvaluating: boolean;
  overallStrengths?: string[];
  overallWeaknesses?: string[];
  finalText?: string;
}

export function JudgePanel({ verdicts, currentJudgeIndex, isEvaluating, overallStrengths, overallWeaknesses, finalText }: JudgePanelProps) {
  const [showFinalVerdict, setShowFinalVerdict] = useState(false);

  useEffect(() => {
    if (verdicts.length > 0) {
      // Small delay before showing the final bottom section to let judge scores pop in first
      const timer = setTimeout(() => setShowFinalVerdict(true), 1500);
      return () => clearTimeout(timer);
    } else {
      setShowFinalVerdict(false);
    }
  }, [verdicts.length]);

  // Calculate final score
  const finalScore = verdicts.length >= judges.length
    ? Math.round(verdicts.reduce((sum, v) => sum + v.score, 0) / verdicts.length * 10) / 10
    : 0;

  // Get strengths and weaknesses (use props if available, else derive from feedback)
  const allFeedback = verdicts.flatMap(v => v.feedback);
  const strengths = overallStrengths || allFeedback.slice(0, 3);
  const weaknesses = overallWeaknesses || allFeedback.slice(3, 6);

  return (
    <div className="min-h-[600px] relative space-y-12">
      {/* 1. Judges Grid (Only fades in when results are ready) */}
      <AnimatePresence mode="wait">
        {verdicts.length > 0 && (
          <motion.div
            key="judges-grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            {judges.map((judge, index) => {
              const verdict = verdicts.find(v => v.judgeId === judge.id);
              const delay = index * 0.15; // Slightly faster stagger

              return (
                <motion.div
                  key={judge.id}
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: delay }}
                  className={`${judge.color} p-6 rounded-lg border-2 border-transparent transition-all`}
                >
                  <div className="w-20 h-20 bg-neutral-300 rounded-full mx-auto mb-4 relative overflow-hidden border-2 border-neutral-200">
                    <img
                      src={judge.image}
                      alt={judge.role}
                      className="w-full h-full object-cover object-top"
                    />
                  </div>

                  <h3 className="text-sm font-bold text-neutral-900 text-center mb-1">
                    {judge.role}
                  </h3>
                  <p className="text-xs text-neutral-500 text-center italic mb-3">
                    {judge.focus}
                  </p>

                  {/* Score Display - Pop in with bounce */}
                  {verdict && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: "spring", stiffness: 300, delay: delay + 0.4 }}
                      className="text-center"
                    >
                      <div className="text-3xl font-bold text-neutral-800">
                        {verdict.score}
                        <span className="text-sm text-neutral-500 font-normal">/10</span>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Final Verdict Section - Appears after judges */}
      <AnimatePresence>
        {showFinalVerdict && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="bg-white p-8 rounded-lg border-2 border-neutral-900 shadow-xl"
          >
            <div className="text-center mb-12">
              <motion.h2
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }} // Wait for container
                className="text-3xl text-neutral-900 mb-2"
              >
                Final Verdict
              </motion.h2>
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.8, type: "spring" }} // Pop in final score
                className="text-7xl font-black text-neutral-900 tracking-tighter"
              >
                {finalScore}
                <span className="text-2xl text-neutral-400 font-medium">/10</span>
              </motion.div>
            </div>

            <div className="grid md:grid-cols-2 gap-12">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.2 }}
              >
                <h3 className="text-xl font-bold text-neutral-900 mb-6 flex items-center gap-2">
                  <span className="p-1 bg-green-100 rounded text-green-700">✓</span> Strengths
                </h3>
                <div className="space-y-4">
                  {strengths.map((strength, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 1.5 + idx * 0.1 }}
                      className="text-neutral-700 bg-neutral-50 p-4 rounded-md text-sm leading-relaxed border border-neutral-100"
                    >
                      {strength}
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.2 }}
              >
                <h3 className="text-xl font-bold text-neutral-900 mb-6 flex items-center gap-2">
                  <span className="p-1 bg-orange-100 rounded text-orange-700">→</span> Improvements & Suggestions
                </h3>
                <div className="space-y-4">
                  {weaknesses.map((weakness, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 1.8 + idx * 0.1 }}
                      className="text-neutral-700 bg-neutral-50 p-4 rounded-md text-sm leading-relaxed border border-neutral-100"
                    >
                      {weakness}
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2.2 }}
              className="mt-12 pt-8 border-t border-neutral-100 text-center"
            >
              <h4 className="text-sm font-bold text-neutral-500 uppercase tracking-wider mb-4">Executive Summary</h4>
              <p className="text-lg text-neutral-800 font-medium leading-relaxed max-w-4xl mx-auto">
                {finalText || "Evaluation complete."}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
