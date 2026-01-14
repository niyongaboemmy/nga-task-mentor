import React, { useState, useRef, useCallback, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import axios from "axios";

interface ProfilePictureUploadProps {
  onUploadSuccess?: (imageUrl: string) => void;
  onUploadStateChange?: (isUploading: boolean) => void;
  className?: string;
}

const ProfilePictureUpload: React.FC<ProfilePictureUploadProps> = ({
  onUploadSuccess,
  onUploadStateChange,
  className = "",
}) => {
  const { user } = useAuth();
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Notify parent of upload state changes
  useEffect(() => {
    if (onUploadStateChange) {
      onUploadStateChange(isUploading);
    }
  }, [isUploading, onUploadStateChange]);

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file ✨");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("File size must be less than 5MB 📏");
      return;
    }

    setError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    uploadFile(file);
  }, []);

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append("profileImage", file);

      const response = await axios.post(
        "/api/auth/upload-profile-image",
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / (progressEvent.total || 1)
            );
            setUploadProgress(percentCompleted);
          },
        }
      );

      const imageUrl = response.data.data.profile_image;
      if (onUploadSuccess) onUploadSuccess(imageUrl);

      setPreview(null);
      setUploadProgress(0);
    } catch (error: any) {
      console.error("Upload error:", error);
      setError(error?.response?.data?.message || "Failed to upload image 😔");
      setUploadProgress(0);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) handleFileSelect(files[0]);
    },
    [handleFileSelect]
  );

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) handleFileSelect(files[0]);
    },
    [handleFileSelect]
  );

  const handleDelete = async () => {
    if (!user?.profile_image) return;

    setIsUploading(true);
    setError(null);

    try {
      await axios.delete("/api/auth/delete-profile-image");
      if (onUploadSuccess) onUploadSuccess("");
    } catch (error: any) {
      console.error("Delete error:", error);
      setError(error?.response?.data?.message || "Failed to delete image 😔");
    } finally {
      setIsUploading(false);
    }
  };

  const getImageUrl = () => {
    if (preview) return preview;
    if (user?.profile_image) {
      // Use the API server domain where static files are served
      // Files are uploaded TO server and served FROM server
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "https://tm.universalbridge.rw";
      return `${apiBaseUrl}/uploads/profile-pictures/${user.profile_image}`;
    }
    return null;
  };

  const imageUrl = getImageUrl();

  return (
    <div className={`profile-picture-upload ${className}`}>
      <div className="flex flex-col items-center gap-6">
        {/* Profile Picture Display */}
        <div className="relative group">
          <div
            className={`
              relative w-40 h-40 rounded-full border-4 transition-all duration-300 cursor-pointer
              ${
                isDragOver
                  ? "border-blue-400 scale-105 shadow-xl shadow-blue-200"
                  : "border-gray-200 dark:border-gray-600 hover:border-blue-300 hover:scale-102"
              }
              ${isUploading ? "opacity-80" : ""}
              bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800
              overflow-hidden shadow-md
            `}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleClick}
          >
            {imageUrl ? (
              <>
                <img
                  src={imageUrl}
                  alt="Profile"
                  className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <svg
                      className="w-8 h-8 text-white drop-shadow-md animate-bounce"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-400 via-blue-500 to-blue-500 rounded-full flex items-center justify-center mb-2 animate-pulse shadow-md">
                  <svg
                    className="w-6 h-6 text-white animate-bounce"
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
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                  Add Photo
                </span>
                <span className="text-xs text-gray-500 mt-0.5">
                  Click to upload
                </span>
              </div>
            )}

            {/* Upload Progress Ring */}
            {isUploading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative">
                  <svg
                    className="w-16 h-16 transform -rotate-90"
                    viewBox="0 0 36 36"
                  >
                    <path
                      className="text-gray-200 dark:text-gray-600"
                      strokeDasharray="100, 100"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                    <path
                      className="text-blue-500"
                      strokeDasharray={`${uploadProgress}, 100`}
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-500 rounded-full flex items-center justify-center animate-spin shadow-md">
                      <svg
                        className="w-4 h-4 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                    </div>
                  </div>
                  <div className="absolute -bottom-1.5 left-1/2 transform -translate-x-1/2 text-xs font-semibold text-blue-600">
                    {uploadProgress}%
                  </div>
                </div>
              </div>
            )}

            {/* Preview indicator */}
            {imageUrl && !isUploading && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                }}
                className="absolute top-1 right-1 w-6 h-6 bg-white bg-opacity-90 hover:bg-opacity-100 rounded-full flex items-center justify-center shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-150"
                title="Preview image"
              >
                <svg
                  className="w-3 h-3 text-gray-700"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </button>
            )}
          </div>

          {/* Delete button */}
          {imageUrl && !isUploading && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete();
              }}
              className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-r from-red-400 to-red-500 hover:from-red-500 hover:to-red-600 text-white rounded-full flex items-center justify-center shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-150 animate-pulse"
              title="Remove photo"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}

          {/* Hover indicator */}
          {!isUploading && !imageUrl && (
            <div className="absolute inset-0 rounded-full bg-blue-500 bg-opacity-0 group-hover:bg-opacity-10 transition-all duration-200 pointer-events-none"></div>
          )}
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileInputChange}
          className="hidden"
        />

        {/* Status Messages - Compact Layout */}
        {(error ||
          (imageUrl && !isUploading) ||
          (isUploading && uploadProgress > 0)) && (
          <div className="flex-1 min-w-0">
            {error && (
              <div className="p-3 bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 border border-red-200 dark:border-red-800 rounded-lg animate-in slide-in-from-top-2 duration-200">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-red-100 dark:bg-red-900/50 rounded-full flex items-center justify-center animate-bounce flex-shrink-0">
                    <svg
                      className="w-3 h-3 text-red-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-red-700 dark:text-red-400 truncate">
                    {error}
                  </p>
                </div>
              </div>
            )}

            {!error && !isUploading && imageUrl && (
              <div className="p-3 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-lg animate-in slide-in-from-top-2 duration-200">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center animate-bounce flex-shrink-0">
                    <svg
                      className="w-3 h-3 text-green-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-green-700 dark:text-green-400 truncate">
                    Profile picture updated!
                  </p>
                </div>
              </div>
            )}

            {isUploading && uploadProgress > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm font-semibold text-gray-600 dark:text-gray-400">
                  <span className="truncate">Uploading...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 shadow-inner">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-blue-500 h-2 rounded-full transition-all duration-200 ease-out shadow-sm"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfilePictureUpload;
