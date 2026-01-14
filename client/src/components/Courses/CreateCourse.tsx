import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import { Form } from "../ui/Form";
import { FormField } from "../ui/FormField";
import { FormActions } from "../ui/FormActions";
import { Button } from "../ui/Button";

const CreateCourse: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    code: "",
    title: "",
    description: "",
    credits: 3,
    max_students: 30,
    start_date: "",
    end_date: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "credits" || name === "max_students" ? Number(value) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await axios.post("/api/courses", formData);
      toast.success("Course created successfully!");
      navigate("/courses");
    } catch (error) {
      console.error("Error creating course:", error);
      toast.error("Failed to create course");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form
      title="Create New Course"
      description="Fill in the details below to create a new course"
      onSubmit={handleSubmit}
    >
      <FormField
        label="Course Code"
        name="code"
        value={formData.code}
        onChange={handleChange}
        placeholder="e.g., CS101"
        required
      />

      <FormField
        label="Course Title"
        name="title"
        value={formData.title}
        onChange={handleChange}
        placeholder="e.g., Introduction to Computer Science"
        required
      />

      <FormField
        label="Description"
        name="description"
        type="textarea"
        value={formData.description}
        onChange={handleChange}
        placeholder="Brief description of the course"
        required
        rows={4}
      />

      <div className="grid grid-cols-2 gap-6">
        <FormField
          label="Credits"
          name="credits"
          type="number"
          value={formData.credits}
          onChange={handleChange}
          min={1}
          max={6}
          required
        />

        <FormField
          label="Max Students"
          name="max_students"
          type="number"
          value={formData.max_students}
          onChange={handleChange}
          min={1}
          max={200}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <FormField
          label="Start Date"
          name="start_date"
          type="date"
          value={formData.start_date}
          onChange={handleChange}
          required
        />

        <FormField
          label="End Date"
          name="end_date"
          type="date"
          value={formData.end_date}
          onChange={handleChange}
          required
        />
      </div>

      <FormActions>
        <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={isSubmitting}>
          {isSubmitting ? "Creating..." : "Create Course"}
        </Button>
      </FormActions>
    </Form>
  );
};

export default CreateCourse;
