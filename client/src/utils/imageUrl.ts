export const getProfileImageUrl = (
  filename: string | null | undefined,
): string | null => {
  if (!filename) return null;
  // The central NGA MIS picture is stored as its full (signed, versioned) URL;
  // only legacy Task Mentor uploads are bare filenames served from this API.
  if (/^(https?:|blob:|data:)/i.test(filename)) return filename;

  const envUrl = import.meta.env.VITE_API_BASE_URL;
  const apiBaseUrl = envUrl
    ? envUrl.endsWith("/api")
      ? envUrl
      : `${envUrl}/api`
    : "http://localhost:5001/api";

  return `${apiBaseUrl}/users/profile-picture/${filename}`;
};
