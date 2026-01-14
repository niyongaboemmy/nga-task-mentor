import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  profile_image?: string | null;
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
}

const EnrollStudents: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();

  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const itemsPerPage = 10;

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        setIsLoading(true);
        setError(null);
        // Fetch students not enrolled in this course
        const response = await axios.get(
          `/api/courses/${courseId}/available-students`
        );
        setStudents(response.data.data || []);
      } catch (error) {
        console.error("Error fetching students:", error);
        setError("Failed to load students. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    if (courseId) {
      fetchStudents();
    }
  }, [courseId]);

  // Filter students based on search term
  const filteredStudents = useMemo(() => {
    if (!searchTerm) return students;
    return students.filter(
      (student) =>
        `${student.first_name} ${student.last_name}`
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        student.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [students, searchTerm]);

  // Paginate filtered students
  const paginatedStudents = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredStudents.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredStudents, currentPage, itemsPerPage]);

  // Calculate pagination info
  const paginationInfo: PaginationInfo = {
    currentPage,
    totalPages: Math.ceil(filteredStudents.length / itemsPerPage),
    totalItems: filteredStudents.length,
    itemsPerPage,
  };

  const handleSelectStudent = (studentId: string) => {
    setSelectedStudents((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId]
    );
  };

  const handleSelectAll = () => {
    if (selectedStudents.length === paginatedStudents.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(paginatedStudents.map((student) => student.id));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedStudents.length === 0) {
      alert("Please select at least one student to enroll");
      return;
    }

    setIsSubmitting(true);
    try {
      await axios.post(`/api/courses/${courseId}/enroll-students`, {
        studentIds: selectedStudents,
      });
      alert(`${selectedStudents.length} students enrolled successfully!`);
      navigate(`/courses/${courseId}/students`);
    } catch (error) {
      console.error("Error enrolling students:", error);
      alert("Failed to enroll students");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center bg-white dark:bg-gray-900 rounded-2xl shadow-md">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="text-gray-600 dark:text-gray-400">
            Loading students...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4">
        <div className="flex items-center">
          <svg
            className="w-5 h-5 text-red-400 mr-3"
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
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="space-y-6">
        {/* Header Card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/70 dark:border-gray-800/50 p-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Enroll Students
            </h1>
            <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-50 text-blue-700 border border-blue-200">
              {paginationInfo.totalItems} Available Students
            </div>
          </div>

          {/* Search Input */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg
                className="h-5 w-5 text-gray-400"
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
            </div>
            <input
              type="text"
              placeholder="Search students by name or email..."
              className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-gray-700 rounded-xl leading-5 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1); // Reset to first page when searching
              }}
            />
          </div>
        </div>

        {filteredStudents.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/70 dark:border-gray-800/50 p-8 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <p className="text-gray-500 dark:text-gray-400">
              {searchTerm
                ? `No students found matching "${searchTerm}"`
                : "No students available for enrollment"}
            </p>
          </div>
        ) : (
          <>
            {/* Students Table */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/70 dark:border-gray-800/50 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-6 py-3 text-left">
                        <input
                          type="checkbox"
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          checked={
                            selectedStudents.length ===
                              paginatedStudents.length &&
                            paginatedStudents.length > 0
                          }
                          ref={(el) => {
                            if (el)
                              el.indeterminate =
                                selectedStudents.length > 0 &&
                                selectedStudents.length <
                                  paginatedStudents.length;
                          }}
                          onChange={handleSelectAll}
                        />
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Profile
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                    {paginatedStudents.map((student) => (
                      <tr
                        key={student.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="checkbox"
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            checked={selectedStudents.includes(student.id)}
                            onChange={() => handleSelectStudent(student.id)}
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0">
                              {student.profile_image ? (
                                <img
                                  src={`${
                                    import.meta.env.VITE_API_BASE_URL
                                  }/uploads/profile-pictures/${
                                    student.profile_image
                                  }`}
                                  alt={`${student.first_name} ${student.last_name}`}
                                  className="w-8 h-8 rounded-full object-cover"
                                />
                              ) : (
                                <div className="w-8 h-8 bg-gradient-to-br from-blue-400 dark:from-blue-600 to-blue-500 dark:to-blue-800 rounded-full flex items-center justify-center">
                                  <span className="text-white font-bold text-sm">
                                    {student.first_name[0]}
                                    {student.last_name[0]}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {student.first_name} {student.last_name}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {student.email}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                            Available
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            {paginationInfo.totalPages > 1 && (
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/70 dark:border-gray-800/50 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-700 dark:text-gray-300">
                    Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                    {Math.min(
                      currentPage * itemsPerPage,
                      paginationInfo.totalItems
                    )}{" "}
                    of {paginationInfo.totalItems} students
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() =>
                        setCurrentPage((prev) => Math.max(1, prev - 1))
                      }
                      disabled={currentPage === 1}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>

                    <div className="flex items-center space-x-1">
                      {Array.from(
                        { length: paginationInfo.totalPages },
                        (_, i) => i + 1
                      )
                        .filter(
                          (page) =>
                            page === 1 ||
                            page === paginationInfo.totalPages ||
                            Math.abs(page - currentPage) <= 1
                        )
                        .map((page, index, array) => (
                          <React.Fragment key={page}>
                            {index > 0 && array[index - 1] !== page - 1 && (
                              <span className="px-2 text-gray-500">...</span>
                            )}
                            <button
                              onClick={() => setCurrentPage(page)}
                              className={`px-3 py-2 border rounded-md text-sm font-medium ${
                                currentPage === page
                                  ? "bg-blue-600 text-white border-blue-600"
                                  : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
                              }`}
                            >
                              {page}
                            </button>
                          </React.Fragment>
                        ))}
                    </div>

                    <button
                      onClick={() =>
                        setCurrentPage((prev) =>
                          Math.min(paginationInfo.totalPages, prev + 1)
                        )
                      }
                      disabled={currentPage === paginationInfo.totalPages}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Action Buttons */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/70 dark:border-gray-800/50 p-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700 dark:text-gray-300">
              {selectedStudents.length} student
              {selectedStudents.length !== 1 ? "s" : ""} selected
            </div>
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => navigate(`/courses/${courseId}/students`)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-full shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={selectedStudents.length === 0 || isSubmitting}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-full text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Enrolling...
                  </>
                ) : (
                  `Enroll ${selectedStudents.length} Student${
                    selectedStudents.length !== 1 ? "s" : ""
                  }`
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnrollStudents;
