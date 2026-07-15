import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Sparkles, Brain, Lock, Users, Zap } from "lucide-react";

export default function LandingPage() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { type: "spring" as const, stiffness: 100 },
    },
  };

  return (
    <div className="min-h-[100dvh] bg-background text-foreground relative overflow-hidden flex flex-col">
      {/* Cinematic animated background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[10%] left-[20%] w-[40%] h-[40%] rounded-full bg-purple-600/10 blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-[20%] right-[10%] w-[30%] h-[50%] rounded-full bg-cyan-600/10 blur-[100px] animate-pulse" style={{ animationDuration: '10s', animationDelay: '2s' }} />
      </div>

      {/* Header */}
      <header className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-10">
        <div className="flex items-center gap-2">
          <img src="/logo.svg" alt="Mithra AI" className="w-8 h-8" />
          <span className="font-semibold text-xl tracking-tight text-foreground">Mithra</span>
        </div>
        <div className="flex gap-4">
          <Link href="/sign-in" className="text-sm font-medium text-foreground/70 hover:text-foreground transition-colors py-2 px-4">
            Sign In
          </Link>
          <Link href="/sign-up" className="hidden sm:inline-flex bg-muted/40 hover:bg-white/20 text-foreground border border-border px-4 py-2 rounded-md text-sm font-medium transition-colors">
            Get Started
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center relative z-10 px-4 text-center mt-16 sm:mt-0">
        <motion.div
          className="max-w-4xl mx-auto space-y-8"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={itemVariants} className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-200 text-xs font-medium mb-4">
            <Sparkles className="w-3 h-3" />
            <span>The future of family computing</span>
          </motion.div>
          
          <motion.h1 variants={itemVariants} className="text-5xl sm:text-7xl font-bold tracking-tight text-foreground leading-[1.1]">
            Your family's <br/>
            <span className="text-gradient">private intelligence.</span>
          </motion.h1>
          
          <motion.p variants={itemVariants} className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Mithra is a premium AI operating system designed for families. Private, powerful, and beautifully crafted to organize your life.
          </motion.p>
          
          <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
            <Link href="/sign-up">
              <Button size="lg" className="w-full sm:w-auto h-12 px-8 text-base shadow-[0_0_40px_-10px_rgba(168,85,247,0.5)] bg-gradient-to-r from-purple-600 to-cyan-600 border border-white/20">
                Start Your Family
              </Button>
            </Link>
            <Link href="/sign-in">
              <Button size="lg" variant="outline" className="w-full sm:w-auto h-12 px-8 text-base bg-muted/30 border-border text-foreground hover:bg-muted/40">
                Sign In
              </Button>
            </Link>
          </motion.div>
        </motion.div>

        {/* Feature grid */}
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto mt-32 w-full pb-20"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={itemVariants} className="glass-card p-6 rounded-2xl text-left border border-border/50 bg-white/[0.02]">
            <Brain className="w-8 h-8 text-purple-400 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Personal Models</h3>
            <p className="text-muted-foreground text-sm">Choose between OpenAI, Anthropic, or local models. Each family member gets their own customized context.</p>
          </motion.div>
          
          <motion.div variants={itemVariants} className="glass-card p-6 rounded-2xl text-left border border-border/50 bg-white/[0.02]">
            <Lock className="w-8 h-8 text-cyan-400 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Private by Design</h3>
            <p className="text-muted-foreground text-sm">Your family data is isolated and encrypted. No corporate tracking, no ads, just your own private hub.</p>
          </motion.div>
          
          <motion.div variants={itemVariants} className="glass-card p-6 rounded-2xl text-left border border-border/50 bg-white/[0.02]">
            <Zap className="w-8 h-8 text-yellow-400 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Lightning Fast</h3>
            <p className="text-muted-foreground text-sm">Built with a cinematic, highly-responsive interface that feels instantaneous. Form meets function.</p>
          </motion.div>
        </motion.div>
      </main>
    </div>
  );
}