import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle, useMemo, useCallback, createContext, Children } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { ArrowRight, Mail, Lock, Eye, EyeOff, ArrowLeft, X, AlertCircle, PartyPopper, Loader, Cpu, User } from "lucide-react";
import { AnimatePresence, motion, useInView, Variants, Transition } from "framer-motion";
import confetti from "canvas-confetti";

type Api = { fire: (options?: confetti.Options) => void }
export type ConfettiRef = Api | null

const ConfettiContext = createContext<Api>({} as Api)

// Helper for joining class names simply and safely
function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}

// Simple hash function for safe password storage in localStorage
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

const Confetti = forwardRef<ConfettiRef, React.ComponentPropsWithRef<"canvas"> & { options?: confetti.Options; globalOptions?: confetti.GlobalOptions; manualstart?: boolean }>((props, ref) => {
  const { options, globalOptions = { resize: true, useWorker: true }, manualstart = false, ...rest } = props
  const instanceRef = useRef<any>(null)
  const canvasRef = useCallback((node: HTMLCanvasElement) => {
    if (node !== null) {
      if (instanceRef.current) return
      instanceRef.current = confetti.create(node, { ...globalOptions, resize: true })
    } else {
      if (instanceRef.current) {
        instanceRef.current.reset()
        instanceRef.current = null
      }
    }
  }, [globalOptions])
  const fire = useCallback((opts = {}) => instanceRef.current?.({ ...options, ...opts }), [options])
  const api = useMemo(() => ({ fire }), [fire])
  useImperativeHandle(ref, () => api, [api])
  useEffect(() => { if (!manualstart) fire() }, [manualstart, fire])
  return <canvas ref={canvasRef} {...rest} />
})
Confetti.displayName = "Confetti";

