import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import ProfilePictureUpload from "./ProfilePictureUpload";

interface UserType {
  first_name?: string;
  last_name?: string;
  email: string;
  department?: string;
  role?: string;
  profile_image?: string;
}

interface ProfileFormData {
  first_name: string;
  last_name: string;
  email: string;
  department?: string;
}

interface PasswordFormData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const Profile: React.FC = () => {
  const { user, updateProfile, changePassword, updateProfileImage } =
    useAuth() as {
      user: UserType | null;
      updateProfile: (data: ProfileFormData) => Promise<void>;
      changePassword: (current: string, next: string) => Promise<void>;
      updateProfileImage: (imageUrl: string) => Promise<void>;
    };

  const [activeTab, setActiveTab] = useState<"profile" | "password">("profile");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [isFormDirty, setIsFormDirty] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  // Profile form state
  const [profileData, setProfileData] = useState<ProfileFormData>({
    first_name: "",
    last_name: "",
    email: "",
    department: "",
  });

  // Password form state
  const [passwordData, setPasswordData] = useState<PasswordFormData>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  // Initialize form data when user data is available
  useEffect(() => {
    if (user) {
      setProfileData({
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        email: user.email || "",
        department: user.department || "",
      });
    }
  }, [user]);

  // Show confetti animation on successful actions
  useEffect(() => {
    if (message?.type === "success") {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const handleProfileSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      await updateProfile(profileData);
      setMessage({ type: "success", text: "Profile updated successfully! ✨" });
      setIsFormDirty(false);
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error?.response?.data?.message || "Failed to update profile 😔",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: "error", text: "New passwords do not match 😅" });
      setLoading(false);
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setMessage({
        type: "error",
        text: "Password must be at least 6 characters long 🔒",
      });
      setLoading(false);
      return;
    }

    try {
      await changePassword(
        passwordData.currentPassword,
        passwordData.newPassword
      );
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setMessage({
        type: "success",
        text: "Password changed successfully! 🔐✨",
      });
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error?.response?.data?.message || "Failed to change password 😔",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProfileData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setIsFormDirty(true);
  };

