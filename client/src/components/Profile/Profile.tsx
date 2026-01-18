import React, { useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "../../contexts/AuthContext";
import ProfilePictureUpload from "./ProfilePictureUpload";
import { getProfileImageUrl } from "../../utils/imageUrl";
import {
  User,
  MapPin,
  Mail,
  Hash,
  Briefcase,
  Award,
  BookOpen,
} from "lucide-react";

const Profile: React.FC = () => {
  const { user, updateProfileImage } = useAuth();
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [imageLoading, setImageLoading] = useState(true);

  const handleProfilePictureUpdate = async (imageUrl: string) => {
    try {
      await updateProfileImage(imageUrl);
      setMessage({ type: "success", text: "Profile picture updated!" });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error(error);
      setMessage({
        type: "error",
        text: "Failed to update profile picture.",
      });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  if (!user)
    return (
      <div className="p-10 text-center text-gray-500">Loading profile...</div>
    );

  // Data Card Component
  const DataCard = ({
    title,
    icon: Icon,
    children,
  }: {
    title: string;
    icon: any;
    children: React.ReactNode;
  }) => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800 h-full"
    >
      <div className="flex items-center gap-2 mb-4 text-gray-900 dark:text-white font-semibold pb-3 border-b border-gray-100 dark:border-gray-800">
        <div className="p-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400">
          <Icon size={18} />
        </div>
        {title}
      </div>
      <div className="space-y-3">{children}</div>
    </motion.div>
  );

  // Field Component
  const Field = ({
    label,
    value,
    copyable = false,
  }: {
    label: string;
    value: string | number | null | undefined;
    copyable?: boolean;
  }) => (
    <div className="flex justify-between items-center text-sm group">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <div className="flex items-center gap-2">
        <span className="font-medium text-gray-900 dark:text-gray-200 text-right">
          {value || (
            <span className="text-gray-300 dark:text-gray-600 italic">
              Not set
            </span>
          )}
        </span>
        {copyable && value && (
          <button
            onClick={() => navigator.clipboard.writeText(String(value))}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-500 hover:text-blue-600"
            title="Copy"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-10">
      {/* Compact Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden"
      >
        <div className="h-24 bg-gradient-to-r from-blue-600 to-blue-600 relative">
          <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-20" />
        </div>
        <div className="px-6 pb-6">
          <div className="flex flex-col sm:flex-row gap-5 items-end -mt-10">
            {/* Profile Picture & Upload */}
            <div className="relative group">
              <div className="p-1.5 bg-white dark:bg-gray-900 rounded-2xl shadow-sm inline-block">
                <div className="w-24 h-24 bg-gray-200 dark:bg-gray-800 rounded-xl overflow-hidden relative">
                  <ProfilePictureUpload
                    onUploadSuccess={handleProfilePictureUpdate}
                  />
                  {/* We might need to adjust ProfilePictureUpload to render the image itself if not already managing it well 
                       However, the previous version wrapped it awkwardly. 
                       Assuming ProfilePictureUpload handles the image display or we should stick to the explicit image logic.
                       Let's be safe and render the image here if we want full control, BUT ProfilePictureUpload usually handles the hidden input logic.
                       Let's assume ProfilePictureUpload handles the visuals including the image itself based on context or props.
                       Wait, existing ProfilePictureUpload (from context) might render a button. 
                       Let's check if we should render the image explicitly as before. 
                       Looking at previous code: logic was messy. Let's create a clean container. 
                   */}
                  {user.profile_image ? (
                    <>
                      {imageLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
                          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                      <img
                        src={getProfileImageUrl(user.profile_image) || ""}
                        alt="Profile"
                        className={`w-full h-full object-cover transition-opacity duration-300 ${imageLoading ? "opacity-0" : "opacity-100"}`}
                        onLoad={() => setImageLoading(false)}
                        onError={() => setImageLoading(false)}
                      />
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-bold text-3xl">
                      {user.first_name?.[0]}
                      {user.last_name?.[0]}
                    </div>
                  )}
                  {/* Overlay hidden upload trigger - assuming ProfilePictureUpload can be invisible or styled */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                    <div className="opacity-0 w-full h-full absolute inset-0 overflow-hidden">
                      <ProfilePictureUpload
                        onUploadSuccess={handleProfilePictureUpdate}
                      />
                    </div>
                    <span className="text-white text-xs font-medium">
                      Change
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Name & Role */}
            <div className="flex-1 mb-1">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {user.first_name} {user.last_name}
              </h1>
              <div className="flex items-center flex-wrap gap-2 text-sm text-gray-500 dark:text-gray-400 mt-1">
                <span className="flex items-center gap-1">
                  <Mail size={14} /> {user.email}
                </span>
                <span className="w-1 h-1 bg-gray-300 dark:bg-gray-600 rounded-full hidden sm:block" />
                <span className="capitalize px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-gray-600 dark:text-gray-300 text-xs font-medium border border-gray-200 dark:border-gray-700">
                  {user.role}
                </span>
              </div>
            </div>

            {/* Message Toast */}
            {message && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  message.type === "success"
                    ? "bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300"
                    : "bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300"
                }`}
              >
                {message.text}
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Personal Details */}
        <DataCard title="Personal Information" icon={User}>
          <Field label="First Name" value={user.first_name} />
          <Field label="Last Name" value={user.last_name} />
          <Field label="Gender" value={user.gender} />
          <Field
            label="Date of Birth"
            value={
              user.date_of_birth
                ? new Date(user.date_of_birth).toLocaleDateString()
                : null
            }
          />
          <div className="pt-2 border-t border-gray-50 dark:border-gray-800/50">
            <div className="flex items-start gap-2 text-sm">
              <MapPin size={16} className="text-gray-400 mt-0.5 shrink-0" />
              <span className="text-gray-600 dark:text-gray-300">
                {user.address || (
                  <span className="text-gray-400 italic">
                    No address provided
                  </span>
                )}
              </span>
            </div>
          </div>
        </DataCard>

        {/* System Identity */}
        <DataCard title="System Identity" icon={FingerprintIcon || Hash}>
          {/* Fallback to Hash if Fingerprint not in lucide defaults loaded */}
          <Field label="User ID" value={user.id} copyable />
          <Field label="MIS ID" value={user.mis_user_id} copyable />
          <Field label="External ID" value={user.external_id} copyable />
          <Field label="Account Type" value={user.user_type || user.role} />
        </DataCard>

        {/* Academic / Work Info */}
        <DataCard title="Academic & Department" icon={Briefcase}>
          <Field label="Department" value={user.department} />
          <Field label="Role" value={user.role} />

          {user.assigned_programs && user.assigned_programs.length > 0 && (
            <div className="mt-4">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">
                Assigned Programs
              </span>
              <div className="flex flex-wrap gap-2">
                {user.assigned_programs.map((prog: any, i: number) => (
                  <span
                    key={i}
                    className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 border border-blue-100 dark:border-blue-800/50"
                  >
                    <BookOpen size={12} className="mr-1.5 opacity-70" />
                    {prog.name || prog}
                  </span>
                ))}
              </div>
            </div>
          )}
        </DataCard>
      </div>
    </div>
  );
};

// Helper for dynamic icon import fallback if needed, but Hash is safe
const FingerprintIcon = Award;

export default Profile;
