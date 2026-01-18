import React, { useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";

interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const OtpInput: React.FC<OtpInputProps> = ({
  length = 6,
  value,
  onChange,
  disabled = false,
}) => {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [activeInput, setActiveInput] = useState(0);

  useEffect(() => {
    // Fill refs array
    inputRefs.current = inputRefs.current.slice(0, length);
  }, [length]);

  // Handle input change
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    index: number,
  ) => {
    const val = e.target.value;
    if (isNaN(Number(val))) return; // Only allow numbers

    const newOtp = value.split("");

    // Allow only last entered character if multiple (though maxLength handles this partly)
    const char = val.substring(val.length - 1);
    newOtp[index] = char;

    // Construct new OTP string
    // Fill with spaces or empty strings if length mismatch to avoid join issues,
    // but simpler to just map current state
    const combinedOtp = newOtp.join("").substring(0, length);
    onChange(combinedOtp);

    // Move to next input if value is entered
    if (val && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
      setActiveInput(index + 1);
    }
  };

  // Handle backspace and navigation logic via onKeyDown as React's onChange doesn't fire for backspace on empty inputs
  // We use key down capture or just key down.
  const handleKeyDownCapture = (
    e: React.KeyboardEvent<HTMLInputElement>,
    index: number,
  ) => {
    if (e.key === "Backspace") {
      const val = value[index];
      if (!val && index > 0) {
        // Current empty, move back and clear previous
        const newOtp = value.split("");
        newOtp[index - 1] = "";
        onChange(newOtp.join(""));
        inputRefs.current[index - 1]?.focus();
        setActiveInput(index - 1);
        e.preventDefault(); // Prevent default backspace in current empty field
      } else if (val) {
        // Let default behavior clear the char, onChange will update state
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
      setActiveInput(index - 1);
    } else if (e.key === "ArrowRight" && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
      setActiveInput(index + 1);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text/plain").trim();
    if (!/^\d+$/.test(pastedData)) return; // Only numbers

    const digits = pastedData.split("").slice(0, length);
    onChange(digits.join(""));

    // Focus last filled
    const nextIndex = Math.min(digits.length, length - 1);
    inputRefs.current[nextIndex]?.focus();
    setActiveInput(nextIndex);
  };

  // Ensure value is length-compliant for rendering
  const otpArray = value.padEnd(length, " ").split("");

  return (
    <div className="flex gap-2 sm:gap-3 justify-center">
      {Array.from({ length }).map((_, index) => (
        <React.Fragment key={index}>
          <motion.input
            ref={(el) => {
              inputRefs.current[index] = el;
            }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={otpArray[index] === " " ? "" : otpArray[index]}
            onChange={(e) => handleChange(e, index)}
            onKeyDown={(e) => handleKeyDownCapture(e, index)}
            onPaste={handlePaste}
            onFocus={() => setActiveInput(index)}
            disabled={disabled}
            className={`w-10 h-12 sm:w-12 sm:h-14 text-center text-xl sm:text-2xl font-bold rounded-xl border-2 transition-all duration-200 outline-none
              ${
                activeInput === index
                  ? "border-blue-500 bg-white dark:bg-gray-800 shadow-[0_0_0_4px_rgba(59,130,246,0.1)] scale-105 z-10"
                  : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 text-gray-400"
              }
              ${
                otpArray[index] !== " "
                  ? "text-gray-900 dark:text-white border-blue-500/50 bg-blue-50/10"
                  : ""
              }
            `}
            initial={false}
            animate={{
              scale: activeInput === index ? 1.05 : 1,
            }}
          />
          {index === 2 && (
            // Optional separator
            <span className="flex items-center text-gray-300 dark:text-gray-600 font-bold -mx-1 select-none pointer-events-none">
              -
            </span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

export default OtpInput;
