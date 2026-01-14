import React, { useState, useRef, useEffect } from "react";
import { Button } from "../ui/Button";
import { motion } from "framer-motion";
import axios from "axios";

interface CreateAssignmentProps {
  onSubmit: (assignmentData: {
    title: string;
    description: string;
    due_date: string;
    max_score: number;
    submission_type: string;
    course_id: string;
  }) => void;
  onCancel?: () => void;
  initialCourseId?: string;
}

const CreateAssignment: React.FC<CreateAssignmentProps> = ({
  onSubmit,
  onCancel,
  initialCourseId,
}) => {
  const [courses, setCourses] = useState<
    { id: string; title: string; code: string }[]
  >([]);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    due_date: "",
    max_score: 100,
    submission_type: "both",
    course_id: initialCourseId || "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Fetch courses for the current user
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const response = await axios.get("/api/courses");
        const coursesData = response.data.data || response.data;
        setCourses(coursesData);
      } catch (error) {
        console.error("Error fetching courses:", error);
        setCourses([]);
      }
    };

    fetchCourses();
  }, []);

  // Initialize editor content when component mounts
  useEffect(() => {
    if (editorRef.current && !isInitialized) {
      editorRef.current.innerHTML = formData.description || "";
      setIsInitialized(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting) return;

    setIsSubmitting(true);

    // Get final content from editor
    const finalContent = editorRef.current?.innerHTML || "";

    try {
      // Send due_date exactly as entered (no timezone conversion)
      await onSubmit({
        ...formData,
        description: finalContent,
        due_date: formData.due_date, // Send exactly as entered
      });

      // Reset form only after successful submission
      setFormData({
        title: "",
        description: "",
        due_date: "",
        max_score: 100,
        submission_type: "both",
        course_id: "",
      });
      setIsInitialized(false);
    } catch (error) {
      console.error("Error creating assignment:", error);
      // Don't reset form on error
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "max_score" ? parseInt(value) : value,
    }));
  };

  const handleEditorInput = () => {
    if (editorRef.current) {
      const content = editorRef.current.innerHTML;
      if (content !== formData.description) {
        setFormData((prev) => ({
          ...prev,
          description: content,
        }));
      }
    }
  };

  // Check if formatting is currently active on selected text
  const isFormattingActive = (command: string): boolean => {
    try {
      // Check if queryCommandState is available (not deprecated in all browsers yet)
      if (typeof document.queryCommandState === "function") {
        return document.queryCommandState(command);
      }

      // Fallback: manual detection using DOM inspection
      return detectFormattingFromDOM(command);
    } catch {
      // Fallback to DOM detection if queryCommandState fails
      return detectFormattingFromDOM(command);
    }
  };

  // Manual DOM-based formatting detection (fallback for deprecated queryCommandState)
  const detectFormattingFromDOM = (command: string): boolean => {
    try {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        return false;
      }

      const range = selection.getRangeAt(0);
      if (range.collapsed) {
        return false; // No text selected
      }

      let element: Node | null = range.commonAncestorContainer;

      // If it's a text node, get its parent
      if (element && element.nodeType === Node.TEXT_NODE) {
        element = element.parentElement;
      }

      // Walk up to find the formatting
      while (element && element !== editorRef.current) {
        const styles = window.getComputedStyle(element as Element);

        switch (command) {
          case "bold":
            if (styles.fontWeight === "bold" || styles.fontWeight === "700") {
              return true;
            }
            break;
          case "italic":
            if (styles.fontStyle === "italic") {
              return true;
            }
            break;
          case "underline":
            if (styles.textDecoration.includes("underline")) {
              return true;
            }
            break;
          case "strikeThrough":
            if (styles.textDecoration.includes("line-through")) {
              return true;
            }
            break;
          case "justifyLeft":
            if (styles.textAlign === "left") {
              return true;
            }
            break;
          case "justifyCenter":
            if (styles.textAlign === "center") {
              return true;
            }
            break;
          case "justifyRight":
            if (styles.textAlign === "right") {
              return true;
            }
            break;
          case "insertUnorderedList":
            if (
              (element as Element).tagName === "UL" ||
              (element as Element).tagName === "LI"
            ) {
              return true;
            }
            break;
          case "insertOrderedList":
            if (
              (element as Element).tagName === "OL" ||
              (element as Element).tagName === "LI"
            ) {
              return true;
            }
            break;
        }

        element = element.parentElement;
      }

      return false;
    } catch {
      return false;
    }
  };

  // Check if a specific font is currently applied
  const isFontActive = (fontName: string): boolean => {
    try {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        let element: Node | null = range.commonAncestorContainer;

        if (element && element.nodeType === Node.TEXT_NODE) {
          element = element.parentElement;
        }

        while (element && element !== editorRef.current) {
          const fontFamily = window.getComputedStyle(
            element as Element
          ).fontFamily;
          if (
            fontFamily &&
            fontFamily.toLowerCase().includes(fontName.toLowerCase())
          ) {
            return true;
          }
          element = element.parentElement;
        }
      }
      return false;
    } catch {
      return false;
    }
  };

  // Check if a specific font size is currently applied
  const isFontSizeActive = (sizeValue: string): boolean => {
    try {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        let element: Node | null = range.commonAncestorContainer;

        if (element && element.nodeType === Node.TEXT_NODE) {
          element = element.parentElement;
        }

        while (element && element !== editorRef.current) {
          const fontSize = window.getComputedStyle(element as Element).fontSize;
          if (fontSize && fontSize !== "16px") {
            const sizeNum = parseInt(fontSize);
            switch (sizeValue) {
              case "1":
                return sizeNum >= 8 && sizeNum <= 10;
              case "2":
                return sizeNum >= 11 && sizeNum <= 12;
              case "3":
                return sizeNum >= 13 && sizeNum <= 14;
              case "4":
                return sizeNum >= 15 && sizeNum <= 16;
              case "5":
                return sizeNum >= 17 && sizeNum <= 18;
              case "6":
                return sizeNum >= 19 && sizeNum <= 20;
              case "7":
                return sizeNum >= 21 && sizeNum <= 24;
            }
          }
          element = element.parentElement;
        }
      }
      return false;
    } catch {
      return false;
    }
  };

  // Get current font family
  const getCurrentFontFamily = (): string => {
    try {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        let element: Node | null = range.commonAncestorContainer;

        if (element && element.nodeType === Node.TEXT_NODE) {
          element = element.parentElement;
        }

        while (element && element !== editorRef.current) {
          const fontFamily = window.getComputedStyle(
            element as Element
          ).fontFamily;
          if (
            fontFamily &&
            fontFamily !== '"Segoe UI", "Helvetica Neue", Arial, sans-serif'
          ) {
            const fonts = [
              "Arial",
              "Georgia",
              "Times New Roman",
              "Verdana",
              "Courier New",
            ];
            for (const font of fonts) {
              if (fontFamily.toLowerCase().includes(font.toLowerCase())) {
                return font;
              }
            }
          }
          element = element.parentElement;
        }
      }
      return "";
    } catch {
      return "";
    }
  };

  // Get current font size
  const getCurrentFontSize = (): string => {
    try {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        let element: Node | null = range.commonAncestorContainer;

        if (element && element.nodeType === Node.TEXT_NODE) {
          element = element.parentElement;
        }

        while (element && element !== editorRef.current) {
          const fontSize = window.getComputedStyle(element as Element).fontSize;
          if (fontSize && fontSize !== "16px") {
            const sizeNum = parseInt(fontSize);
            if (sizeNum >= 8 && sizeNum <= 10) return "1";
            if (sizeNum >= 11 && sizeNum <= 12) return "2";
            if (sizeNum >= 13 && sizeNum <= 14) return "3";
            if (sizeNum >= 15 && sizeNum <= 16) return "4";
            if (sizeNum >= 17 && sizeNum <= 18) return "5";
            if (sizeNum >= 19 && sizeNum <= 20) return "6";
            if (sizeNum >= 21 && sizeNum <= 24) return "7";
          }
          element = element.parentElement;
        }
      }
      return "";
    } catch {
      return "";
    }
  };

  // Get current list style
  const getCurrentListStyle = (): string => {
    try {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        let element: Node | null = range.commonAncestorContainer;

        if (element && element.nodeType === Node.TEXT_NODE) {
          element = element.parentElement;
        }

        while (element && element !== editorRef.current) {
          if ((element as Element).tagName === "OL") {
            const style = window.getComputedStyle(
              element as Element
            ).listStyleType;
            switch (style) {
              case "decimal":
                return "decimal";
              case "lower-alpha":
                return "lower-alpha";
              case "upper-alpha":
                return "upper-alpha";
              case "lower-roman":
                return "lower-roman";
              case "upper-roman":
                return "upper-roman";
              default:
                return "decimal";
            }
          }
          element = element.parentElement;
        }
      }
      return "";
    } catch {
      return "";
    }
  };

  const insertFormatting = (command: string, value?: string) => {
    if (editorRef.current) {
      editorRef.current.focus();

      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        const range = document.createRange();
        range.selectNodeContents(editorRef.current);
        range.collapse(false);
        selection?.removeAllRanges();
        selection?.addRange(range);
      }

      try {
        switch (command) {
          case "createLink":
            const url = prompt("Enter URL:");
            if (url && url.trim()) {
              document.execCommand(command, false, url.trim());
            }
            break;
          case "insertImage":
            const imageUrl = prompt("Enter image URL:");
            if (imageUrl && imageUrl.trim()) {
              document.execCommand(command, false, imageUrl.trim());
            }
            break;
          case "foreColor":
          case "backColor":
            if (value) {
              document.execCommand(command, false, value);
            }
            break;
          case "fontName":
            if (value) {
              document.execCommand(command, false, value);
            }
            break;
          case "fontSize":
            if (value) {
              document.execCommand(command, false, value);
            }
            break;
          case "insertOrderedList":
            // First check if we're in a list already
            const isInOrderedList =
              detectFormattingFromDOM("insertOrderedList");
            if (isInOrderedList) {
              // If already in ordered list, outdent or convert to normal text
              document.execCommand("outdent", false);
              if (detectFormattingFromDOM("insertOrderedList")) {
                // If still in list, convert to paragraph
                document.execCommand("formatBlock", false, "p");
              }
            } else {
              // Insert new ordered list
              document.execCommand(command, false, value || undefined);
            }
            break;
          case "insertUnorderedList":
            // First check if we're in a list already
            const isInUnorderedList = detectFormattingFromDOM(
              "insertUnorderedList"
            );
            if (isInUnorderedList) {
              // If already in unordered list, outdent or convert to normal text
              document.execCommand("outdent", false);
              if (detectFormattingFromDOM("insertUnorderedList")) {
                // If still in list, convert to paragraph
                document.execCommand("formatBlock", false, "p");
              }
            } else {
              // Insert new unordered list
              document.execCommand(command, false, value || undefined);
            }
            break;
          case "formatBlock":
            if (value) {
              const tagName = value.replace(/[<>]/g, "");
              document.execCommand(command, false, tagName);
            }
            break;
          default:
            document.execCommand(command, false, value || undefined);
        }
      } catch (error) {
        console.error("Error executing command:", command, error);
      }

      const content = editorRef.current.innerHTML;
      setFormData((prev) => ({
        ...prev,
        description: content,
      }));

      editorRef.current.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault(); // Prevent default paste behavior

    const clipboardData = e.clipboardData;
    if (!clipboardData) return;

    // Try to get HTML content first (to preserve formatting)
    const htmlContent = clipboardData.getData("text/html");
    const textContent = clipboardData.getData("text/plain");

    if (htmlContent) {
      // Parse HTML and clean it
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = htmlContent;

      // Remove style attributes and color-related properties
      const cleanHtml = cleanPastedHtml(tempDiv);

      // Insert the cleaned HTML
      document.execCommand("insertHTML", false, cleanHtml);

      // Set default black color for all text
      setTimeout(() => {
        if (editorRef.current) {
          // Select all content and apply black color
          const selection = window.getSelection();
          if (selection) {
            selection.selectAllChildren(editorRef.current);
            document.execCommand("foreColor", false, "#000000");
            // Collapse selection to end
            selection.collapseToEnd();
          }
        }
      }, 10);
    } else if (textContent) {
      // Fallback to plain text
      document.execCommand("insertText", false, textContent);

      // Set default black color
      setTimeout(() => {
        if (editorRef.current) {
          const selection = window.getSelection();
          if (selection && selection.rangeCount > 0) {
            document.execCommand("foreColor", false, "#000000");
          }
        }
      }, 10);
    }

    // Update form data
    setTimeout(() => {
      if (editorRef.current) {
        const content = editorRef.current.innerHTML;
        setFormData((prev) => ({
          ...prev,
          description: content,
        }));
      }
    }, 20);
  };

  // Helper function to clean pasted HTML content
  const cleanPastedHtml = (element: HTMLElement): string => {
    // Remove script tags and other dangerous elements
    const scripts = element.querySelectorAll("script, style, link, meta");
    scripts.forEach((el) => el.remove());

    // Remove inline styles and color-related attributes
    const allElements = element.querySelectorAll("*");
    allElements.forEach((el) => {
      const htmlEl = el as HTMLElement;

      // Remove style attribute entirely
      htmlEl.removeAttribute("style");

      // Remove color-related attributes
      htmlEl.removeAttribute("color");
      htmlEl.removeAttribute("bgcolor");
      htmlEl.removeAttribute("text");
      htmlEl.removeAttribute("link");
      htmlEl.removeAttribute("alink");
      htmlEl.removeAttribute("vlink");

      // Remove font tags and span tags that only contain color
      if (el.tagName === "FONT" || el.tagName === "SPAN") {
        const style = htmlEl.getAttribute("style") || "";
        if (style.includes("color") || style.includes("background")) {
          // If element only has color styling, unwrap it
          const parent = htmlEl.parentElement;
          if (
            parent &&
            htmlEl.childNodes.length === 1 &&
            htmlEl.childNodes[0].nodeType === Node.TEXT_NODE
          ) {
            parent.replaceChild(htmlEl.childNodes[0], htmlEl);
          }
        }
      }
    });

    return element.innerHTML;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case "b":
          e.preventDefault();
          insertFormatting("bold");
          break;
        case "i":
          e.preventDefault();
          insertFormatting("italic");
          break;
        case "u":
          e.preventDefault();
          insertFormatting("underline");
          break;
        case "z":
          if (e.shiftKey) {
            e.preventDefault();
            insertFormatting("redo");
          } else {
            e.preventDefault();
            insertFormatting("undo");
          }
          break;
        case "y":
          e.preventDefault();
          insertFormatting("redo");
          break;
      }
    }
  };

  const handleEditorClick = () => {
    if (editorRef.current) {
      editorRef.current.focus();
    }
  };

  return (
    <motion.div
      className="max-w-4xl mx-auto bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <motion.h1
          className="text-2xl font-semibold text-gray-900 dark:text-white mb-1"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          Create New Assignment
        </motion.h1>
        <motion.p
          className="text-sm text-gray-600 dark:text-gray-400"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          Design and publish your assignment for students
        </motion.p>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* Assignment Header - Modern Combined Layout */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl p-6 border border-blue-100 dark:border-blue-800"
        >
          <div className="flex items-start gap-4">
            {/* Icon */}
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="gap-6">
                {/* Title */}
                <div className="mb-2">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Assignment Title
                  </label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    required
                    placeholder="Enter a compelling title..."
                    className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white transition-all duration-200 bg-white/80 backdrop-blur-sm"
                  />
                </div>

                {/* Course Selection */}
                <div className="mb-2">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Course
                  </label>
                  <select
                    name="course_id"
                    value={formData.course_id}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white transition-all duration-200 bg-white/80 backdrop-blur-sm"
                  >
                    <option value="">Select a course</option>
                    {courses.map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.code} - {course.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Metadata - All on one line */}
                <div className="flex flex-wrap gap-4 items-end">
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Due Date & Time
                    </label>
                    <input
                      type="datetime-local"
                      name="due_date"
                      value={formData.due_date}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white transition-all duration-200 bg-white/80 backdrop-blur-sm"
                    />
                  </div>

                  <div className="flex-1 min-w-[120px]">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Max Score
                    </label>
                    <input
                      type="number"
                      name="max_score"
                      value={formData.max_score}
                      onChange={handleChange}
                      min="1"
                      max="1000"
                      className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white transition-all duration-200 bg-white/80 backdrop-blur-sm"
                    />
                  </div>

                  <div className="flex-1 min-w-[150px]">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Submission Type
                    </label>
                    <select
                      name="submission_type"
                      value={formData.submission_type}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white transition-all duration-200 bg-white/80 backdrop-blur-sm"
                    >
                      <option value="both">📁 File & ✍️ Text</option>
                      <option value="file">📁 File Only</option>
                      <option value="text">✍️ Text Only</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Description Editor */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Description
          </label>
          <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-800">
            {/* Enhanced Toolbar - Google Docs Style */}
            <div className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-2">
              <div className="flex flex-wrap items-center gap-1 text-sm">
                {/* Undo/Redo */}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => insertFormatting("undo")}
                  className="h-8 w-8 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                  ↶
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => insertFormatting("redo")}
                  className="h-8 w-8 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                  ↷
                </Button>

                {/* Font Family */}
                <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />
                <select
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value) {
                      insertFormatting("fontName", value);
                    }
                  }}
                  className="h-8 px-2 text-xs border border-gray-300 rounded bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  value={getCurrentFontFamily()}
                >
                  <option value="">Font</option>
                  <option
                    value="Arial"
                    className={isFontActive("Arial") ? "bg-blue-50" : ""}
                  >
                    Arial
                  </option>
                  <option
                    value="Georgia"
                    className={isFontActive("Georgia") ? "bg-blue-50" : ""}
                  >
                    Georgia
                  </option>
                  <option
                    value="Times New Roman"
                    className={
                      isFontActive("Times New Roman") ? "bg-blue-50" : ""
                    }
                  >
                    Times
                  </option>
                  <option
                    value="Verdana"
                    className={isFontActive("Verdana") ? "bg-blue-50" : ""}
                  >
                    Verdana
                  </option>
                  <option
                    value="Courier New"
                    className={isFontActive("Courier New") ? "bg-blue-50" : ""}
                  >
                    Courier
                  </option>
                </select>

                {/* Font Size */}
                <select
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value) {
                      insertFormatting("fontSize", value);
                    }
                  }}
                  className="h-8 px-2 text-xs border border-gray-300 rounded bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white w-16"
                  value={getCurrentFontSize()}
                >
                  <option value="">Size</option>
                  <option
                    value="1"
                    className={isFontSizeActive("1") ? "bg-blue-50" : ""}
                  >
                    8
                  </option>
                  <option
                    value="2"
                    className={isFontSizeActive("2") ? "bg-blue-50" : ""}
                  >
                    10
                  </option>
                  <option
                    value="3"
                    className={isFontSizeActive("3") ? "bg-blue-50" : ""}
                  >
                    12
                  </option>
                  <option
                    value="4"
                    className={isFontSizeActive("4") ? "bg-blue-50" : ""}
                  >
                    14
                  </option>
                  <option
                    value="5"
                    className={isFontSizeActive("5") ? "bg-blue-50" : ""}
                  >
                    16
                  </option>
                  <option
                    value="6"
                    className={isFontSizeActive("6") ? "bg-blue-50" : ""}
                  >
                    18
                  </option>
                  <option
                    value="7"
                    className={isFontSizeActive("7") ? "bg-blue-50" : ""}
                  >
                    24
                  </option>
                </select>

                {/* Text Formatting */}
                <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />
                <Button
                  type="button"
                  variant={isFormattingActive("bold") ? "primary" : "ghost"}
                  size="sm"
                  onClick={() => insertFormatting("bold")}
                  className={`h-8 w-8 p-0 font-bold ${
                    isFormattingActive("bold")
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-800 dark:text-blue-200"
                      : "hover:bg-gray-200 dark:hover:bg-gray-700"
                  }`}
                >
                  B
                </Button>
                <Button
                  type="button"
                  variant={isFormattingActive("italic") ? "primary" : "ghost"}
                  size="sm"
                  onClick={() => insertFormatting("italic")}
                  className={`h-8 w-8 p-0 italic ${
                    isFormattingActive("italic")
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-800 dark:text-blue-200"
                      : "hover:bg-gray-200 dark:hover:bg-gray-700"
                  }`}
                >
                  I
                </Button>
                <Button
                  type="button"
                  variant={
                    isFormattingActive("underline") ? "primary" : "ghost"
                  }
                  size="sm"
                  onClick={() => insertFormatting("underline")}
                  className={`h-8 w-8 p-0 underline ${
                    isFormattingActive("underline")
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-800 dark:text-blue-200"
                      : "hover:bg-gray-200 dark:hover:bg-gray-700"
                  }`}
                >
                  U
                </Button>
                <Button
                  type="button"
                  variant={
                    isFormattingActive("strikeThrough") ? "primary" : "ghost"
                  }
                  size="sm"
                  onClick={() => insertFormatting("strikeThrough")}
                  className={`h-8 w-8 p-0 line-through ${
                    isFormattingActive("strikeThrough")
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-800 dark:text-blue-200"
                      : "hover:bg-gray-200 dark:hover:bg-gray-700"
                  }`}
                >
                  S
                </Button>

                {/* Text Color */}
                <div className="relative">
                  <input
                    type="color"
                    onChange={(e) =>
                      insertFormatting("foreColor", e.target.value)
                    }
                    className="absolute inset-0 w-8 h-8 opacity-0 cursor-pointer"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`h-8 w-8 p-0 ${
                      isFormattingActive("foreColor")
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-800 dark:text-blue-200"
                        : "hover:bg-gray-200 dark:hover:bg-gray-700"
                    }`}
                  >
                    <span className="text-xs font-bold">A</span>
                  </Button>
                </div>

                {/* Background Color */}
                <div className="relative">
                  <input
                    type="color"
                    onChange={(e) =>
                      insertFormatting("backColor", e.target.value)
                    }
                    className="absolute inset-0 w-8 h-8 opacity-0 cursor-pointer"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`h-8 w-8 p-0 ${
                      isFormattingActive("backColor")
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-800 dark:text-blue-200"
                        : "hover:bg-gray-200 dark:hover:bg-gray-700"
                    }`}
                  >
                    <span className="text-xs">🎨</span>
                  </Button>
                </div>

                {/* Lists - Google Docs Style with Numbering Options */}
                <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />
                <div className="relative">
                  <Button
                    type="button"
                    variant={
                      isFormattingActive("insertUnorderedList")
                        ? "primary"
                        : "ghost"
                    }
                    size="sm"
                    onClick={() => {
                      // Reset to paragraph first to ensure clean state
                      document.execCommand("formatBlock", false, "p");
                      // Create unordered list
                      document.execCommand("insertUnorderedList", false);
                    }}
                    className={`h-8 w-8 p-0 ${
                      isFormattingActive("insertUnorderedList")
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-800 dark:text-blue-200"
                        : "hover:bg-gray-200 dark:hover:bg-gray-700"
                    }`}
                  >
                    •
                  </Button>
                </div>

                <div className="relative">
                  <select
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value) {
                        // Reset to paragraph first to ensure clean state
                        document.execCommand("formatBlock", false, "p");
                        // Create ordered list with specific style
                        document.execCommand("insertOrderedList", false);
                        // Apply the style immediately to the new list
                        setTimeout(() => {
                          const lists = editorRef.current?.querySelectorAll(
                            'ol:not([style*="list-style-type"])'
                          );
                          if (lists && lists.length > 0) {
                            const newList = lists[
                              lists.length - 1
                            ] as HTMLElement;
                            newList.style.listStyleType = value;
                            newList.style.marginLeft = "25px";
                          }
                        }, 10);
                      }
                    }}
                    className={`h-8 px-2 text-xs border border-gray-300 rounded bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                      isFormattingActive("insertOrderedList")
                        ? "bg-blue-50 border-blue-300"
                        : ""
                    }`}
                    value={getCurrentListStyle()}
                  >
                    <option value="">1.</option>
                    <option value="decimal">1, 2, 3</option>
                    <option value="lower-alpha">a, b, c</option>
                    <option value="upper-alpha">A, B, C</option>
                    <option value="lower-roman">i, ii, iii</option>
                    <option value="upper-roman">I, II, III</option>
                  </select>
                </div>

                {/* Indent/Outdent */}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => insertFormatting("indent")}
                  className="h-8 w-8 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                  ➡️
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => insertFormatting("outdent")}
                  className="h-8 w-8 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                  ⬅️
                </Button>

                {/* Alignment */}
                <Button
                  type="button"
                  variant={
                    isFormattingActive("justifyLeft") ? "primary" : "ghost"
                  }
                  size="sm"
                  onClick={() => insertFormatting("justifyLeft")}
                  className={`h-8 w-8 p-0 ${
                    isFormattingActive("justifyLeft")
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-800 dark:text-blue-200"
                      : "hover:bg-gray-200 dark:hover:bg-gray-700"
                  }`}
                >
                  ←
                </Button>
                <Button
                  type="button"
                  variant={
                    isFormattingActive("justifyCenter") ? "primary" : "ghost"
                  }
                  size="sm"
                  onClick={() => insertFormatting("justifyCenter")}
                  className={`h-8 w-8 p-0 ${
                    isFormattingActive("justifyCenter")
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-800 dark:text-blue-200"
                      : "hover:bg-gray-200 dark:hover:bg-gray-700"
                  }`}
                >
                  ↔
                </Button>
                <Button
                  type="button"
                  variant={
                    isFormattingActive("justifyRight") ? "primary" : "ghost"
                  }
                  size="sm"
                  onClick={() => insertFormatting("justifyRight")}
                  className={`h-8 w-8 p-0 ${
                    isFormattingActive("justifyRight")
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-800 dark:text-blue-200"
                      : "hover:bg-gray-200 dark:hover:bg-gray-700"
                  }`}
                >
                  →
                </Button>

                {/* Links and Media */}
                <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => insertFormatting("createLink")}
                  className="h-8 w-8 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                  🔗
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => insertFormatting("insertImage")}
                  className="h-8 w-8 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                  🖼️
                </Button>

                {/* Special Characters */}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => insertFormatting("subscript")}
                  className="h-8 w-8 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                  X₂
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => insertFormatting("superscript")}
                  className="h-8 w-8 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                  X²
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => insertFormatting("removeFormat")}
                  className="h-8 w-8 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                  ⌫
                </Button>
              </div>
            </div>

            {/* Rich Text Editor */}
            <div
              ref={editorRef}
              contentEditable
              onInput={handleEditorInput}
              onPaste={handlePaste}
              onKeyDown={handleKeyDown}
              onClick={handleEditorClick}
              className="w-full p-6 min-h-[300px] focus:outline-none overflow-auto bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              style={{
                fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif',
                fontSize: "15px",
                lineHeight: "1.6",
              }}
              data-placeholder="Start crafting your assignment description... Make it engaging and clear for your students!"
              suppressContentEditableWarning={true}
            >
              <style>
                {`
                  /* Base editor content styling */
                  div[contenteditable] {
                    padding-left: 0 !important;
                  }

                  div[contenteditable] * {
                    position: relative;
                  }

                  /* Paragraph styling - base alignment */
                  div[contenteditable] p {
                    margin: 0 0 8px 0 !important;
                    padding: 0 !important;
                    line-height: 1.5 !important;
                  }

                  /* List containers - indented from base */
                  div[contenteditable] ol,
                  div[contenteditable] ul {
                    margin: 0 0 8px 20px !important;
                    padding: 0 !important;
                    list-style-position: outside !important;
                  }

                  /* List items - no additional indentation */
                  div[contenteditable] li {
                    margin: 0 !important;
                    padding: 0 !important;
                    text-indent: 0 !important;
                    line-height: 1.5 !important;
                  }

                  /* Force display as list items */
                  div[contenteditable] ol li,
                  div[contenteditable] ul li {
                    display: list-item !important;
                  }
                `}
              </style>
            </div>
          </div>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          className="flex justify-end gap-4 pt-6 border-t border-gray-100 dark:border-gray-800"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          {onCancel && (
            <Button
              type="button"
              variant="secondary"
              onClick={onCancel}
              className="px-8"
            >
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting}
            className="px-8 bg-gradient-to-r from-blue-600 to-blue-600 hover:from-blue-700 hover:to-blue-700 dark:from-blue-500 dark:to-blue-500 dark:hover:from-blue-600 dark:hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Creating...
              </>
            ) : (
              "✨ Create Assignment"
            )}
          </Button>
        </motion.div>
      </form>
    </motion.div>
  );
};

export default CreateAssignment;
