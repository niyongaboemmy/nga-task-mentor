import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

const AssignInstructor: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const [instructors, setInstructors] = useState<User[]>([]);
  const [selectedInstructor, setSelectedInstructor] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchInstructors = async () => {
      try {
        const response = await axios.get("/api/users", {
          params: { role: "instructor" },
        });
        setInstructors(response.data.data);
      } catch (error) {
        console.error("Error fetching instructors:", error);
        alert("Failed to load instructors");
      } finally {
        setIsLoading(false);
      }
    };

    fetchInstructors();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInstructor) {
      alert("Please select an instructor");
      return;
    }

    setIsSubmitting(true);
    try {
      await axios.put(`/api/courses/${courseId}/assign-instructor`, {
        instructorId: selectedInstructor,
      });
      alert("Instructor assigned successfully!");
      navigate(`/courses/${courseId}`);
    } catch (error) {
      console.error("Error assigning instructor:", error);
      alert("Failed to assign instructor");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading instructors...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6">Assign Instructor to Course</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Select Instructor
          </label>
          <select
            value={selectedInstructor}
            onChange={(e) => setSelectedInstructor(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            required
          >
            <option value="">-- Select an instructor --</option>
            {instructors.map((instructor) => (
              <option key={instructor.id} value={instructor.id}>
                {instructor.firstName} {instructor.lastName} ({instructor.email})
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !selectedInstructor}
            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {isSubmitting ? "Assigning..." : "Assign Instructor"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AssignInstructor;