  const handleProfilePictureUpdate = async (imageUrl: string) => {
    try {
      // Update the profile image in AuthContext
      await updateProfileImage(imageUrl);

      // Show success message
      setMessage({
        type: "success",
        text: "Profile picture updated successfully! 🎉",
      });

      // Clear message after 3 seconds
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error("Failed to update profile picture:", error);
      setMessage({
        type: "error",
        text: "Failed to update profile picture. Please try again.",
      });

      // Clear message after 3 seconds
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPasswordData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="relative">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-500"></div>
          <div className="absolute inset-0 rounded-full animate-pulse bg-blue-100 opacity-20"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 relative">
      {/* Confetti Animation */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-bounce"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${1 + Math.random()}s`,
              }}
            >
              <div
                className={`w-3 h-3 rounded-full ${
                  [
                    "bg-yellow-400",
                    "bg-blue-400",
                    "bg-blue-400",
                    "bg-blue-400",
                  ][i % 4]
                }`}
              />
            </div>
          ))}
        </div>
      )}

      {/* Header Card */}
      <div className="bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 rounded-3xl p-5 border-4 border-white dark:border-gray-800 relative overflow-hidden group hover:shadow-xl transition-all duration-500">
        {/* Animated background elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-200 to-blue-200 dark:from-blue-800 dark:to-blue-800 rounded-full opacity-20 animate-pulse group-hover:scale-110 transition-transform duration-700"></div>
        <div
          className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-br from-blue-200 to-indigo-200 dark:from-blue-800 dark:to-indigo-800 rounded-full opacity-20 animate-bounce"
          style={{ animationDelay: "1s" }}
        ></div>

        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center space-x-4">
            <div className="relative group">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 via-blue-500 to-blue-500 rounded-full flex items-center justify-center shadow-lg animate-pulse group-hover:scale-110 transition-transform duration-300">
                <svg
                  className="w-10 h-10 text-white animate-bounce"
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
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-400 rounded-full border-4 border-white dark:border-gray-900 animate-pulse"></div>
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 via-blue-900 to-blue-900 dark:from-white dark:via-blue-200 dark:to-blue-200 bg-clip-text text-transparent animate-pulse">
                {user.first_name} {user.last_name}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1 text-base">
                Manage your account information and preferences ✨
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Alert Messages */}
      {message && (
        <div
          className={`p-5 rounded-2xl shadow-lg border-l-4 transform animate-in slide-in-from-left-4 duration-500 ${
            message.type === "success"
              ? "bg-gradient-to-r from-blue-50 to-emerald-50 border-blue-400 text-blue-700 dark:bg-gradient-to-r dark:from-blue-900/20 dark:to-emerald-900/20 dark:text-blue-400 dark:border-blue-500"
              : "bg-gradient-to-r from-red-50 to-blue-50 border-red-400 text-red-700 dark:bg-gradient-to-r dark:from-red-900/20 dark:to-blue-900/20 dark:text-red-400 dark:border-red-500"
          }`}
        >
          <div className="flex items-center">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center mr-4 animate-bounce ${
                message.type === "success"
                  ? "bg-blue-100 dark:bg-blue-900/50"
                  : "bg-red-100 dark:bg-red-900/50"
              }`}
            >
              {message.type === "success" ? (
                <svg
                  className="w-5 h-5 text-blue-600 dark:text-blue-400"
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
              ) : (
                <svg
                  className="w-5 h-5 text-red-600 dark:text-red-400"
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
              )}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-lg">{message.text}</p>
              {message.type === "success" && (
                <p className="text-sm opacity-80 mt-1">
                  🎉 Everything looks great!
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content Card */}
      <div className="bg-white dark:bg-gray-900 rounded-3xl border-4 border-white dark:border-gray-800 overflow-hidden relative group hover:shadow-3xl transition-all duration-500">
        {/* Decorative corner elements */}
        <div className="absolute top-0 left-0 w-16 h-16 bg-gradient-to-br from-blue-100 to-blue-100 dark:from-blue-900/30 dark:to-blue-900/30 rounded-br-full opacity-50 group-hover:scale-110 transition-transform duration-500"></div>
        <div className="absolute bottom-0 right-0 w-16 h-16 bg-gradient-to-br from-blue-100 to-blue-100 dark:from-blue-900/30 dark:to-blue-900/30 rounded-tl-full opacity-50 group-hover:scale-110 transition-transform duration-500"></div>

        {/* Tabs */}
        <div className="bg-gradient-to-r from-gray-50 via-white to-gray-50 dark:from-gray-800 dark:via-gray-900 dark:to-gray-800 border-b border-gray-200 dark:border-gray-600 relative">
          <div className="flex px-8">
            {[
              {
                key: "profile",
                label: "Profile Information",
                icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
              },
              {
                key: "password",
                label: "Change Password",
                icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
              },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key as "profile" | "password")}
                className={`relative py-6 px-8 font-semibold text-sm transition-all duration-300 group ${
                  activeTab === tab.key
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                <span className="flex items-center">
                  <svg
                    className={`w-5 h-5 mr-3 transition-all duration-300 ${
                      activeTab === tab.key
                        ? "animate-bounce"
                        : "group-hover:scale-110"
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d={tab.icon}
                    />
                  </svg>
                  {tab.label}
                </span>
                {activeTab === tab.key && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-blue-500 to-blue-500 animate-pulse"></div>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="p-8">
          {/* Profile Tab */}
          {activeTab === "profile" && (
            <form onSubmit={handleProfileSubmit} className="space-y-8">
              {/* Profile Picture Section */}
              <div className="bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-800 dark:via-gray-900 dark:to-gray-800 rounded-2xl p-8 border border-gray-100 dark:border-gray-700 relative group transition-all duration-300">
                <div className="absolute top-4 left-4 w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-400 rounded-lg opacity-50 group-hover:scale-110 transition-transform duration-300"></div>
                <div className="flex items-center mb-6">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mr-4 shadow-lg animate-pulse">
                    <svg
                      className="w-5 h-5 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    Profile Picture
                  </h3>
                </div>
                <ProfilePictureUpload
                  onUploadSuccess={handleProfilePictureUpdate}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  {
                    name: "first_name",
                    label: "First Name",
                    placeholder: "Enter your first name",
                    icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0z",
                  },
                  {
                    name: "last_name",
                    label: "Last Name",
                    placeholder: "Enter your last name",
                    icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0z",
                  },
                ].map((field) => (
                  <div key={field.name} className="group">
                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center">
                      <svg
                        className="w-4 h-4 mr-2 text-gray-400 group-hover:text-blue-500 transition-colors duration-200"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d={field.icon}
                        />
                      </svg>
                      {field.label}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        name={field.name}
                        value={(profileData as any)[field.name]}
                        onChange={handleProfileChange}
                        placeholder={field.placeholder}
                        className="w-full px-5 py-3 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 border-2 border-gray-200 dark:border-gray-600 rounded-2xl text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 hover:shadow hover:scale-102"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {[
                {
                  name: "email",
                  label: "Email Address",
                  placeholder: "Enter your email",
                  icon: "M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
                },
                {
                  name: "department",
                  label: "Department",
                  placeholder: "Enter your department",
                  icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
                },
              ].map((field) => (
                <div key={field.name} className="group">
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center">
                    <svg
                      className="w-4 h-4 mr-2 text-gray-400 group-hover:text-blue-500 transition-colors duration-200"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d={field.icon}
                      />
                    </svg>
                    {field.label}
                  </label>
                  <div className="relative">
                    <input
                      type={field.name === "email" ? "email" : "text"}
                      name={field.name}
                      value={(profileData as any)[field.name]}
                      onChange={handleProfileChange}
                      placeholder={field.placeholder}
                      className="w-full px-5 py-3 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 border-2 border-gray-200 dark:border-gray-600 rounded-2xl text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 hover:shadow hover:scale-101"
                    />
                  </div>
                </div>
              ))}

              <div className="flex items-center justify-between border-t-2 border-gray-200 dark:border-gray-600 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-700 rounded-2xl p-3">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 rounded-xl flex items-center justify-center animate-pulse">
                    <svg
                      className="w-6 h-6 text-amber-600 dark:text-amber-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Your Role
                    </div>
                    <div className="font-bold text-lg text-gray-900 dark:text-white capitalize bg-gradient-to-r from-blue-600 to-blue-600 bg-clip-text text-transparent">
                      {user.role || "N/A"}
                    </div>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading || !isFormDirty}
                  className={`inline-flex items-center px-8 py-3 text-lg font-bold rounded-full shadow-xl transform transition-all duration-300 ${
                    loading || !isFormDirty
                      ? "bg-gray-300 dark:bg-gray-600 text-gray-500 cursor-not-allowed"
                      : "bg-gradient-to-r from-blue-500 via-blue-500 to-blue-500 hover:from-blue-600 hover:via-blue-600 hover:to-blue-600 text-white hover:shadow-2xl hover:scale-110 animate-pulse"
                  }`}
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-3"></div>
                      Updating...
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-5 h-5 mr-3 animate-bounce"
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
                      <span className="text-base">Update Profile ✨</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Password Tab */}
          {activeTab === "password" && (
            <form onSubmit={handlePasswordSubmit} className="space-y-5">
              {[
                {
                  name: "currentPassword",
                  label: "Current Password",
                  placeholder: "Enter your current password",
                  icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
                },
                {
                  name: "newPassword",
                  label: "New Password",
                  placeholder: "Enter your new password",
                  icon: "M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z",
                },
                {
                  name: "confirmPassword",
                  label: "Confirm Password",
                  placeholder: "Confirm your new password",
                  icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
                },
              ].map((field) => (
                <div key={field.name} className="group">
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center">
                    <svg
                      className="w-4 h-4 mr-2 text-gray-400 group-hover:text-red-500 transition-colors duration-200"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d={field.icon}
                      />
                    </svg>
                    {field.label}
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      name={field.name}
                      value={(passwordData as any)[field.name]}
                      onChange={handlePasswordChange}
                      required
                      className="w-full px-5 py-3 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 border-2 border-gray-200 dark:border-gray-600 rounded-2xl text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-300 hover:shadow hover:scale-102"
                      placeholder={field.placeholder}
                    />
                  </div>
                </div>
              ))}

              <div className="border-t-2 border-gray-200 dark:border-gray-600 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-700 rounded-2xl p-6">
                <button
                  type="submit"
                  disabled={loading}
                  className={`inline-flex items-center px-8 py-3 text-base font-bold rounded-full shadow-xl transform transition-all duration-300 ${
                    loading
                      ? "bg-gray-300 dark:bg-gray-600 text-gray-500 cursor-not-allowed"
                      : "bg-gradient-to-r from-blue-700 via-blue-500 to-blue-700 hover:from-blue-600 hover:via-blue-700 hover:to-blue-600 text-white hover:shadow-2xl hover:scale-105 animate-pulse"
                  }`}
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-3"></div>
                      Changing Password...
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-5 h-5 mr-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                        />
                      </svg>
                      Change Password 🔐✨
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
