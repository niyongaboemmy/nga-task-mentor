import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import axios from "axios";
import StudentStatusToggle from "./StudentStatusToggle";

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  profile_image?: string;
  enrollmentDate: string;
  status: "enrolled" | "completed" | "dropped";
}

const CourseStudents: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const response = await axios.get(`/api/courses/${courseId}/students`);
        setStudents(response.data.data);
      } catch (error) {
        console.error("Error fetching course students:", error);
        alert("Failed to load students");
      } finally {
        setIsLoading(false);
      }
    };

    fetchStudents();
  }, [courseId]);

  const handleStatusChange = (
    studentId: string,
    newStatus: "enrolled" | "completed" | "dropped"
  ) => {
    setStudents((prevStudents) =>
      prevStudents.map((student) =>
        student.id === studentId ? { ...student, status: newStatus } : student
      )
    );
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading students...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Students in Course</h2>
        <div className="space-x-2">
          <button
            onClick={() => navigate(`/courses/${courseId}/enroll`)}
            className="px-5 py-2.5 text-sm bg-blue-600 text-white rounded-full hover:bg-blue-700"
          >
            Enroll Students
          </button>
          <Link
            to={`/courses/${courseId}`}
            className="px-5 py-2.5 text-sm border border-gray-300 rounded-full hover:bg-gray-50"
          >
            Back to Course
          </Link>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 shadow overflow-x-auto sm:rounded-2xl">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Profile
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Enrollment Date
              </th>
              <th className="px-1 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
            {students.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-6 py-4 text-center text-gray-500 dark:text-gray-300"
                >
                  No students enrolled in this course yet.
                </td>
              </tr>
            ) : (
              students.map((student) => (
                <tr
                  key={student.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <td className="px-6 py-1 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        {student.profile_image ? (
                          <img
                            src={student.profile_image}
                            alt={`${student.firstName} ${student.lastName}`}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 bg-gradient-to-br from-blue-400 dark:from-blue-600 to-blue-500 dark:to-blue-800 rounded-full flex items-center justify-center">
                            <span className="text-white font-bold text-sm">
                              {student.firstName[0]}
                              {student.lastName[0]}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-1 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {student.firstName} {student.lastName}
                    </div>
                  </td>
                  <td className="px-6 py-1 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {student.email}
                  </td>
                  <td className="px-6 py-1 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {new Date(student.enrollmentDate).toLocaleDateString()}
                  </td>
                  <td className="px-1 py-1 whitespace-nowrap">
                    <div className="z-50">
                      <StudentStatusToggle
                        courseId={courseId!}
                        studentId={student.id}
                        currentStatus={student.status}
                        onStatusChange={handleStatusChange}
                        size="sm"
                      />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CourseStudents;
