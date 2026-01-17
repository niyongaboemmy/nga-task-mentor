export const getProfileImageUrl = (
  filename: string | null | undefined,
): string | null => {
  if (!filename) return null;

  const envUrl = import.meta.env.VITE_API_BASE_URL;
  const apiBaseUrl = envUrl
    ? envUrl.endsWith("/api")
      ? envUrl
      : `${envUrl}/api`
    : "http://localhost:5001/api";

  return `${apiBaseUrl}/users/profile-picture/${filename}`;
};
