import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X, Check, ChevronRight, Info, RotateCcw } from "lucide-react";

interface MathFormulaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (latex: string) => void;
}

// Symbol categories with common math/science formulas
const SYMBOL_CATEGORIES = [
  {
    label: "Basic",
    symbols: [
      { label: "Fraction", latex: "\\frac{a}{b}", preview: "a/b" },
      { label: "Square root", latex: "\\sqrt{x}", preview: "√x" },
      { label: "Power", latex: "x^{n}", preview: "xⁿ" },
      { label: "Subscript", latex: "x_{n}", preview: "xₙ" },
      { label: "Absolute value", latex: "\\left|x\\right|", preview: "|x|" },
      { label: "Infinity", latex: "\\infty", preview: "∞" },
      { label: "Pi", latex: "\\pi", preview: "π" },
      { label: "Plus/minus", latex: "\\pm", preview: "±" },
      { label: "Not equal", latex: "\\neq", preview: "≠" },
      { label: "Approx", latex: "\\approx", preview: "≈" },
      { label: "Less/equal", latex: "\\leq", preview: "≤" },
      { label: "Greater/equal", latex: "\\geq", preview: "≥" },
      { label: "Proportional", latex: "\\propto", preview: "∝" },
    ],
  },
  {
    label: "Algebra",
    symbols: [
      { label: "Sum", latex: "\\sum_{i=1}^{n}", preview: "Σ" },
      { label: "Product", latex: "\\prod_{i=1}^{n}", preview: "Π" },
      { label: "Nth root", latex: "\\sqrt[n]{x}", preview: "ⁿ√x" },
      {
        label: "Quadratic",
        latex: "x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}",
        preview: "Quadratic",
      },
      { label: "Logarithm", latex: "\\log_{b}{x}", preview: "logₓ" },
      { label: "Natural Log", latex: "\\ln(x)", preview: "ln(x)" },
      { label: "Exponential", latex: "e^{x}", preview: "eˣ" },
      { label: "Factorial", latex: "n!", preview: "n!" },
      { label: "Binomial", latex: "\\binom{n}{k}", preview: "C(n,k)" },
      {
        label: "Cases",
        latex: "\\begin{cases} a \\\\ b \\end{cases}",
        preview: "{a;b}",
      },
      {
        label: "Difference of sq",
        latex: "a^2 - b^2 = (a-b)(a+b)",
        preview: "a²-b²",
      },
      {
        label: "Perfect square",
        latex: "(a+b)^2 = a^2+2ab+b^2",
        preview: "(a+b)²",
      },
    ],
  },
  {
    label: "Geometry & Trig",
    symbols: [
      { label: "sin", latex: "\\sin(\\theta)", preview: "sin θ" },
      { label: "cos", latex: "\\cos(\\theta)", preview: "cos θ" },
      { label: "tan", latex: "\\tan(\\theta)", preview: "tan θ" },
      { label: "sin⁻¹", latex: "\\sin^{-1}(x)", preview: "sin⁻¹" },
      { label: "csc", latex: "\\csc(\\theta)", preview: "csc θ" },
      { label: "sec", latex: "\\sec(\\theta)", preview: "sec θ" },
      { label: "cot", latex: "\\cot(\\theta)", preview: "cot θ" },
      { label: "Degrees", latex: "90^{\\circ}", preview: "90°" },
      { label: "Pythagorean", latex: "a^2 + b^2 = c^2", preview: "a²+b²=c²" },
      { label: "Area Circle", latex: "A = \\pi r^2", preview: "πr²" },
      { label: "Circumference", latex: "C = 2\\pi r", preview: "2πr" },
      {
        label: "Vol Sphere",
        latex: "V = \\frac{4}{3}\\pi r^3",
        preview: "V(sphere)",
      },
      {
        label: "Law of Sines",
        latex: "\\frac{a}{\\sin A} = \\frac{b}{\\sin B}",
        preview: "sin A",
      },
      {
        label: "Law of Cosines",
        latex: "c^2 = a^2+b^2-2ab\\cos C",
        preview: "cos C",
      },
    ],
  },
  {
    label: "Calculus",
    symbols: [
      { label: "Derivative", latex: "\\frac{d}{dx}", preview: "d/dx" },
      {
        label: "Partial der.",
        latex: "\\frac{\\partial f}{\\partial x}",
        preview: "∂f/∂x",
      },
      { label: "Integral", latex: "\\int_{a}^{b} f(x)\\,dx", preview: "∫" },
      { label: "Double int.", latex: "\\iint_D", preview: "∬" },
      { label: "Triple int.", latex: "\\iiint_V", preview: "∭" },
      { label: "Contour int.", latex: "\\oint_C", preview: "∮" },
      { label: "Limit", latex: "\\lim_{x \\to 0} f(x)", preview: "lim" },
      { label: "Gradient", latex: "\\nabla f", preview: "∇f" },
      {
        label: "Divergence",
        latex: "\\nabla \\cdot \\mathbf{F}",
        preview: "∇·F",
      },
      { label: "Curl", latex: "\\nabla \\times \\mathbf{F}", preview: "∇×F" },
      { label: "Laplacian", latex: "\\nabla^2 f", preview: "∇²f" },
      {
        label: "Taylor Series",
        latex: "\\sum_{n=0}^\\infty \\frac{f^{(n)}(a)}{n!}(x-a)^n",
        preview: "Taylor",
      },
    ],
  },
  {
    label: "Linear Alg",
    symbols: [
      {
        label: "Matrix 2×2",
        latex: "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}",
        preview: "[2x2]",
      },
      {
        label: "Matrix 3×3",
        latex:
          "\\begin{pmatrix} a & b & c \\\\ d & e & f \\\\ g & h & i \\end{pmatrix}",
        preview: "[3x3]",
      },
      { label: "Determinant", latex: "\\det(A)", preview: "det(A)" },
      { label: "Inverse", latex: "A^{-1}", preview: "A⁻¹" },
      { label: "Transpose", latex: "A^T", preview: "Aᵀ" },
      {
        label: "Dot product",
        latex: "\\mathbf{u} \\cdot \\mathbf{v}",
        preview: "u·v",
      },
      {
        label: "Cross product",
        latex: "\\mathbf{u} \\times \\mathbf{v}",
        preview: "u×v",
      },
      { label: "Norm", latex: "\\|\\mathbf{v}\\|", preview: "||v||" },
      {
        label: "Eigenvalue",
        latex: "A\\mathbf{v} = \\lambda\\mathbf{v}",
        preview: "Av=λv",
      },
    ],
  },
  {
    label: "Stats & Prob",
    symbols: [
      { label: "Mean (Mu)", latex: "\\mu", preview: "μ" },
      { label: "Std Dev (Sigma)", latex: "\\sigma", preview: "σ" },
      { label: "Variance", latex: "\\sigma^2", preview: "σ²" },
      { label: "Expectation", latex: "E[X]", preview: "E[X]" },
      { label: "Probability", latex: "P(A|B)", preview: "P(A|B)" },
      {
        label: "Normal Dist",
        latex: "\\mathcal{N}(\\mu, \\sigma^2)",
        preview: "N(μ,σ²)",
      },
      {
        label: "Binomial Dist",
        latex: "\\binom{n}{k}p^k(1-p)^{n-k}",
        preview: "Binomial",
      },
      {
        label: "Poisson Dist",
        latex: "\\frac{\\lambda^k e^{-\\lambda}}{k!}",
        preview: "Poisson",
      },
      { label: "Correlation", latex: "\\rho_{X,Y}", preview: "ρ(X,Y)" },
      {
        label: "Sample Mean",
        latex: "\\bar{x} = \\frac{1}{n}\\sum x_i",
        preview: "x̄",
      },
    ],
  },
  {
    label: "Phy: Mech & Thermo",
    symbols: [
      {
        label: "Newton's 2nd",
        latex: "\\mathbf{F} = m\\mathbf{a}",
        preview: "F=ma",
      },
      { label: "Kinetic E", latex: "K = \\frac{1}{2}mv^2", preview: "½mv²" },
      { label: "Pot. Gravity", latex: "U = mgh", preview: "mgh" },
      {
        label: "Work",
        latex: "W = \\int \\mathbf{F} \\cdot d\\mathbf{r}",
        preview: "Work",
      },
      {
        label: "Momentum",
        latex: "\\mathbf{p} = m\\mathbf{v}",
        preview: "p=mv",
      },
      {
        label: "Torque",
        latex: "\\boldsymbol{\\tau} = \\mathbf{r} \\times \\mathbf{F}",
        preview: "τ=r×F",
      },
      { label: "Ideal Gas", latex: "PV = nRT", preview: "PV=nRT" },
      { label: "Thermo 1st", latex: "\\Delta U = Q - W", preview: "ΔU=Q-W" },
      { label: "Entropy", latex: "S = k_B \\ln \\Omega", preview: "S=k lnΩ" },
      {
        label: "Gravity Force",
        latex: "F = G\\frac{m_1 m_2}{r^2}",
        preview: "Gravity",
      },
    ],
  },
  {
    label: "Phy: E&M & Modern",
    symbols: [
      {
        label: "Coulomb's",
        latex: "F = k_e\\frac{q_1 q_2}{r^2}",
        preview: "Coulomb",
      },
      {
        label: "Electric Field",
        latex: "\\mathbf{E} = \\frac{\\mathbf{F}}{q}",
        preview: "E=F/q",
      },
      {
        label: "Gauss's Law",
        latex:
          "\\oint \\mathbf{E} \\cdot d\\mathbf{A} = \\frac{Q_{enc}}{\\varepsilon_0}",
        preview: "Gauss",
      },
      { label: "Ohm's Law", latex: "V = IR", preview: "V=IR" },
      {
        label: "Magnetic Force",
        latex: "\\mathbf{F} = q(\\mathbf{v} \\times \\mathbf{B})",
        preview: "F=qv×B",
      },
      { label: "E=mc²", latex: "E = mc^2", preview: "E=mc²" },
      {
        label: "Schrödinger",
        latex: "i\\hbar\\frac{\\partial}{\\partial t}\\Psi = \\hat{H}\\Psi",
        preview: "HΨ=EΨ",
      },
      {
        label: "Planck",
        latex: "E = hf = \\frac{hc}{\\lambda}",
        preview: "E=hf",
      },
      {
        label: "Lorentz Factor",
        latex: "\\gamma = \\frac{1}{\\sqrt{1 - v^2/c^2}}",
        preview: "γ",
      },
    ],
  },
  {
    label: "Chemistry & Bio",
    symbols: [
      { label: "Reaction Arrow", latex: "\\rightarrow", preview: "→" },
      { label: "Equilibrium", latex: "\\rightleftharpoons", preview: "⇌" },
      { label: "Water", latex: "H_2O", preview: "H₂O" },
      { label: "Carbon Dioxide", latex: "CO_2", preview: "CO₂" },
      { label: "pH", latex: "\\text{pH} = -\\log[H^+]", preview: "pH" },
      {
        label: "Gibbs Free E",
        latex: "\\Delta G = \\Delta H - T\\Delta S",
        preview: "ΔG",
      },
      {
        label: "Nernst Eq",
        latex: "E = E^\\circ - \\frac{RT}{nF}\\ln Q",
        preview: "Nernst",
      },
      { label: "Arrhenius", latex: "k = Ae^{-E_a/RT}", preview: "Arrhenius" },
      { label: "Beer-Lambert", latex: "A = \\epsilon lc", preview: "A=εlc" },
      {
        label: "Molarity",
        latex: "M = \\frac{\\text{mol}}{\\text{L}}",
        preview: "M=mol/L",
      },
    ],
  },
  {
    label: "Economics",
    symbols: [
      { label: "Profit", latex: "\\pi = TR - TC", preview: "π=TR-TC" },
      {
        label: "Marginal Cost",
        latex: "MC = \\frac{\\Delta TC}{\\Delta Q}",
        preview: "MC",
      },
      {
        label: "Elasticity",
        latex: "E_d = \\frac{\\%\\Delta Q}{\\%\\Delta P}",
        preview: "Elasticity",
      },
      { label: "GDP", latex: "Y = C + I + G + (X - M)", preview: "GDP" },
      { label: "Future Value", latex: "FV = PV(1 + r)^n", preview: "FV" },
      {
        label: "Present Value",
        latex: "PV = \\frac{FV}{(1 + r)^n}",
        preview: "PV",
      },
      { label: "Continuous Comp.", latex: "A = Pe^{rt}", preview: "Peʳᵗ" },
      {
        label: "Multiplier",
        latex: "k = \\frac{1}{1 - MPC}",
        preview: "Multiplier",
      },
    ],
  },
  {
    label: "Logic & Set",
    symbols: [
      { label: "For all", latex: "\\forall", preview: "∀" },
      { label: "Exists", latex: "\\exists", preview: "∃" },
      { label: "Not exists", latex: "\\nexists", preview: "∄" },
      { label: "Element of", latex: "\\in", preview: "∈" },
      { label: "Not element of", latex: "\\notin", preview: "∉" },
      { label: "Subset", latex: "\\subset", preview: "⊂" },
      { label: "Subset or eq", latex: "\\subseteq", preview: "⊆" },
      { label: "Union", latex: "\\cup", preview: "∪" },
      { label: "Intersection", latex: "\\cap", preview: "∩" },
      { label: "Empty set", latex: "\\emptyset", preview: "∅" },
      { label: "Logical AND", latex: "\\land", preview: "∧" },
      { label: "Logical OR", latex: "\\lor", preview: "∨" },
      { label: "Implies", latex: "\\implies", preview: "⟹" },
      { label: "Iff", latex: "\\iff", preview: "⟺" },
      { label: "Therefore", latex: "\\therefore", preview: "∴" },
    ],
  },
  {
    label: "Greek",
    symbols: [
      { label: "Alpha", latex: "\\alpha", preview: "α" },
      { label: "Beta", latex: "\\beta", preview: "β" },
      { label: "Gamma", latex: "\\gamma", preview: "γ" },
      { label: "Delta", latex: "\\delta", preview: "δ" },
      { label: "Epsilon", latex: "\\epsilon", preview: "ε" },
      { label: "Zeta", latex: "\\zeta", preview: "ζ" },
      { label: "Eta", latex: "\\eta", preview: "η" },
      { label: "Theta", latex: "\\theta", preview: "θ" },
      { label: "Lambda", latex: "\\lambda", preview: "λ" },
      { label: "Mu", latex: "\\mu", preview: "μ" },
      { label: "Pi", latex: "\\pi", preview: "π" },
      { label: "Rho", latex: "\\rho", preview: "ρ" },
      { label: "Sigma", latex: "\\sigma", preview: "σ" },
      { label: "Tau", latex: "\\tau", preview: "τ" },
      { label: "Phi", latex: "\\phi", preview: "φ" },
      { label: "Psi", latex: "\\psi", preview: "ψ" },
      { label: "Omega", latex: "\\omega", preview: "ω" },
      { label: "Capital Delta", latex: "\\Delta", preview: "Δ" },
      { label: "Capital Sigma", latex: "\\Sigma", preview: "Σ" },
      { label: "Capital Omega", latex: "\\Omega", preview: "Ω" },
    ],
  },
];

