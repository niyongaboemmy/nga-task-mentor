import React, { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import ProfilePictureUpload from "./ProfilePictureUpload";

interface ProfilePicturePromptProps {
  isOpen: boolean;
  onClose: () => void;
}

const ProfilePicturePrompt: React.FC<ProfilePicturePromptProps> = ({
  isOpen,
  onClose,
}) => {
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);

  const handleUploadSuccess = () => {
    onClose();
  };

  const handleUploadStateChange = (uploading: boolean) => {
    setIsUploading(uploading);
  };

  const handleSkip = () => {
    onClose();
  };

  if (!isOpen || !user) return null;

  return (
    <div
      className={`fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex ${
        isUploading
          ? "items-start justify-center pt-20"
          : "items-center justify-center"
      } z-50 p-4 animate-in fade-in duration-300`}
    >
      <div
        className={`bg-white dark:bg-gray-900 rounded-3xl max-w-md w-full shadow-2xl border border-gray-100 dark:border-gray-800 transform animate-in max-h-[99vh] overflow-y-auto ${
          isUploading ? "zoom-in-95" : "zoom-in-95"
        } duration-300`}
      >
        {/* Header with gradient background */}
        <div className="bg-gradient-to-br from-blue-700 via-blue-500 to-blue-700 dark:from-blue-800 dark:via-blue-600 dark:to-blue-900 rounded-t-3xl p-6 text-center relative overflow-hidden">
          {/* Animated background elements */}
          <div className="absolute inset-0 bg-white opacity-10"></div>
          <div
            className="absolute -top-4 -right-4 w-24 h-24 bg-white opacity-20 rounded-full animate-bounce"
            style={{ animationDelay: "0.5s" }}
          ></div>
          <div
            className="absolute -bottom-4 -left-4 w-16 h-16 bg-white opacity-20 rounded-full animate-bounce"
            style={{ animationDelay: "1s" }}
          ></div>

          <div className="relative z-10">
            {/* Cute avatar icon */}
            <div className="w-20 h-20 bg-white bg-opacity-20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
              <svg
                className="w-10 h-10 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>

            <h2 className="text-2xl font-bold text-white mb-2">
              Complete Your Profile! ✨
            </h2>
            <p className="text-blue-100 text-sm leading-relaxed">
              Welcome back,{" "}
              <span className="font-semibold text-white">
                {user.first_name}
              </span>
              ! Add a profile picture to personalize your account and help
              others recognize you.
            </p>
          </div>
        </div>

        <div className="p-6">
          {/* Upload component */}
          <div className="mb-6">
            <ProfilePictureUpload
              onUploadSuccess={handleUploadSuccess}
              onUploadStateChange={handleUploadStateChange}
              className="scale-90 -m-4"
            />
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleSkip}
              disabled={isUploading}
              className={`flex-1 px-4 py-3 text-sm font-medium rounded-full transition-all duration-200 hover:scale-105 focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-600 ${
                isUploading
                  ? "text-gray-400 bg-gray-100 dark:bg-gray-700 cursor-not-allowed opacity-50"
                  : "text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
            >
              Skip for now
            </button>
          </div>

          {/* Footer text */}
          <div className="mt-4 p-3 bg-gradient-to-r from-blue-50 to-blue-50 dark:from-gray-700 dark:to-gray-600 rounded-xl">
            <p className="text-xs text-gray-600 dark:text-gray-400 text-center leading-relaxed">
              💡 You can always add or change your profile picture later in your
              profile settings. No pressure, take your time!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePicturePrompt;
