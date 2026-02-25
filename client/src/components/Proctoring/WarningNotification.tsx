import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle, X, Volume2 } from "lucide-react";

interface WarningNotificationProps {
  message: string;
  isVisible: boolean;
  onClose: () => void;
  autoHideDuration?: number;
}

// Warning sound as base64 - a simple alert tone
const WARNING_SOUND_BASE64 =
  "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleRAxA3Tv9/W5diYKLfrw9/K4fiIGKv799vK3eiAKLfr29/K3eyAKK/fs9vK2eR8LK/n09vK1eR4LK/jz9vK0eB0MK/bz9vKzeBwNK/X09vKyeBsOKvT19vKxeRsPKfP19vKweRsPKPL19vKvdxsPKPH19vKudxsPKO/19vGsdhoOKO709vGqdRkNKOnz9vGpdBkMKOjy9vCodBkLJ+fx9vCodBgKJuXu9vGndBcKJuPt9vGldBYKJuHs9vGkexYJJeDr9vGhexYJJOHq9vGhexYJI+Dp9vCfexYIIt/m9vCdexYII9/k9vCcexYIIt/l9vCdexYII9/k9vCdexYII9/k9vCdexYII9/k9vCdexYII9/k9vCdexYII9/l9vCdexYJI+Dp9vCfexYJIt/m9vCdexYJI9/k9vCcexYJI9/k9vCdexYJI9/k9vCdexYJI9/k9vCdexYJI9/k9vCdexYJI9/l9vCdehYJI+Dp9vCfexYJIt/m9vCdehYJI9/k9vGcexYJI9/k9vGdexYJI9/k9vGdexYJI9/k9vGdexYJI9/k9vGdehYJI+Dp9vGfexYJIt/m9vGdehYJI9/k9vGcexYJI9/k9vGdexYJI9/k9vGdexYJI9/k9vGdexYJI9/k9vGdexYJI9/l9vGdehYJI+Dp9vGfexYJIt/m";

const WarningNotification: React.FC<WarningNotificationProps> = ({
  message,
  isVisible,
  onClose,
  autoHideDuration = 10000, // 10 seconds default
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Play warning sound when notification becomes visible
  useEffect(() => {
    if (isVisible && !audioRef.current) {
      try {
        audioRef.current = new Audio(WARNING_SOUND_BASE64);
        audioRef.current.volume = 0.8;

        // Play the sound
        const playPromise = audioRef.current.play();

        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              setIsPlaying(true);
            })
            .catch((error) => {
              console.warn("Warning sound could not be played:", error);
            });
        }
      } catch (error) {
        console.warn("Warning sound could not be created:", error);
      }
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [isVisible]);

  // Auto-hide the notification after duration
  useEffect(() => {
    if (isVisible) {
      timeoutRef.current = setTimeout(() => {
        onClose();
      }, autoHideDuration);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isVisible, autoHideDuration, onClose]);

  // Replay sound on click of the volume icon
  const replaySound = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    } else {
      try {
        const audio = new Audio(WARNING_SOUND_BASE64);
        audio.volume = 0.8;
        audio.play().catch(() => {});
        audioRef.current = audio;
      } catch (error) {
        console.warn("Warning sound could not be played:", error);
      }
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 animate-slide-down">
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 dark:from-orange-600 dark:to-orange-700 shadow-lg border-b-4 border-orange-700 dark:border-orange-800">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Left side - Warning Icon and Message */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex-shrink-0 w-8 h-8 bg-white/20 rounded-full flex items-center justify-center animate-pulse">
                <AlertTriangle className="w-5 h-5 text-white" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-base truncate">
                  {message || "Warning from Instructor"}
                </p>
                <p className="text-orange-100 text-xs">
                  Please pay attention to your exam
                </p>
              </div>
            </div>

            {/* Right side - Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Replay Sound Button */}
              <button
                onClick={replaySound}
                className="p-2 rounded-full hover:bg-white/20 transition-colors text-white/80 hover:text-white"
                title="Replay warning sound"
              >
                <Volume2
                  className={`w-5 h-5 ${isPlaying ? "animate-pulse" : ""}`}
                />
              </button>

              {/* Close Button */}
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-white/20 transition-colors text-white/80 hover:text-white"
                title="Dismiss warning"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Add animation keyframes via style tag */}
      <style>{`
        @keyframes slide-down {
          from {
            transform: translateY(-100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-down {
          animation: slide-down 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default WarningNotification;