const MathFormulaModal: React.FC<MathFormulaModalProps> = ({
  isOpen,
  onClose,
  onInsert,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mathFieldRef = useRef<any>(null);
  const [currentLatex, setCurrentLatex] = useState("");
  const [activeCategory, setActiveCategory] = useState(0);
  const [showTip, setShowTip] = useState(false);

  // Initialize MathLive imperatively to avoid JSX custom element issues
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    let field: any;

    const init = async () => {
      // Dynamically import mathlive to ensure the custom element is registered
      await import("mathlive");

      if (!containerRef.current) return;

      // Create the math-field element imperatively
      field = document.createElement("math-field");
      field.setAttribute("virtual-keyboard-mode", "onfocus");
      field.setAttribute("math-virtual-keyboard-policy", "sandboxed");
      Object.assign(field.style, {
        width: "100%",
        minHeight: "52px",
        fontSize: "22px",
        display: "block",
        outline: "none",
        caretColor: "#3b82f6",
        padding: "4px",
      });

      containerRef.current.innerHTML = "";
      containerRef.current.appendChild(field);
      mathFieldRef.current = field;

      const handleInput = () => {
        setCurrentLatex(field.value || "");
      };
      field.addEventListener("input", handleInput);

      // Focus after a short delay
      setTimeout(() => field.focus(), 100);
    };

    init();

    return () => {
      if (field) {
        field.removeEventListener("input", () => {});
      }
      mathFieldRef.current = null;
      setCurrentLatex("");
    };
  }, [isOpen]);

  const insertSymbol = useCallback((latex: string) => {
    const field = mathFieldRef.current;
    if (field) {
      field.executeCommand(["insert", latex, { selectionMode: "after" }]);
      setTimeout(() => {
        setCurrentLatex(field.value || "");
      }, 50);
      field.focus();
    }
  }, []);

  const handleInsert = () => {
    const field = mathFieldRef.current;
    const latex = (field?.value || currentLatex).trim();
    if (latex) {
      onInsert(latex);
      setCurrentLatex("");
      onClose();
    }
  };

  const handleClear = () => {
    const field = mathFieldRef.current;
    if (field) {
      field.value = "";
      setCurrentLatex("");
      field.focus();
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white dark:bg-gray-900 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-700"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/40 dark:to-purple-950/40">
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <span className="text-xl">Σ</span> Formula Builder
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Click a symbol to insert it, then click{" "}
                <strong>Insert Formula</strong> to add it to your document.
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-col">
            {/* Quick Symbols Panel */}
            <div className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/30">
              {/* Category Tabs */}
              <div className="flex gap-1 px-4 pt-3 overflow-x-auto scrollbar-hide">
                {SYMBOL_CATEGORIES.map((cat, i) => (
                  <button
                    key={cat.label}
                    onClick={() => setActiveCategory(i)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-all ${
                      activeCategory === i
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Symbol Grid */}
              <div className="grid grid-cols-6 gap-1.5 p-3">
                {SYMBOL_CATEGORIES[activeCategory].symbols.map((sym) => (
                  <button
                    key={sym.latex}
                    onClick={() => insertSymbol(sym.latex)}
                    title={sym.label}
                    className="flex flex-col items-center gap-0.5 p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-all text-center group cursor-pointer"
                  >
                    <span className="text-base font-bold text-gray-800 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 leading-tight">
                      {sym.preview}
                    </span>
                    <span className="text-[9px] text-gray-400 dark:text-gray-500 truncate max-w-full leading-tight">
                      {sym.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* MathLive interactive field */}
            <div className="px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
                  <ChevronRight className="w-3 h-3" /> Formula Editor
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowTip(!showTip)}
                    className="text-gray-400 hover:text-blue-500 transition-colors"
                    title="Show tips"
                  >
                    <Info className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleClear}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                    title="Clear formula"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {showTip && (
                <div className="mb-2 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-300">
                  💡 <strong>Tip:</strong> Click the buttons above to build your
                  formula. You can also click inside the field below — a full
                  visual math keyboard will appear at the bottom of the screen.
                  No LaTeX knowledge required!
                </div>
              )}

              {/* MathLive field container — mounted imperatively via useEffect */}
              <div className="border-2 border-gray-200 dark:border-gray-700 rounded-xl p-3 bg-white dark:bg-gray-950 hover:border-blue-400 dark:hover:border-blue-500 transition-colors focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20">
                <div ref={containerRef} className="min-h-[52px]" />
              </div>
              <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                Click inside to open the visual keyboard at the bottom of the
                screen.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
            <div className="text-xs text-gray-400 dark:text-gray-500 font-mono bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded max-w-[240px] truncate">
              {currentLatex || (
                <span className="italic opacity-60">no formula yet…</span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleInsert}
                disabled={!currentLatex.trim()}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg flex items-center gap-2 transition-all active:scale-95"
              >
                <Check className="w-4 h-4" /> Insert Formula
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
};

export default MathFormulaModal;
