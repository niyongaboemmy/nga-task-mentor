import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { ThemeToggle } from "../ThemeToggle";
import HomeNavbar from "../HomeNavbar";

interface FormData {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: "student" | "instructor";
}

const Register: React.FC = () => {
  // ✅ Hook called at top-level
  const { register: registerUser } = useAuth();

  const [formData, setFormData] = useState<FormData>({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "student",
  });
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState<boolean>(false);

  // Handle input changes
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // ✅ Client-side validation
    if (!formData.first_name.trim())
      return setError("Please provide first name");
    if (!formData.last_name.trim()) return setError("Please provide last name");
    if (!formData.email.trim()) return setError("Please provide email");
    if (formData.password !== formData.confirmPassword)
      return setError("Passwords do not match");
    if (formData.password.length < 6)
      return setError("Password must be at least 6 characters long");

    setLoading(true);

    try {
      const registerData = {
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        role: formData.role,
      };

      await registerUser(registerData);
      // Navigation handled in AuthContext
    } catch (err: any) {
      console.error("Registration error:", err);
      setError(
        err.response?.data?.message ||
          err.message ||
          "Registration failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-100 dark:bg-gray-950 h-screen">
      <HomeNavbar />
      <div className="flex items-center justify-center py-3 md:py-6 px-4 sm:px-6 lg:px-8">
        <div className="fixed top-5 right-5">
          <ThemeToggle />
        </div>
        <div className="max-w-xl w-full space-y-3">
          <div className="text-center">
            <h2 className="mt-3 text-3xl font-bold">Create New Account</h2>
            <p className="mt-0 text-sm text-gray-600 dark:text-gray-400">
              Create a new account
            </p>
          </div>

          <form
            className="mt-8 space-y-3 dark:bg-gray-900 bg-white p-4 md:p-6 rounded-2xl shadow-xl"
            onSubmit={handleSubmit}
          >
            {/* Name fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="first_name"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1"
                >
                  First Name
                </label>
                <input
                  id="first_name"
                  name="first_name"
                  type="text"
                  required
                  value={formData.first_name}
                  onChange={handleChange}
                  className="block w-full pl-4 pr-3 py-3 border border-gray-300 dark:bg-gray-900 dark:border-gray-800 rounded-xl placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 dark:text-white"
                />
              </div>

              <div>
                <label
                  htmlFor="last_name"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1"
                >
                  Last Name
                </label>
                <input
                  id="last_name"
                  name="last_name"
                  type="text"
                  required
                  value={formData.last_name}
                  onChange={handleChange}
                  className="block w-full pl-4 pr-3 py-3 border border-gray-300 dark:bg-gray-900 dark:border-gray-800 rounded-xl placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 dark:text-white"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="block w-full pl-4 pr-3 py-3 border border-gray-300 dark:bg-gray-900 dark:border-gray-800 rounded-xl placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 dark:text-white"
              />
            </div>

            {/* Password fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={formData.password}
                    onChange={handleChange}
                    className="block w-full pl-4 pr-3 py-3 border border-gray-300 dark:bg-gray-900 dark:border-gray-800 rounded-xl placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 dark:text-white"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword((prev) => !prev)}
                  >
                    {showPassword ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1"
                >
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className="block w-full pl-4 pr-3 py-3 border border-gray-300 dark:bg-gray-900 dark:border-gray-800 rounded-xl placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 dark:text-white"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                  >
                    {showConfirmPassword ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>
            </div>

            {/* Role */}
            <div>
              <label
                htmlFor="role"
                className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1"
              >
                Role
              </label>
              <select
                id="role"
                name="role"
                value={formData.role}
                onChange={handleChange}
                className="block w-full pl-4 pr-3 py-3 border border-gray-300 dark:bg-gray-900 dark:border-gray-800 rounded-xl placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 dark:text-white"
              >
                <option value="student">Student</option>
                <option value="instructor">Instructor</option>
              </select>
            </div>

            {/* Error message */}
            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="text-sm text-red-700">{error}</div>
              </div>
            )}

            {/* Submit button */}
            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-medium rounded-full text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {loading ? "Creating account..." : "Create account"}
              </button>
              <p className="mt-2 text-center text-sm text-gray-600">
                Or{" "}
                <Link
                  to="/login"
                  className="font-medium text-blue-600 dark:text-blue-500 hover:text-blue-500 dark:hover:text-blue-400 hover:underline"
                >
                  sign in to your existing account
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Register;
