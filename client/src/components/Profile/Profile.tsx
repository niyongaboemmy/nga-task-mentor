import React, { useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "../../contexts/AuthContext";
import ProfilePictureUpload from "./ProfilePictureUpload";
import { getProfileImageUrl } from "../../utils/imageUrl";
import {
  User,
  MapPin,
  Mail,
  Fingerprint,
  Briefcase,
  BookOpen,
  Copy,
  Check,
  Camera,
} from "lucide-react";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 110,
      damping: 18,
    },
  },
};

const Profile: React.FC = () => {
  const { user, updateProfileImage } = useAuth();
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [imageLoading, setImageLoading] = useState(true);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = (label: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 1500);
  };

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
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-text-secondary-light dark:text-text-secondary-dark/70 font-medium">
            Loading profile...
          </p>
        </div>
      </div>
    );

  // Data Card Component
  const DataCard = ({
    title,
    icon: Icon,
    color,
    children,
  }: {
    title: string;
    icon: any;
    color: "blue" | "violet" | "emerald";
    children: React.ReactNode;
  }) => {
    const colorClasses = {
      blue: "bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400",
      violet: "bg-violet-100 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400",
      emerald: "bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400",
    };
    return (
      <motion.div
        variants={itemVariants}
        className="bg-card-light dark:bg-card-dark/30 rounded-2xl shadow-sm p-6 h-full"
      >
        <div className="flex items-center gap-2.5 mb-4 pb-4 border-b border-gray-100 dark:border-border-dark/30">
          <div className={`p-2 rounded-2xl ${colorClasses[color]}`}>
            <Icon size={18} />
          </div>
          <h3 className="font-semibold text-text-primary-light dark:text-text-primary-dark">
            {title}
          </h3>
        </div>
        <div className="space-y-3.5">{children}</div>
      </motion.div>
    );
  };

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
      <span className="text-text-secondary-light dark:text-text-secondary-dark/70">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className="font-medium text-text-primary-light dark:text-text-primary-dark text-right">
          {value || (
            <span className="text-gray-400 dark:text-gray-600 italic font-normal">
              Not set
            </span>
          )}
        </span>
        {copyable && value && (
          <button
            onClick={() => handleCopy(label, String(value))}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-500 hover:text-blue-600 shrink-0"
            title="Copy"
          >
            {copiedField === label ? (
              <Check className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <motion.div
      className="max-w-5xl mx-auto space-y-6 pb-10"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div
        variants={itemVariants}
        className="bg-card-light dark:bg-card-dark/30 rounded-2xl shadow-sm overflow-hidden"
      >
        <div className="h-28 sm:h-32 bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-20" />
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
          <div className="absolute right-16 bottom-0 w-24 h-24 bg-white/10 rounded-full blur-xl" />
        </div>
        <div className="px-6 pb-6">
          <div className="flex flex-col sm:flex-row gap-5 items-start sm:items-end -mt-12 sm:-mt-14">
            {/* Profile Picture & Upload */}
            <div className="relative group shrink-0">
              <div className="p-1.5 bg-card-light dark:bg-card-dark rounded-3xl inline-block shadow-lg">
                <div className="w-24 h-24 sm:w-28 sm:h-28 bg-gray-200 dark:bg-gray-800 rounded-2xl overflow-hidden relative">
                  <ProfilePictureUpload
                    onUploadSuccess={handleProfilePictureUpdate}
                  />
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
                    <div className="w-full h-full flex items-center justify-center bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-bold text-3xl">
                      {user.first_name?.[0]}
                      {user.last_name?.[0]}
                    </div>
                  )}
                  {/* Overlay hidden upload trigger */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 cursor-pointer">
                    <div className="opacity-0 w-full h-full absolute inset-0 overflow-hidden">
                      <ProfilePictureUpload
                        onUploadSuccess={handleProfilePictureUpdate}
                      />
                    </div>
                    <Camera className="w-5 h-5 text-white" />
                    <span className="text-white text-[11px] font-medium">
                      Change
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Name & Role */}
            <div className="flex-1 mb-1 pt-2 sm:pt-0">
              <h1 className="text-xl sm:text-2xl font-bold text-text-primary-light dark:text-text-primary-dark">
                {user.first_name} {user.last_name}
              </h1>
              <div className="flex items-center flex-wrap gap-2 text-sm text-text-secondary-light dark:text-text-secondary-dark/70 mt-1.5">
                <span className="flex items-center gap-1.5">
                  <Mail size={14} className="text-gray-400 dark:text-gray-500" /> {user.email}
                </span>
                <span className="w-1 h-1 bg-gray-300 dark:bg-gray-600 rounded-full hidden sm:block" />
                <span className="capitalize px-3 py-1 bg-blue-100 dark:bg-blue-900/20 rounded-full text-blue-700 dark:text-blue-400 text-xs font-semibold">
                  {user.role}
                </span>
              </div>
            </div>

            {/* Message Toast */}
            {message && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className={`px-4 py-2 rounded-full text-sm font-medium ${message.type === "success" ? "bg-emerald-50 text-emerald-700 dark:text-emerald-400 dark:bg-emerald-900/20" : "bg-red-50 text-red-700 dark:text-red-400 dark:bg-red-900/20"}`}
              >
                {message.text}
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Info Grid */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
      >
        {/* Personal Details */}
        <DataCard title="Personal Information" icon={User} color="blue">
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
          <div className="pt-3.5 border-t border-gray-100 dark:border-border-dark/30">
            <div className="flex items-start gap-2 text-sm">
              <MapPin size={16} className="text-gray-400 dark:text-gray-500 mt-0.5 shrink-0" />
              <span className="text-text-secondary-light dark:text-text-secondary-dark">
                {user.address || (
                  <span className="text-gray-400 dark:text-gray-600 italic">
                    No address provided
                  </span>
                )}
              </span>
            </div>
          </div>
        </DataCard>

        {/* System Identity */}
        <DataCard title="System Identity" icon={Fingerprint} color="violet">
          <Field label="User ID" value={user.id} copyable />
          <Field label="MIS ID" value={user.mis_user_id} copyable />
          <Field label="External ID" value={user.external_id} copyable />
          <Field label="Account Type" value={user.user_type || user.role} />
        </DataCard>

        {/* Academic / Work Info */}
        <DataCard title="Academic & Department" icon={Briefcase} color="emerald">
          <Field label="Department" value={user.department} />
          <Field label="Role" value={user.role} />

          {user.assigned_programs && user.assigned_programs.length > 0 && (
            <div className="pt-3.5 border-t border-gray-100 dark:border-border-dark/30">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-2">
                Assigned Programs
              </span>
              <div className="flex flex-wrap gap-2">
                {user.assigned_programs.map((prog: any, i: number) => (
                  <span
                    key={i}
                    className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300"
                  >
                    <BookOpen size={12} className="mr-1.5 opacity-70" />
                    {prog.name || prog}
                  </span>
                ))}
              </div>
            </div>
          )}
        </DataCard>
      </motion.div>
    </motion.div>
  );
};

export default Profile;