// --- TEXT LOOP ANIMATION COMPONENT ---
type TextLoopProps = { children: React.ReactNode[]; className?: string; interval?: number; transition?: Transition; variants?: Variants; onIndexChange?: (index: number) => void; stopOnEnd?: boolean; };
export function TextLoop({ children, className, interval = 2, transition = { duration: 0.3 }, variants, onIndexChange, stopOnEnd = false }: TextLoopProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const items = Children.toArray(children);
  useEffect(() => {
    const intervalMs = interval * 1000;
    const timer = setInterval(() => {
      setCurrentIndex((current) => {
        if (stopOnEnd && current === items.length - 1) {
          clearInterval(timer);
          return current;
        }
        const next = (current + 1) % items.length;
        onIndexChange?.(next);
        return next;
      });
    }, intervalMs);
    return () => clearInterval(timer);
  }, [items.length, interval, onIndexChange, stopOnEnd]);
  const motionVariants: Variants = {
    initial: { y: 20, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: -20, opacity: 0 },
  };
  return (
    <div className={cn('relative inline-block whitespace-nowrap', className)}>
      <AnimatePresence mode='popLayout' initial={false}>
        <motion.div key={currentIndex} initial='initial' animate='animate' exit='exit' transition={transition} variants={variants || motionVariants}>
          {items[currentIndex]}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// --- BUILT-IN BLUR FADE ANIMATION COMPONENT ---
interface BlurFadeProps { children: React.ReactNode; className?: string; variant?: { hidden: { y: number }; visible: { y: number } }; duration?: number; delay?: number; yOffset?: number; inView?: boolean; inViewMargin?: string; blur?: string; key?: string | number; }
function BlurFade({ children, className, variant, duration = 0.4, delay = 0, yOffset = 6, inView = true, inViewMargin = "-50px", blur = "6px" }: BlurFadeProps) {
  const ref = useRef(null);
  const inViewResult = useInView(ref, { once: true, margin: inViewMargin as any });
  const isInView = !inView || inViewResult;
  const defaultVariants: Variants = {
    hidden: { y: yOffset, opacity: 0, filter: `blur(${blur})` },
    visible: { y: -yOffset, opacity: 1, filter: `blur(0px)` },
  };
  const combinedVariants = variant || defaultVariants;
  return (
    <motion.div ref={ref} initial="hidden" animate={isInView ? "visible" : "hidden"} exit="hidden" variants={combinedVariants} transition={{ delay: 0.04 + delay, duration, ease: "easeOut" }} className={className}>
      {children}
    </motion.div>
  );
}

// --- BUILT-IN GLASS BUTTON COMPONENT ---
const glassButtonVariants = cva("relative isolate all-unset cursor-pointer rounded-full transition-all", { variants: { size: { default: "text-base font-medium", sm: "text-sm font-medium", lg: "text-lg font-medium", icon: "h-10 w-10" } }, defaultVariants: { size: "default" } });
const glassButtonTextVariants = cva("glass-button-text relative block select-none tracking-tighter", { variants: { size: { default: "px-6 py-3.5", sm: "px-4 py-2", lg: "px-8 py-4", icon: "flex h-10 w-10 items-center justify-center" } }, defaultVariants: { size: "default" } });
export interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof glassButtonVariants> { contentClassName?: string; }
const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({ className, children, size, contentClassName, onClick, ...props }, ref) => {
    const handleWrapperClick = (e: React.MouseEvent<HTMLDivElement>) => {
      const button = e.currentTarget.querySelector('button');
      if (button && e.target !== button) button.click();
    };
    return (
      <div className={cn("glass-button-wrap cursor-pointer rounded-full relative", className)} onClick={handleWrapperClick}>
        <button className={cn("glass-button relative z-10", glassButtonVariants({ size }))} ref={ref} onClick={onClick} {...props}>
          <span className={cn(glassButtonTextVariants({ size }), contentClassName)}>{children}</span>
        </button>
        <div className="glass-button-shadow rounded-full pointer-events-none"></div>
      </div>
    );
  }
);
GlassButton.displayName = "GlassButton";

// --- PARTICLES BACKGROUND FOR COSMIC THEME ---
const ParticlesBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (canvas) {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
      }
    };
    window.addEventListener("resize", handleResize);

    const particles: Array<{
      x: number;
      y: number;
      size: number;
      speed: number;
      opacity: number;
      color: string;
    }> = [];

    const colors = [
      "rgba(108, 59, 255, ",
      "rgba(59, 130, 246, ",
      "rgba(167, 139, 250, ",
    ];

    const density = 60; // perfect density for auth screen

    for (let i = 0; i < density; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 2 + 1,
        speed: Math.random() * 0.4 + 0.1,
        opacity: Math.random() * 0.4 + 0.2,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    let animationFrameId: number;
    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      const shouldAnimate = !mediaQuery.matches;

      for (let i = 0; i < density; i++) {
        const p = particles[i];

        ctx.fillStyle = `${p.color}${p.opacity})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        if (shouldAnimate) {
          p.y -= p.speed;
          if (p.y < -10) {
            p.y = height + 10;
            p.x = Math.random() * width;
          }
        }
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-0"
    />
  );
};

// --- SVG GRADIENT BACKGROUND ---
const GradientBackground = () => (
    <>
        <style>
            {` @keyframes float1 { 0% { transform: translate(0, 0); } 50% { transform: translate(-10px, 10px); } 100% { transform: translate(0, 0); } } @keyframes float2 { 0% { transform: translate(0, 0); } 50% { transform: translate(10px, -10px); } 100% { transform: translate(0, 0); } } `}
        </style>
        <svg width="100%" height="100%" viewBox="0 0 800 600" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" className="absolute top-0 left-0 w-full h-full opacity-60">
            <defs>
                <linearGradient id="rev_grad1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style={{stopColor: '#6c3bff', stopOpacity:0.6}} /><stop offset="100%" style={{stopColor: '#8b5cf6', stopOpacity:0.4}} /></linearGradient>
                <linearGradient id="rev_grad2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style={{stopColor: '#4f46e5', stopOpacity:0.7}} /><stop offset="50%" style={{stopColor: '#1e1b4b', stopOpacity:0.5}} /><stop offset="100%" style={{stopColor: '#6c3bff', stopOpacity:0.4}} /></linearGradient>
                <radialGradient id="rev_grad3" cx="50%" cy="50%" r="50%"><stop offset="0%" style={{stopColor: '#1a103c', stopOpacity:0.7}} /><stop offset="100%" style={{stopColor: '#090514', stopOpacity:0.3}} /></radialGradient>
                <filter id="rev_blur1" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="35"/></filter>
                <filter id="rev_blur2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="25"/></filter>
                <filter id="rev_blur3" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="45"/></filter>
            </defs>
            <g style={{ animation: 'float1 20s ease-in-out infinite' }}>
                <ellipse cx="200" cy="500" rx="250" ry="180" fill="url(#rev_grad1)" filter="url(#rev_blur1)" transform="rotate(-30 200 500)"/>
                <rect x="500" y="100" width="300" height="250" rx="80" fill="url(#rev_grad2)" filter="url(#rev_blur2)" transform="rotate(15 650 225)"/>
            </g>
            <g style={{ animation: 'float2 25s ease-in-out infinite' }}>
                <circle cx="650" cy="450" r="150" fill="url(#rev_grad3)" filter="url(#rev_blur3)" opacity="0.6"/>
                <ellipse cx="50" cy="150" rx="180" ry="120" fill="#2d1b69" filter="url(#rev_blur2)" opacity="0.6"/>
            </g>
        </svg>
        <ParticlesBackground />
    </>
);

const modalSteps = [
    { message: "Signing you up...", icon: <Loader className="w-12 h-12 text-primary animate-spin" /> },
    { message: "Onboarding you...", icon: <Loader className="w-12 h-12 text-primary animate-spin" /> },
    { message: "Finalizing...", icon: <Loader className="w-12 h-12 text-primary animate-spin" /> },
    { message: "Welcome Aboard!", icon: <PartyPopper className="w-12 h-12 text-green-500" /> }
];
const TEXT_LOOP_INTERVAL = 1.3;

interface AuthComponentProps {
  onAuthSuccess: (email: string, name: string) => void;
}

export const AuthComponent = ({ onAuthSuccess }: AuthComponentProps) => {
  const [isSignIn, setIsSignIn] = useState(false); // Default "New User" selected
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Auth step for sign-up (name -> email -> password -> confirmPassword)
  const [authStep, setAuthStep] = useState("name");
  const [modalStatus, setModalStatus] = useState<'closed' | 'loading' | 'error' | 'success'>('closed');
  const [modalErrorMessage, setModalErrorMessage] = useState('');
  const confettiRef = useRef<ConfettiRef>(null);

  const isNameValid = name.trim().length >= 2;
  const isEmailValid = /\S+@\S+\.\S+/.test(email);
  const isPasswordValid = password.length >= 6;
  const isConfirmPasswordValid = confirmPassword.length >= 6;
  
  const nameInputRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const confirmPasswordInputRef = useRef<HTMLInputElement>(null);
  
  const fireSideCanons = () => {
    const fire = confettiRef.current?.fire;
    if (fire) {
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };
        const particleCount = 50;
        fire({ ...defaults, particleCount, origin: { x: 0, y: 1 }, angle: 60 });
        fire({ ...defaults, particleCount, origin: { x: 1, y: 1 }, angle: 120 });
    }
  };

  const handleFinalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (modalStatus !== 'closed') return;

    if (isSignIn) {
      // SIGN IN logic
      if (!isEmailValid) {
        setModalErrorMessage("Please enter a valid email address.");
        setModalStatus('error');
        return;
      }
      if (password.length < 6) {
        setModalErrorMessage("Password must be at least 6 characters.");
        setModalStatus('error');
        return;
      }

      const usersRaw = localStorage.getItem("deadlineos_users");
      const users = usersRaw ? JSON.parse(usersRaw) : [];
      const user = users.find((u: any) => u.email.toLowerCase() === email.toLowerCase());

      const hashedInput = simpleHash(password);
      if (!user) {
        setModalErrorMessage("Invalid email or password. Try again.");
        setModalStatus('error');
      } else if (user.password !== hashedInput && user.password !== password) {
        setModalErrorMessage("Wrong password. Forgot it? Start fresh.");
        setModalStatus('error');
      } else {
        // Upgrade plaintext password to hash if matched on plaintext
        if (user.password === password) {
          user.password = hashedInput;
          localStorage.setItem("deadlineos_users", JSON.stringify(users));
        }
        // Success
        const resolvedName = user.name || user.email.split('@')[0];
        const session = { email: user.email, name: resolvedName, loggedInAt: Date.now(), isNewUser: false };
        localStorage.setItem("deadlineos_session", JSON.stringify(session));
        
        setModalStatus('success');
        setTimeout(() => {
          onAuthSuccess(user.email, resolvedName);
        }, 1000);
      }
    } else {
      // SIGN UP logic
      if (authStep !== 'confirmPassword') return;

      if (password !== confirmPassword) {
        setModalErrorMessage("Passwords do not match!");
        setModalStatus('error');
      } else {
        setModalStatus('loading');
        const loadingStepsCount = modalSteps.length - 1;
        const totalDuration = loadingStepsCount * TEXT_LOOP_INTERVAL * 1000;
        
        setTimeout(() => {
          const usersRaw = localStorage.getItem("deadlineos_users");
          const users = usersRaw ? JSON.parse(usersRaw) : [];
          
          // check if user already exists
          const existingUser = users.find((u: any) => u.email.toLowerCase() === email.toLowerCase());
          if (existingUser) {
            setModalStatus('error');
            setModalErrorMessage("Email is already registered. Try signing in.");
            return;
          }

          // Create user credentials
          const newUser = {
            name: name.trim(),
            email: email,
            password: simpleHash(password),
            createdAt: Date.now(),
            tasks: [],
            xp: 0,
            streak: 0,
            achievements: [],
            level: "Procrastinator"
          };
          
          users.push(newUser);
          localStorage.setItem("deadlineos_users", JSON.stringify(users));

          // Also set user session
          const session = { email: email, name: name.trim(), loggedInAt: Date.now(), isNewUser: true };
          localStorage.setItem("deadlineos_session", JSON.stringify(session));

          // STEP 2 — NEW USER DATA INITIALIZATION:
          localStorage.setItem(`deadlineos_data_${email}`, JSON.stringify({
            tasks: [],
            xp: 0,
            streak: 0,
            achievements: [],
            level: "Procrastinator",
            createdAt: Date.now()
          }));

          fireSideCanons();
          setModalStatus('success');

          setTimeout(() => {
            onAuthSuccess(email, name.trim());
          }, 1200);

        }, totalDuration);
      }
    }
  };

  const handleProgressStep = () => {
    if (authStep === 'name') {
        if (isNameValid) setAuthStep("email");
    } else if (authStep === 'email') {
        if (isEmailValid) setAuthStep("password");
    } else if (authStep === 'password') {
        if (isPasswordValid) setAuthStep("confirmPassword");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        handleProgressStep();
    }
  };

  const handleGoBack = () => {
    if (authStep === 'confirmPassword') {
        setAuthStep('password');
        setConfirmPassword('');
    }
    else if (authStep === 'password') setAuthStep('email');
    else if (authStep === 'email') setAuthStep('name');
  };

  const closeModal = () => {
    setModalStatus('closed');
    setModalErrorMessage('');
  };

  useEffect(() => {
    if (authStep === 'name') setTimeout(() => nameInputRef.current?.focus(), 500);
    else if (authStep === 'email') setTimeout(() => emailInputRef.current?.focus(), 500);
    else if (authStep === 'password') setTimeout(() => passwordInputRef.current?.focus(), 500);
    else if (authStep === 'confirmPassword') setTimeout(() => confirmPasswordInputRef.current?.focus(), 500);
  }, [authStep]);

  useEffect(() => {
    if (modalStatus === 'success') {
        fireSideCanons();
    }
  }, [modalStatus]);
  
  const Modal = () => (
    <AnimatePresence>
        {modalStatus !== 'closed' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-[#0d0d1a]/95 border-4 border-[#252545] rounded-2xl p-8 w-full max-w-sm flex flex-col items-center gap-4 mx-2 text-center shadow-2xl">
                    {(modalStatus === 'error' || modalStatus === 'success') && <button onClick={closeModal} className="absolute top-3 right-3 p-1.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer"><X className="w-5 h-5" /></button>}
                    {modalStatus === 'error' && <>
                        <AlertCircle className="w-12 h-12 text-rose-500" />
                        <p className="text-lg font-bold text-white">{modalErrorMessage}</p>
                        <GlassButton onClick={closeModal} size="sm" className="mt-4">Try Again</GlassButton>
                    </>}
                    {modalStatus === 'loading' && 
                        <TextLoop interval={TEXT_LOOP_INTERVAL} stopOnEnd={true}>
                            {modalSteps.slice(0, -1).map((step, i) => 
                                <div key={i} className="flex flex-col items-center gap-4">
                                    {step.icon}
                                    <p className="text-lg font-bold text-white">{step.message}</p>
                                </div>
                            )}
                        </TextLoop>
                    }
                    {modalStatus === 'success' &&
                        <div className="flex flex-col items-center gap-4">
                            {modalSteps[modalSteps.length - 1].icon}
                            <p className="text-lg font-bold text-white">{modalSteps[modalSteps.length - 1].message}</p>
                        </div>
                    }
                </motion.div>
            </motion.div>
        )}
    </AnimatePresence>
  );

  return (
    <div className="bg-[#080810] min-h-screen w-screen flex flex-col overflow-y-auto">
        <style>{`
            input[type="password"]::-ms-reveal, input[type="password"]::-ms-clear { display: none !important; } input[type="password"]::-webkit-credentials-auto-fill-button, input[type="password"]::-webkit-strong-password-auto-fill-button { display: none !important; } input:-webkit-autofill, input:-webkit-autofill:hover, input:-webkit-autofill:focus, input:-webkit-autofill:active { -webkit-box-shadow: 0 0 0 30px transparent inset !important; -webkit-text-fill-color: var(--foreground, #ffffff) !important; background-color: transparent !important; background-clip: content-box !important; transition: background-color 5000s ease-in-out 0s !important; color: var(--foreground, #ffffff) !important; caret-color: var(--foreground, #ffffff) !important; } input:autofill { background-color: transparent !important; background-clip: content-box !important; -webkit-text-fill-color: var(--foreground, #ffffff) !important; color: var(--foreground, #ffffff) !important; } input:-internal-autofill-selected { background-color: transparent !important; background-image: none !important; color: var(--foreground, #ffffff) !important; -webkit-text-fill-color: var(--foreground, #ffffff) !important; } input:-webkit-autofill::first-line { color: var(--foreground, #ffffff) !important; -webkit-text-fill-color: var(--foreground, #ffffff) !important; }
            @property --angle-1 { syntax: "<angle>"; inherits: false; initial-value: -75deg; } @property --angle-2 { syntax: "<angle>"; inherits: false; initial-value: -45deg; }
            .glass-button-wrap { --anim-time: 400ms; --anim-ease: cubic-bezier(0.25, 1, 0.5, 1); --border-width: clamp(1px, 0.0625em, 4px); position: relative; z-index: 2; transform-style: preserve-3d; transition: transform var(--anim-time) var(--anim-ease); } .glass-button-wrap:has(.glass-button:active) { transform: rotateX(25deg); } .glass-button-shadow { --shadow-cutoff-fix: 2em; position: absolute; width: calc(100% + var(--shadow-cutoff-fix)); height: calc(100% + var(--shadow-cutoff-fix)); top: calc(0% - var(--shadow-cutoff-fix) / 2); left: calc(0% - var(--shadow-cutoff-fix) / 2); filter: blur(clamp(2px, 0.125em, 12px)); transition: filter var(--anim-time) var(--anim-ease); pointer-events: none; z-index: 0; } .glass-button-shadow::after { content: ""; position: absolute; inset: 0; border-radius: 9999px; background: linear-gradient(180deg, oklch(from var(--foreground, #ffffff) l c h / 20%), oklch(from var(--foreground, #ffffff) l c h / 10%)); width: calc(100% - var(--shadow-cutoff-fix) - 0.25em); height: calc(100% - var(--shadow-cutoff-fix) - 0.25em); top: calc(var(--shadow-cutoff-fix) - 0.5em); left: calc(var(--shadow-cutoff-fix) - 0.875em); padding: 0.125em; box-sizing: border-box; mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); mask-composite: exclude; transition: all var(--anim-time) var(--anim-ease); opacity: 1; }
            .glass-button { -webkit-tap-highlight-color: transparent; backdrop-filter: blur(clamp(1px, 0.125em, 4px)); transition: all var(--anim-time) var(--anim-ease); background: linear-gradient(-75deg, oklch(from var(--background, #0f0f1a) l c h / 5%), oklch(from var(--background, #0f0f1a) l c h / 20%), oklch(from var(--background, #0f0f1a) l c h / 5%)); box-shadow: inset 0 0.125em 0.125em oklch(from var(--foreground, #ffffff) l c h / 5%), inset 0 -0.125em 0.125em oklch(from var(--background, #0f0f1a) l c h / 50%), 0 0.25em 0.125em -0.125em oklch(from var(--foreground, #ffffff) l c h / 20%), 0 0 0.1em 0.25em inset oklch(from var(--background, #0f0f1a) l c h / 20%), 0 0 0 0 oklch(from var(--background, #0f0f1a) l c h); } .glass-button:hover { transform: scale(0.975); backdrop-filter: blur(0.01em); box-shadow: inset 0 0.125em 0.125em oklch(from var(--foreground, #ffffff) l c h / 5%), inset 0 -0.125em 0.125em oklch(from var(--background, #0f0f1a) l c h / 50%), 0 0.15em 0.05em -0.1em oklch(from var(--foreground, #ffffff) l c h / 25%), 0 0 0.05em 0.1em inset oklch(from var(--background, #0f0f1a) l c h / 50%), 0 0 0 0 oklch(from var(--background, #0f0f1a) l c h); } .glass-button-text { color: oklch(from var(--foreground, #ffffff) l c h / 90%); text-shadow: 0em 0.25em 0.05em oklch(from var(--foreground, #ffffff) l c h / 10%); transition: all var(--anim-time) var(--anim-ease); } .glass-button:hover .glass-button-text { text-shadow: 0.025em 0.025em 0.025em oklch(from var(--foreground, #ffffff) l c h / 12%); } .glass-button-text::after { content: ""; display: block; position: absolute; width: calc(100% - var(--border-width)); height: calc(100% - var(--border-width)); top: calc(0% + var(--border-width) / 2); left: calc(0% + var(--border-width) / 2); box-sizing: border-box; border-radius: 9999px; overflow: clip; background: linear-gradient(var(--angle-2), transparent 0%, oklch(from var(--background, #0f0f1a) l c h / 50%) 40% 50%, transparent 55%); z-index: 3; mix-blend-mode: screen; pointer-events: none; background-size: 200% 200%; background-position: 0% 50%; transition: background-position calc(var(--anim-time) * 1.25) var(--anim-ease), --angle-2 calc(var(--anim-time) * 1.25) var(--anim-ease); } .glass-button:hover .glass-button-text::after { background-position: 25% 50%; } .glass-button:active .glass-button-text::after { background-position: 50% 15%; --angle-2: -15deg; } .glass-button::after { content: ""; position: absolute; z-index: 1; inset: 0; border-radius: 9999px; width: calc(100% + var(--border-width)); height: calc(100% + var(--border-width)); top: calc(0% - var(--border-width) / 2); left: calc(0% - var(--border-width) / 2); padding: var(--border-width); box-sizing: border-box; background: conic-gradient(from var(--angle-1) at 50% 50%, oklch(from var(--foreground, #ffffff) l c h / 50%) 0%, transparent 5% 40%, oklch(from var(--foreground, #ffffff) l c h / 50%) 50%, transparent 60% 95%, oklch(from var(--foreground, #ffffff) l c h / 50%) 100%), linear-gradient(180deg, oklch(from var(--background, #0f0f1a) l c h / 50%), oklch(from var(--background, #0f0f1a) l c h / 50%)); mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); mask-composite: exclude; transition: all var(--anim-time) var(--anim-ease), --angle-1 500ms ease; box-shadow: inset 0 0 0 calc(var(--border-width) / 2) oklch(from var(--background, #0f0f1a) l c h / 50%); pointer-events: none; } .glass-button:hover::after { --angle-1: -125deg; } .glass-button:active::after { --angle-1: -75deg; } .glass-button-wrap:has(.glass-button:hover) .glass-button-shadow { filter: blur(clamp(2px, 0.0625em, 6px)); } .glass-button-wrap:has(.glass-button:hover) .glass-button-shadow::after { top: calc(var(--shadow-cutoff-fix) - 0.875em); opacity: 1; } .glass-button-wrap:has(.glass-button:active) .glass-button-shadow { filter: blur(clamp(2px, 0.125em, 12px)); } .glass-button-wrap:has(.glass-button:active) .glass-button-shadow::after { top: calc(var(--shadow-cutoff-fix) - 0.5em); opacity: 0.75; } .glass-button-wrap:has(.glass-button:active) .glass-button-text { text-shadow: 0.025em 0.25em 0.05em oklch(from var(--foreground, #ffffff) l c h / 12%); } .glass-button-wrap:has(.glass-button:active) .glass-button { box-shadow: inset 0 0.125em 0.125em oklch(from var(--foreground, #ffffff) l c h / 5%), inset 0 -0.125em 0.125em oklch(from var(--background, #0f0f1a) l c h / 50%), 0 0.125em 0.125em -0.125em oklch(from var(--foreground, #ffffff) l c h / 20%), 0 0 0.1em 0.25em inset oklch(from var(--background, #0f0f1a) l c h / 20%), 0 0.225em 0.05em 0 oklch(from var(--foreground, #ffffff) l c h / 5%), 0 0.25em 0 0 oklch(from var(--background, #0f0f1a) l c h / 75%), inset 0 0.25em 0.05em 0 oklch(from var(--foreground, #ffffff) l c h / 15%); } @media (hover: none) and (pointer: coarse) { .glass-button::after, .glass-button:hover::after, .glass-button:active::after { --angle-1: -75deg; } .glass-button .glass-button-text::after, .glass-button:active .glass-button-text::after { --angle-2: -45deg; } }
            .glass-input-wrap { position: relative; z-index: 2; transform-style: preserve-3d; border-radius: 9999px; } .glass-input { display: flex; position: relative; width: 100%; align-items: center; gap: 0.5rem; border-radius: 9999px; padding: 0.25rem; -webkit-tap-highlight-color: transparent; backdrop-filter: blur(clamp(1px, 0.125em, 4px)); transition: all 400ms cubic-bezier(0.25, 1, 0.5, 1); background: linear-gradient(-75deg, oklch(from var(--background, #0f0f1a) l c h / 5%), oklch(from var(--background, #0f0f1a) l c h / 20%), oklch(from var(--background, #0f0f1a) l c h / 5%)); box-shadow: inset 0 0.125em 0.125em oklch(from var(--foreground, #ffffff) l c h / 5%), inset 0 -0.125em 0.125em oklch(from var(--background, #0f0f1a) l c h / 50%), 0 0.25em 0.125em -0.125em oklch(from var(--foreground, #ffffff) l c h / 20%), 0 0 0.1em 0.25em inset oklch(from var(--background, #0f0f1a) l c h / 20%), 0 0 0 0 oklch(from var(--background, #0f0f1a) l c h); } .glass-input-wrap:focus-within .glass-input { backdrop-filter: blur(0.01em); box-shadow: inset 0 0.125em 0.125em oklch(from var(--foreground, #ffffff) l c h / 5%), inset 0 -0.125em 0.125em oklch(from var(--background, #0f0f1a) l c h / 50%), 0 0.15em 0.05em -0.1em oklch(from var(--foreground, #ffffff) l c h / 25%), 0 0 0.05em 0.1em inset oklch(from var(--background, #0f0f1a) l c h / 50%), 0 0 0 0 oklch(from var(--background, #0f0f1a) l c h); } .glass-input::after { content: ""; position: absolute; z-index: 1; inset: 0; border-radius: 9999px; width: calc(100% + clamp(1px, 0.0625em, 4px)); height: calc(100% + clamp(1px, 0.0625em, 4px)); top: calc(0% - clamp(1px, 0.0625em, 4px) / 2); left: calc(0% - clamp(1px, 0.0625em, 4px) / 2); padding: clamp(1px, 0.0625em, 4px); box-sizing: border-box; background: conic-gradient(from var(--angle-1) at 50% 50%, oklch(from var(--foreground, #ffffff) l c h / 50%) 0%, transparent 5% 40%, oklch(from var(--foreground, #ffffff) l c h / 50%) 50%, transparent 60% 95%, oklch(from var(--foreground, #ffffff) l c h / 50%) 100%), linear-gradient(180deg, oklch(from var(--background, #0f0f1a) l c h / 50%), oklch(from var(--background, #0f0f1a) l c h / 50%)); mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); mask-composite: exclude; transition: all 400ms cubic-bezier(0.25, 1, 0.5, 1), --angle-1 500ms ease; box-shadow: inset 0 0 0 calc(clamp(1px, 0.0625em, 4px) / 2) oklch(from var(--background, #0f0f1a) l c h / 50%); pointer-events: none; } .glass-input-wrap:focus-within .glass-input::after { --angle-1: -125deg; } .glass-input-text-area { position: absolute; inset: 0; border-radius: 9999px; pointer-events: none; } .glass-input-text-area::after { content: ""; display: block; position: absolute; width: calc(100% - clamp(1px, 0.0625em, 4px)); height: calc(100% - clamp(1px, 0.0625em, 4px)); top: calc(0% + clamp(1px, 0.0625em, 4px) / 2); left: calc(0% + clamp(1px, 0.0625em, 4px) / 2); box-sizing: border-box; border-radius: 9999px; overflow: clip; background: linear-gradient(var(--angle-2), transparent 0%, oklch(from var(--background, #0f0f1a) l c h / 50%) 40% 50%, transparent 55%); z-index: 3; mix-blend-mode: screen; pointer-events: none; background-size: 200% 200%; background-position: 0% 50%; transition: background-position calc(400ms * 1.25) cubic-bezier(0.25, 1, 0.5, 1), --angle-2 calc(400ms * 1.25) cubic-bezier(0.25, 1, 0.5, 1); } .glass-input-wrap:focus-within .glass-input-text-area::after { background-position: 25% 50%; }
        `}</style>

        <Confetti ref={confettiRef} manualstart className="fixed top-0 left-0 w-full h-full pointer-events-none z-[999]" />
        <Modal />

        <div className="fixed top-6 left-6 z-20 flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600 shadow-lg shadow-indigo-500/20">
              <Cpu className="w-4.5 h-4.5 text-white animate-pulse" />
            </div>
            <h1 className="text-base font-bold text-white tracking-wider font-mono">DeadlineOS</h1>
        </div>

        <div className="flex w-full flex-1 min-h-screen items-center justify-center relative overflow-hidden py-16 px-4">
            <div className="absolute inset-0 z-0"><GradientBackground /></div>
            
            <fieldset disabled={modalStatus !== 'closed'} className="relative z-10 flex flex-col items-center gap-6 w-full max-w-[420px] mx-auto p-10 bg-[#0f0f1e] border border-[#2a2a4a] rounded-[20px] shadow-[0_0_60px_rgba(108,59,255,0.08)] backdrop-blur-md">
                
                {/* Auth Mode Toggle Selector */}
                <div className="relative flex bg-[#0a0a18] p-1 rounded-full w-full max-w-[280px] mx-auto mt-2 border border-[#2a2a4a]">
                  <button
                    type="button"
                    onClick={() => {
                      setIsSignIn(false);
                      setAuthStep("name");
                      setName("");
                      setEmail("");
                      setPassword("");
                      setConfirmPassword("");
                      setModalErrorMessage("");
                    }}
                    className={cn(
                      "relative flex-1 text-xs font-mono font-bold py-2.5 rounded-full transition-colors cursor-pointer text-center z-10",
                      !isSignIn ? "text-white" : "text-[#666688] hover:text-slate-200"
                    )}
                  >
                    {!isSignIn && (
                      <motion.div
                        layoutId="activeAuthTab"
                        className="absolute inset-0 bg-[#6c3bff] rounded-full -z-10"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    )}
                    New User
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSignIn(true);
                      setModalErrorMessage("");
                    }}
                    className={cn(
                      "relative flex-1 text-xs font-mono font-bold py-2.5 rounded-full transition-colors cursor-pointer text-center z-10",
                      isSignIn ? "text-white" : "text-[#666688] hover:text-slate-200"
                    )}
                  >
                    {isSignIn && (
                      <motion.div
                        layoutId="activeAuthTab"
                        className="absolute inset-0 bg-[#6c3bff] rounded-full -z-10"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    )}
                    Sign In
                  </button>
                </div>

                {/* Smooth transition between modes */}
                <AnimatePresence mode="wait">
                  {!isSignIn ? (
                    <motion.div
                      key="signup-flow"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                      className="w-full flex flex-col items-center gap-6 animate-app-fade-in"
                    >
                      <AnimatePresence mode="wait">
                        {authStep === "name" && (
                          <motion.div key="name-content" initial={{ y: 6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3, ease: "easeOut" }} className="w-full flex flex-col items-center gap-4 text-center">
                            <BlurFade delay={0.1} className="w-full">
                              <div className="text-center">
                                <p className="font-sans font-bold text-3xl sm:text-4xl tracking-tight text-white whitespace-nowrap">What should we call you?</p>
                              </div>
                            </BlurFade>
                            <BlurFade delay={0.2}>
                              <p className="text-sm font-medium text-slate-400">This is how DeadlineOS will address you.</p>
                            </BlurFade>
                          </motion.div>
                        )}
                        {authStep === "email" && (
                          <motion.div key="email-content" initial={{ y: 6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3, ease: "easeOut" }} className="w-full flex flex-col items-center gap-4">
                            <BlurFade delay={0.1} className="w-full">
                              <div className="text-center">
                                <p className="font-sans font-bold text-3xl sm:text-4xl tracking-tight text-white whitespace-nowrap">Welcome to DeadlineOS</p>
                              </div>
                            </BlurFade>
                            <BlurFade delay={0.2}>
                              <p className="text-sm font-medium text-slate-400">Enter email to secure your identity</p>
                            </BlurFade>
                          </motion.div>
                        )}
                        {authStep === "password" && (
                          <motion.div key="password-title" initial={{ y: 6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3, ease: "easeOut" }} className="w-full flex flex-col items-center text-center gap-4">
                            <BlurFade delay={0} className="w-full">
                              <div className="text-center">
                                <p className="font-sans font-bold text-3xl sm:text-4xl tracking-tight text-white whitespace-nowrap">Create password</p>
                              </div>
                            </BlurFade>
                            <BlurFade delay={0.1}>
                              <p className="text-sm font-medium text-slate-400">Password must be at least 6 characters long.</p>
                            </BlurFade>
                          </motion.div>
                        )}
                        {authStep === "confirmPassword" && (
                          <motion.div key="confirm-title" initial={{ y: 6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3, ease: "easeOut" }} className="w-full flex flex-col items-center text-center gap-4">
                             <BlurFade delay={0} className="w-full">
                               <div className="text-center">
                                 <p className="font-sans font-bold text-3xl sm:text-4xl tracking-tight text-white whitespace-nowrap">One Last Step</p>
                               </div>
                             </BlurFade>
                             <BlurFade delay={0.1}>
                               <p className="text-sm font-medium text-slate-400">Confirm your password to continue</p>
                             </BlurFade>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      
                      <form onSubmit={handleFinalSubmit} className="w-full space-y-5">
                        <AnimatePresence mode="wait">
                          {authStep === 'name' && (
                            <motion.div key="name-field-block" initial={{ opacity: 0, filter: 'blur(4px)' }} animate={{ opacity: 1, filter: 'blur(0px)' }} exit={{ opacity: 0, filter: 'blur(4px)' }} transition={{ duration: 0.3 }} className="w-full space-y-5">
                              <BlurFade delay={0.1} inView={true} className="w-full">
                                <div className="relative w-full">
                                    <div className="glass-input-wrap w-full"><div className="glass-input">
                                        <span className="glass-input-text-area"></span>
                                        <div className="relative z-10 flex-shrink-0 flex items-center justify-center w-10 pl-2">
                                          <User className="h-5 w-5 text-indigo-400 flex-shrink-0" />
                                        </div>
                                        <input ref={nameInputRef} type="text" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={handleKeyDown} className="relative z-10 h-full w-0 flex-grow bg-transparent text-white placeholder:text-slate-500 focus:outline-none py-2.5 pr-2" />
                                        <div className={cn( "relative z-10 flex-shrink-0 overflow-hidden transition-all duration-300 ease-in-out", isNameValid ? "w-10 pr-1" : "w-0" )}><GlassButton type="button" onClick={handleProgressStep} size="icon" aria-label="Continue with name" contentClassName="text-white"><ArrowRight className="w-5 h-5 text-indigo-400" /></GlassButton></div>
                                    </div></div>
                                </div>
                              </BlurFade>
                            </motion.div>
                          )}

                          {authStep !== 'name' && authStep !== 'confirmPassword' && (
                            <motion.div key="email-password-fields" initial={{ opacity: 0, filter: 'blur(4px)' }} animate={{ opacity: 1, filter: 'blur(0px)' }} exit={{ opacity: 0, filter: 'blur(4px)' }} transition={{ duration: 0.3, ease: "easeOut" }} className="w-full space-y-5">
                              <BlurFade delay={0.1} inView={true} className="w-full">
                                <div className="relative w-full">
                                    <AnimatePresence>
                                        {authStep === "password" && <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.3, delay: 0.2 }} className="absolute -top-5 left-4 z-10"><label className="text-[10px] text-[#8888cc] font-bold uppercase tracking-wider">Email</label></motion.div>}
                                    </AnimatePresence>
                                    <div className="glass-input-wrap w-full"><div className="glass-input">
                                        <span className="glass-input-text-area"></span>
                                        <div className={cn( "relative z-10 flex-shrink-0 flex items-center justify-center overflow-hidden transition-all duration-300 ease-in-out", email.length > 18 && authStep === 'email' ? "w-0 px-0" : "w-10 pl-2" )}><Mail className="h-5 w-5 text-indigo-400 flex-shrink-0" /></div>
                                        <input ref={emailInputRef} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={handleKeyDown} className={cn("relative z-10 h-full w-0 flex-grow bg-transparent text-white placeholder:text-slate-500 focus:outline-none transition-[padding-right] duration-300 ease-in-out py-2.5", isEmailValid && authStep === 'email' ? "pr-2" : "pr-0")} />
                                        <div className={cn( "relative z-10 flex-shrink-0 overflow-hidden transition-all duration-300 ease-in-out", isEmailValid && authStep === 'email' ? "w-10 pr-1" : "w-0" )}><GlassButton type="button" onClick={handleProgressStep} size="icon" aria-label="Continue with email" contentClassName="text-white"><ArrowRight className="w-5 h-5 text-indigo-400" /></GlassButton></div>
                                    </div></div>
                                </div>
                                {authStep === 'email' && (
                                  <BlurFade inView delay={0.1}>
                                    <button type="button" onClick={handleGoBack} className="mt-4 flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"><ArrowLeft className="w-4 h-4" /> Go back</button>
                                  </BlurFade>
                                )}
                              </BlurFade>
                              <AnimatePresence>
                                {authStep === "password" && (
                                  <BlurFade key="password-field" className="w-full">
                                    <div className="relative w-full mt-2">
                                        <AnimatePresence>
                                            {password.length > 0 && <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.3 }} className="absolute -top-5 left-4 z-10"><label className="text-[10px] text-[#8888cc] font-bold uppercase tracking-wider">Password</label></motion.div>}
                                        </AnimatePresence>
                                        <div className="glass-input-wrap w-full"><div className="glass-input">
                                            <span className="glass-input-text-area"></span>
                                            <div className="relative z-10 flex-shrink-0 flex items-center justify-center w-10 pl-2">
                                                {isPasswordValid ? <button type="button" aria-label="Toggle password visibility" onClick={() => setShowPassword(!showPassword)} className="text-white hover:text-indigo-400 transition-colors p-2 rounded-full cursor-pointer">{showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}</button> : <Lock className="h-5 w-5 text-indigo-400 flex-shrink-0" />}
                                            </div>
                                            <input ref={passwordInputRef} type={showPassword ? "text" : "password"} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={handleKeyDown} className="relative z-10 h-full w-0 flex-grow bg-transparent text-white placeholder:text-slate-500 focus:outline-none py-2.5" />
                                            <div className={cn( "relative z-10 flex-shrink-0 overflow-hidden transition-all duration-300 ease-in-out", isPasswordValid ? "w-10 pr-1" : "w-0" )}><GlassButton type="button" onClick={handleProgressStep} size="icon" aria-label="Submit password" contentClassName="text-white"><ArrowRight className="w-5 h-5 text-indigo-400" /></GlassButton></div>
                                        </div></div>
                                    </div>
                                    <BlurFade inView delay={0.1}>
                                      <button type="button" onClick={handleGoBack} className="mt-4 flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"><ArrowLeft className="w-4 h-4" /> Go back</button>
                                    </BlurFade>
                                  </BlurFade>
                                )}
                              </AnimatePresence>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <AnimatePresence mode="wait">
                          {authStep === 'confirmPassword' && (
                            <BlurFade key="confirm-password-field" className="w-full">
                              <div className="relative w-full">
                                  <AnimatePresence>
                                      {confirmPassword.length > 0 && <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.3 }} className="absolute -top-5 left-4 z-10"><label className="text-[10px] text-[#8888cc] font-bold uppercase tracking-wider">Confirm Password</label></motion.div>}
                                  </AnimatePresence>
                                  <div className="glass-input-wrap w-full"><div className="glass-input">
                                      <span className="glass-input-text-area"></span>
                                      <div className="relative z-10 flex-shrink-0 flex items-center justify-center w-10 pl-2">
                                          {isConfirmPasswordValid ? <button type="button" aria-label="Toggle confirm password visibility" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="text-white hover:text-indigo-400 transition-colors p-2 rounded-full cursor-pointer">{showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}</button> : <Lock className="h-5 w-5 text-indigo-400 flex-shrink-0" />}
                                      </div>
                                      <input ref={confirmPasswordInputRef} type={showConfirmPassword ? "text" : "password"} placeholder="Confirm Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="relative z-10 h-full w-0 flex-grow bg-transparent text-white placeholder:text-slate-500 focus:outline-none py-2.5" />
                                      <div className={cn( "relative z-10 flex-shrink-0 overflow-hidden transition-all duration-300 ease-in-out", isConfirmPasswordValid ? "w-10 pr-1" : "w-0" )}><GlassButton type="submit" size="icon" aria-label="Finish sign-up" contentClassName="text-white"><ArrowRight className="w-5 h-5 text-indigo-400" /></GlassButton></div>
                                  </div></div>
                              </div>
                              <BlurFade inView delay={0.1}>
                                <button type="button" onClick={handleGoBack} className="mt-4 flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"><ArrowLeft className="w-4 h-4" /> Go back</button>
                              </BlurFade>
                            </BlurFade>
                          )}
                        </AnimatePresence>
                      </form>

                      {/* Redirect link under the form */}
                      <div className="text-center text-xs text-slate-400 font-mono mt-2">
                        Already have an account?{" "}
                        <button
                          type="button"
                          onClick={() => {
                            setIsSignIn(true);
                            setModalErrorMessage("");
                          }}
                          className="text-[#6c3bff] hover:text-[#845ef7] font-sans font-bold hover:underline transition-colors cursor-pointer inline-flex items-center gap-1 ml-1"
                        >
                          Sign in &rarr;
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="signin-flow"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                      className="w-full flex flex-col items-center gap-6 animate-app-fade-in"
                    >
                      <div className="text-center">
                        <p className="font-sans font-bold text-3xl sm:text-4xl tracking-tight text-white whitespace-nowrap">Welcome to DeadlineOS</p>
                        <p className="text-sm font-medium text-slate-400 mt-2">Sign in to your dashboard</p>
                      </div>

                      <form onSubmit={handleFinalSubmit} className="w-full space-y-5">
                        <div className="space-y-4">
                          <div className="glass-input-wrap w-full">
                            <div className="glass-input">
                              <span className="glass-input-text-area"></span>
                              <div className="relative z-10 flex-shrink-0 flex items-center justify-center w-10 pl-2">
                                <Mail className="h-5 w-5 text-indigo-400 flex-shrink-0" />
                              </div>
                              <input
                                type="email"
                                placeholder="Email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="relative z-10 h-full w-full bg-transparent text-white placeholder:text-slate-500 focus:outline-none py-2.5 pr-4"
                                required
                              />
                            </div>
                          </div>

                          <div className="glass-input-wrap w-full">
                            <div className="glass-input">
                              <span className="glass-input-text-area"></span>
                              <div className="relative z-10 flex-shrink-0 flex items-center justify-center w-10 pl-2">
                                <Lock className="h-5 w-5 text-indigo-400 flex-shrink-0" />
                              </div>
                              <input
                                type="password"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="relative z-10 h-full w-full bg-transparent text-white placeholder:text-slate-500 focus:outline-none py-2.5 pr-4"
                                required
                              />
                            </div>
                          </div>
                        </div>

                        <div className="pt-2">
                          <GlassButton
                            type="submit"
                            className="w-full"
                            contentClassName="flex items-center justify-center gap-2 font-bold w-full text-white"
                          >
                            <span>Enter DeadlineOS</span>
                            <ArrowRight className="w-5 h-5 text-indigo-400" />
                          </GlassButton>
                        </div>
                      </form>

                      {/* Redirect link under the form */}
                      <div className="text-center text-xs text-slate-400 font-mono mt-2">
                        Don't have an account?{" "}
                        <button
                          type="button"
                          onClick={() => {
                            setIsSignIn(false);
                            setAuthStep("name");
                            setName("");
                            setEmail("");
                            setPassword("");
                            setConfirmPassword("");
                            setModalErrorMessage("");
                          }}
                          className="text-[#6c3bff] hover:text-[#845ef7] font-sans font-bold hover:underline transition-colors cursor-pointer inline-flex items-center gap-1 ml-1"
                        >
                          Sign up free &rarr;
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

            </fieldset>
        </div>
    </div>
  );
};
