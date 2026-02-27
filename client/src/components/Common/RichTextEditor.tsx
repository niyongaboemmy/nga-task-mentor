import React, { useCallback, useState } from "react";
import MathFormulaModal from "./MathFormulaModal";
import { useEditor, EditorContent, Extension } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Color } from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import { Underline } from "@tiptap/extension-underline";
import { Highlight } from "@tiptap/extension-highlight";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import ImageResize from "tiptap-extension-resize-image";
import { Link } from "@tiptap/extension-link";
import { TextAlign } from "@tiptap/extension-text-align";
import { FontFamily } from "@tiptap/extension-font-family";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import { Subscript } from "@tiptap/extension-subscript";
import { Superscript } from "@tiptap/extension-superscript";
import { HorizontalRule } from "@tiptap/extension-horizontal-rule";
import { Placeholder } from "@tiptap/extension-placeholder";
import { CharacterCount } from "@tiptap/extension-character-count";
import { Typography } from "@tiptap/extension-typography";
import { Strike } from "@tiptap/extension-strike";
import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";
import { motion } from "framer-motion";
import MathExtension from "@aarkue/tiptap-math-extension";
import "katex/dist/katex.min.css";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Undo,
  Redo,
  Link as LinkIcon,
  Image as ImageIcon,
  Table as TableIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  CheckSquare,
  Baseline,
  Highlighter,
  Trash2,
  ColumnsIcon,
  Quote,
  Code2,
  Maximize2,
  Strikethrough,
  SubscriptIcon,
  SuperscriptIcon,
  Eraser,
  BetweenHorizontalEnd,
  BetweenVerticalEnd,
  TableCellsMerge,
  TableCellsSplit,
  Palette,
  Sigma,
  Edit3,
} from "lucide-react";

import { FontSize } from "./extensions/fontSizeExtension";

// Custom Line Height Extension
const LineHeight = Extension.create({
  name: "lineHeight",
  addOptions() {
    return {
      types: ["paragraph", "heading", "listItem"],
      defaultLineHeight: "1.15",
    };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (element) => element.style.lineHeight,
            renderHTML: (attributes) => {
              if (!attributes.lineHeight) {
                return {};
              }
              return {
                style: `line-height: ${attributes.lineHeight}`,
              };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setLineHeight:
        (lineHeight: string) =>
        ({ commands }) => {
          return this.options.types.every((type: string) =>
            commands.updateAttributes(type, { lineHeight }),
          );
        },
      unsetLineHeight:
        () =>
        ({ commands }) => {
          return this.options.types.every((type: string) =>
            commands.updateAttributes(type, { lineHeight: null }),
          );
        },
    };
  },
});

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  minHeight?: string;
}

const lowlight = createLowlight(common);

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  content,
  onChange,
  placeholder = "Start typing your document...",
  minHeight = "400px",
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showTableMenu, setShowTableMenu] = useState(false);
  const [showMathModal, setShowMathModal] = useState(false);
  const [currentFontSize, setCurrentFontSize] = useState("11pt"); // Google Docs default
  const [currentLineHeight, setCurrentLineHeight] = useState("1.15");

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        horizontalRule: false,
        codeBlock: false, // Disable default to use lowlight
      }),
      Underline,
      Strike,
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      LineHeight,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({
        types: ["heading", "paragraph", "image"],
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class:
            "text-blue-600 dark:text-blue-400 underline decoration-blue-500/30 hover:decoration-blue-500 transition-all cursor-pointer",
        },
      }),
      ImageResize,
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class:
            "border-collapse table-fixed w-full my-6 bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-sm prose-p:my-0 prose-p:leading-tight",
        },
      }),
      TableRow,
      TableHeader.configure({
        HTMLAttributes: {
          class: "bg-gray-50/80 dark:bg-gray-700/50 font-bold",
        },
      }),
      TableCell.configure({
        HTMLAttributes: {
          class: "border border-gray-200 dark:border-gray-700 p-3 relative",
        },
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Subscript,
      Superscript,
      HorizontalRule.configure({
        HTMLAttributes: {
          class:
            "my-12 border-t-2 border-gray-200 dark:border-gray-700 rounded-full w-1/2 mx-auto",
        },
      }),
      CodeBlockLowlight.configure({
        lowlight,
        HTMLAttributes: {
          class:
            "rounded-lg p-4 bg-gray-950 text-gray-100 font-mono text-sm my-4",
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      CharacterCount,
      Typography,
      MathExtension.configure({
        evaluation: false,
        addInlineMath: true,
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: `prose focus:outline-none max-w-full p-8 min-h-[${minHeight}] dark:prose-invert leading-normal text-black dark:text-gray-100 font-[Arial] text-[11pt] prose-p:text-[11pt] prose-h1:text-[24pt] prose-h2:text-[18pt] prose-h3:text-[14pt] prose-p:my-[0.5em] prose-headings:mt-[1em] prose-headings:mb-[0.5em] prose-li:my-0 prose-ul:my-[0.5em] prose-ol:my-[0.5em] prose-img:my-0 placeholder:text-gray-300 dark:placeholder:text-gray-700`,
      },
    },
    onSelectionUpdate: ({ editor }) => {
      // Update current font size based on selection
      let fontSize = editor.getAttributes("textStyle").fontSize;

      if (!fontSize) {
        // Fallback to node defaults if no explicit font size mark is set
        if (editor.isActive("heading", { level: 1 })) fontSize = "24pt";
        else if (editor.isActive("heading", { level: 2 })) fontSize = "18pt";
        else if (editor.isActive("heading", { level: 3 })) fontSize = "14pt";
        else fontSize = "11pt"; // Paragraph default
      }

      setCurrentFontSize(fontSize);

      // Update current line height
      const lineHeight =
        editor.getAttributes("paragraph").lineHeight ||
        editor.getAttributes("heading").lineHeight ||
        "1.15";
      setCurrentLineHeight(lineHeight);
    },
  });

  // Sync content from props to editor when it changes from outside
  React.useEffect(() => {
    if (!editor) return;

    const currentHtml = editor.getHTML();
    if (content !== currentHtml) {
      // We use a small delay or check to ensure we aren't interrupting a user typing
      // But in our Modal flow, 'content' usually only changes when we first open or reset.
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [editor, content]);

  const addImage = useCallback(() => {
    const url = window.prompt("Enter image URL");
    if (url) {
      editor?.chain().focus().insertContent(`<img src="${url}" />`).run();
    }
  }, [editor]);

  const setLink = useCallback(() => {
    const previousUrl = editor?.getAttributes("link").href;
    const url = window.prompt("Enter URL", previousUrl);

    if (url === null) return;
    if (url === "") {
      editor?.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    editor
      ?.chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url })
      .run();
  }, [editor]);

  if (!editor) {
    return null;
  }

  const fontSizes = [
    "8pt",
    "9pt",
    "10pt",
    "11pt",
    "12pt",
    "14pt",
    "18pt",
    "24pt",
    "30pt",
    "36pt",
    "48pt",
    "60pt",
    "72pt",
    "96pt",
  ];

  const MenuButton = ({
    onClick,
    isActive = false,
    children,
    title,
    disabled = false,
    className = "",
  }: {
    onClick: () => void;
    isActive?: boolean;
    children: React.ReactNode;
    title: string;
    disabled?: boolean;
    className?: string;
  }) => (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
      title={title}
      disabled={disabled}
      className={`p-1.5 rounded transition-all duration-150 flex items-center justify-center
        ${
          isActive
            ? "bg-blue-100/80 text-blue-700 dark:bg-blue-500/30 dark:text-blue-300 shadow-sm"
            : "text-gray-600 dark:text-gray-300 hover:bg-gray-200/80 dark:hover:bg-gray-700/80 hover:text-gray-900 dark:hover:text-white"
        } ${disabled ? "opacity-30 cursor-not-allowed" : ""} ${className}`}
    >
      {children}
    </button>
  );

  return (
    <>
      <div
        className={`flex flex-col border border-gray-200 dark:border-gray-800 rounded-none overflow-hidden bg-gray-50 dark:bg-gray-950 transition-all duration-500 shadow-2xl text-black dark:text-white ${isExpanded ? "fixed left-0 top-0 bottom-0 right-0 inset-4 z-[100]" : "h-full"}`}
        style={
          {
            "--editor-font-size": currentFontSize,
            "--editor-line-height": currentLineHeight,
          } as React.CSSProperties
        }
      >
        {/* Enhanced Toolbar */}
        <div className="bg-white/80 dark:bg-gray-950/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 p-1.5 flex flex-wrap gap-0.5 items-center sticky top-0 z-50">
          {/* History Group */}
          <div className="flex items-center gap-0.5 px-1 border-r border-gray-200 dark:border-gray-800">
            <MenuButton
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().undo()}
              title="Undo (Cmd+Z)"
            >
              <Undo className="w-4 h-4" />
            </MenuButton>
            <MenuButton
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().redo()}
              title="Redo (Cmd+Y)"
            >
              <Redo className="w-4 h-4" />
            </MenuButton>
          </div>

          {/* Text Style Group */}
          <div className="flex items-center gap-0.5 px-1 border-r border-gray-200 dark:border-gray-800">
            <div className="relative group mx-1 flex items-center">
              <select
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "0") {
                    editor.chain().focus().setParagraph().run();
                  } else {
                    editor
                      .chain()
                      .focus()
                      .toggleHeading({ level: parseInt(val) as any })
                      .run();
                  }
                }}
                value={
                  editor.isActive("heading", { level: 1 })
                    ? "1"
                    : editor.isActive("heading", { level: 2 })
                      ? "2"
                      : editor.isActive("heading", { level: 3 })
                        ? "3"
                        : "0"
                }
                className="bg-transparent text-[13px] font-medium text-gray-700 dark:text-gray-200 outline-none cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 px-2 py-1.5 rounded appearance-none w-28"
              >
                <option value="0">Normal text</option>
                <option value="1">Heading 1</option>
                <option value="2">Heading 2</option>
                <option value="3">Heading 3</option>
              </select>
            </div>

            <div className="w-px h-5 bg-gray-300 dark:bg-gray-700 mx-1" />

            {/* Font Size Dropdown */}
            <div className="flex items-center mx-1">
              <select
                onChange={(e) =>
                  (editor.chain().focus() as any)
                    .setFontSize(e.target.value)
                    .run()
                }
                value={currentFontSize}
                className="bg-transparent text-[13px] font-medium text-gray-700 dark:text-gray-200 outline-none cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 px-2 py-1.5 rounded appearance-none w-14 text-center"
              >
                {fontSizes.map((size) => (
                  <option key={size} value={size}>
                    {size.replace("pt", "")}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-px h-5 bg-gray-300 dark:bg-gray-700 mx-1" />

            {/* Line Height Dropdown */}
            <div className="flex items-center mx-1">
              <select
                onChange={(e) =>
                  (editor.chain().focus() as any)
                    .setLineHeight(e.target.value)
                    .run()
                }
                value={currentLineHeight}
                className="bg-transparent text-[13px] font-medium text-gray-700 dark:text-gray-200 outline-none cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 px-2 py-1.5 rounded appearance-none w-28"
              >
                <option value="1">Single</option>
                <option value="1.15">1.15</option>
                <option value="1.5">1.5</option>
                <option value="2">Double</option>
              </select>
            </div>
          </div>

          {/* Formatting Group */}
          <div className="flex items-center gap-0.5 px-1 border-r border-gray-200 dark:border-gray-800">
            <MenuButton
              onClick={() => editor.chain().focus().toggleBold().run()}
              isActive={editor.isActive("bold")}
              title="Bold (Cmd+B)"
            >
              <Bold className="w-4 h-4" />
            </MenuButton>
            <MenuButton
              onClick={() => editor.chain().focus().toggleItalic().run()}
              isActive={editor.isActive("italic")}
              title="Italic (Cmd+I)"
            >
              <Italic className="w-4 h-4" />
            </MenuButton>
            <MenuButton
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              isActive={editor.isActive("underline")}
              title="Underline (Cmd+U)"
            >
              <UnderlineIcon className="w-4 h-4" />
            </MenuButton>
            <MenuButton
              onClick={() => editor.chain().focus().toggleStrike().run()}
              isActive={editor.isActive("strike")}
              title="Strikethrough"
            >
              <Strikethrough className="w-4 h-4" />
            </MenuButton>
          </div>

          {/* Decoration Group */}
          <div className="flex items-center gap-0.5 px-1 border-r border-gray-200 dark:border-gray-800">
            <label
              className="cursor-pointer p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="Text Color"
            >
              <Baseline className="w-4 h-4 text-gray-500" />
              <input
                type="color"
                onInput={(e) =>
                  editor
                    .chain()
                    .focus()
                    .setColor((e.target as HTMLInputElement).value)
                    .run()
                }
                className="sr-only"
              />
            </label>
            <label
              className="cursor-pointer p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="Highlight"
            >
              <Highlighter className="w-4 h-4 text-gray-500" />
              <input
                type="color"
                onInput={(e) =>
                  editor
                    .chain()
                    .focus()
                    .toggleHighlight({
                      color: (e.target as HTMLInputElement).value,
                    })
                    .run()
                }
                className="sr-only"
              />
            </label>
            <MenuButton
              onClick={() => editor.chain().focus().unsetAllMarks().run()}
              title="Clear Formatting"
            >
              <Eraser className="w-4 h-4" />
            </MenuButton>
          </div>

          {/* Alignment & Lists */}
          <div className="flex items-center gap-0.5 px-1 border-r border-gray-200 dark:border-gray-800">
            <MenuButton
              onClick={() => editor.chain().focus().setTextAlign("left").run()}
              isActive={editor.isActive({ textAlign: "left" })}
              title="Align Left"
            >
              <AlignLeft className="w-4 h-4" />
            </MenuButton>
            <MenuButton
              onClick={() =>
                editor.chain().focus().setTextAlign("center").run()
              }
              isActive={editor.isActive({ textAlign: "center" })}
              title="Align Center"
            >
              <AlignCenter className="w-4 h-4" />
            </MenuButton>
            <MenuButton
              onClick={() => editor.chain().focus().setTextAlign("right").run()}
              isActive={editor.isActive({ textAlign: "right" })}
              title="Align Right"
            >
              <AlignRight className="w-4 h-4" />
            </MenuButton>
            <MenuButton
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              isActive={editor.isActive("bulletList")}
              title="Bullet List"
            >
              <List className="w-4 h-4" />
            </MenuButton>
            <MenuButton
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              isActive={editor.isActive("orderedList")}
              title="Numbered List"
            >
              <ListOrdered className="w-4 h-4" />
            </MenuButton>
            <MenuButton
              onClick={() => editor.chain().focus().toggleTaskList().run()}
              isActive={editor.isActive("taskList")}
              title="Task List"
            >
              <CheckSquare className="w-4 h-4" />
            </MenuButton>
          </div>

          {/* Insert & Advanced */}
          <div className="flex items-center gap-0.5 px-1">
            <MenuButton
              onClick={setLink}
              isActive={editor.isActive("link")}
              title="Link"
            >
              <LinkIcon className="w-4 h-4" />
            </MenuButton>
            <MenuButton onClick={addImage} title="Image">
              <ImageIcon className="w-4 h-4" />
            </MenuButton>

            {/* Table Tools */}
            <MenuButton
              onClick={() =>
                editor
                  .chain()
                  .focus()
                  .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                  .run()
              }
              title="Insert Table"
            >
              <TableIcon className="w-4 h-4" />
            </MenuButton>

            <MenuButton
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              isActive={editor.isActive("blockquote")}
              title="Quote"
            >
              <Quote className="w-4 h-4" />
            </MenuButton>

            <MenuButton
              onClick={() => editor.chain().focus().toggleCodeBlock().run()}
              isActive={editor.isActive("codeBlock")}
              title="Code Block"
            >
              <Code2 className="w-4 h-4" />
            </MenuButton>
            <MenuButton
              onClick={() => editor.chain().focus().toggleSubscript().run()}
              isActive={editor.isActive("subscript")}
              title="Subscript"
            >
              <SubscriptIcon className="w-4 h-4" />
            </MenuButton>
            <MenuButton
              onClick={() => editor.chain().focus().toggleSuperscript().run()}
              isActive={editor.isActive("superscript")}
              title="Superscript"
            >
              <SuperscriptIcon className="w-4 h-4" />
            </MenuButton>
            <div className="w-px h-6 bg-gray-200 dark:bg-gray-800 mx-1" />
            <MenuButton
              onClick={() => setShowMathModal(true)}
              isActive={editor.isActive("inlineMath")}
              title="Insert Math Formula (visual editor)"
              className="text-purple-600 dark:text-purple-400"
            >
              <Sigma className="w-4 h-4" />
            </MenuButton>
          </div>

          <div className="ml-auto flex items-center gap-2 pr-2">
            <MenuButton
              onClick={() => setIsExpanded(!isExpanded)}
              title={isExpanded ? "Collapse" : "Full Screen"}
            >
              <Maximize2
                className={`w-4 h-4 ${isExpanded ? "rotate-45" : ""}`}
              />
            </MenuButton>
          </div>
        </div>

        {/* Main Document Content */}
        <div className="flex-1 overflow-y-auto scrollbar-hide py-8 px-4 sm:px-12 flex flex-col items-center bg-gray-100/50 dark:bg-gray-950/20 relative">
          <div className="w-full flex-1 relative flex max-w-[1200px]">
            {/* Main Editing Area */}
            <div
              className={`flex-1 transition-all duration-300 ${
                editor?.isActive("table") || editor?.isActive("image")
                  ? "mr-[280px]" // Reserve space for sidebar
                  : ""
              }`}
            >
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-gray-950 shadow-xl min-h-[1100px] rounded-sm relative ring-1 ring-gray-200/50 dark:ring-gray-700/50 p-[0.3in] mx-auto max-w-[850px] w-full"
              >
                <EditorContent editor={editor} />
              </motion.div>
            </div>

            {/* Contextual Right Sidebar */}
            {(editor?.isActive("table") || editor?.isActive("image")) && (
              <div className="w-[280px] fixed right-4 top-24 bottom-24 bg-white/95 dark:bg-gray-950/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-y-auto animate-in slide-in-from-right-8 duration-300 z-[90]">
                {editor.isActive("table") && (
                  <div className="p-5 flex flex-col gap-6">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
                        <TableIcon className="w-4 h-4" /> Table Properties
                      </h3>

                      <div className="grid grid-cols-2 gap-2 mb-4">
                        <button
                          onClick={() =>
                            editor.chain().focus().addColumnBefore().run()
                          }
                          className="flex flex-col items-center justify-center p-3 rounded-xl bg-gray-50 hover:bg-white dark:bg-gray-800/50 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 transition duration-200"
                        >
                          <BetweenVerticalEnd className="w-5 h-5 mb-1 rotate-180 text-blue-500" />
                          <span className="text-[10px] font-medium text-gray-600 dark:text-gray-300">
                            Add Col Before
                          </span>
                        </button>
                        <button
                          onClick={() =>
                            editor.chain().focus().addColumnAfter().run()
                          }
                          className="flex flex-col items-center justify-center p-3 rounded-xl bg-gray-50 hover:bg-white dark:bg-gray-800/50 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 transition duration-200"
                        >
                          <BetweenVerticalEnd className="w-5 h-5 mb-1 text-blue-500" />
                          <span className="text-[10px] font-medium text-gray-600 dark:text-gray-300">
                            Add Col After
                          </span>
                        </button>
                        <button
                          onClick={() =>
                            editor.chain().focus().addRowBefore().run()
                          }
                          className="flex flex-col items-center justify-center p-3 rounded-xl bg-gray-50 hover:bg-white dark:bg-gray-800/50 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 transition duration-200"
                        >
                          <BetweenHorizontalEnd className="w-5 h-5 mb-1 rotate-180 text-blue-500" />
                          <span className="text-[10px] font-medium text-gray-600 dark:text-gray-300">
                            Add Row Before
                          </span>
                        </button>
                        <button
                          onClick={() =>
                            editor.chain().focus().addRowAfter().run()
                          }
                          className="flex flex-col items-center justify-center p-3 rounded-xl bg-gray-50 hover:bg-white dark:bg-gray-800/50 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 transition duration-200"
                        >
                          <BetweenHorizontalEnd className="w-5 h-5 mb-1 text-blue-500" />
                          <span className="text-[10px] font-medium text-gray-600 dark:text-gray-300">
                            Add Row After
                          </span>
                        </button>
                      </div>

                      <div className="space-y-2">
                        <button
                          onClick={() =>
                            editor.chain().focus().mergeCells().run()
                          }
                          className="w-full flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-white dark:bg-gray-800/50 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 transition duration-200 text-sm font-medium text-gray-700 dark:text-gray-200"
                        >
                          <TableCellsMerge className="w-4 h-4 text-purple-500" />{" "}
                          Merge Highlighted Cells
                        </button>
                        <button
                          onClick={() =>
                            editor.chain().focus().splitCell().run()
                          }
                          className="w-full flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-white dark:bg-gray-800/50 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 transition duration-200 text-sm font-medium text-gray-700 dark:text-gray-200"
                        >
                          <TableCellsSplit className="w-4 h-4 text-purple-500" />{" "}
                          Split Cell
                        </button>
                      </div>
                    </div>

                    <hr className="border-gray-200 dark:border-gray-800" />

                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3">
                        Styling
                      </h4>
                      <label className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-white dark:bg-gray-800/50 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 cursor-pointer transition relative group">
                        <Palette className="w-4 h-4 text-orange-500" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                          Cell Background Color
                        </span>
                        <input
                          type="color"
                          onInput={(e) =>
                            (editor.chain().focus() as any)
                              .setTableCellAttribute(
                                "backgroundColor",
                                (e.target as HTMLInputElement).value,
                              )
                              .run()
                          }
                          className="absolute opacity-0 w-8 h-8 right-2 top-2 cursor-pointer"
                        />
                        <div className="ml-auto w-6 h-6 rounded-full border border-gray-300 dark:border-gray-600 shadow-inner group-hover:scale-110 transition bg-white"></div>
                      </label>
                    </div>

                    <hr className="border-gray-200 dark:border-gray-800" />

                    <div>
                      <h4 className="text-xs font-semibold text-red-500/80 mb-3">
                        Danger Zone
                      </h4>
                      <div className="space-y-2">
                        <button
                          onClick={() =>
                            editor.chain().focus().deleteRow().run()
                          }
                          className="w-full flex items-center gap-3 p-3 rounded-xl bg-red-50/50 hover:bg-red-50 dark:bg-red-900/10 dark:hover:bg-red-900/20 border border-red-100 dark:border-red-900/30 transition text-sm font-medium text-red-600 dark:text-red-400"
                        >
                          <Baseline className="w-4 h-4 rotate-90" /> Delete Row
                        </button>
                        <button
                          onClick={() =>
                            editor.chain().focus().deleteColumn().run()
                          }
                          className="w-full flex items-center gap-3 p-3 rounded-xl bg-red-50/50 hover:bg-red-50 dark:bg-red-900/10 dark:hover:bg-red-900/20 border border-red-100 dark:border-red-900/30 transition text-sm font-medium text-red-600 dark:text-red-400"
                        >
                          <ColumnsIcon className="w-4 h-4" /> Delete Column
                        </button>
                        <button
                          onClick={() =>
                            editor.chain().focus().deleteTable().run()
                          }
                          className="w-full flex items-center justify-center gap-2 p-3 mt-4 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold transition shadow-lg shadow-red-500/20"
                        >
                          <Trash2 className="w-4 h-4" /> Delete Entire Table
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {editor.isActive("image") && (
                  <div className="p-5 flex flex-col gap-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-2">
                      <ImageIcon className="w-4 h-4" /> Image Properties
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl border border-blue-100 dark:border-blue-800">
                      Select an image in your document. You can drag the green
                      handles on the corners of the image to resize it freely.
                    </p>
                    <button
                      onClick={() => {
                        const url = window.prompt(
                          "Enter new image URL to replace",
                        );
                        if (url) {
                          editor
                            ?.chain()
                            .focus()
                            .insertContent(`<img src="${url}" />`)
                            .run();
                        }
                      }}
                      className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-gray-50 hover:bg-white dark:bg-gray-800/50 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 transition duration-200 text-sm font-medium text-gray-700 dark:text-gray-200"
                    >
                      <Edit3 className="w-4 h-4" /> Replace Image
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Status Bar */}
        <div className="bg-white/80 dark:bg-gray-950/80 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 px-6 py-1.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-tight text-gray-400 dark:text-gray-500">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-1.5">
              <div
                className={`w-2 h-2 rounded-full ${editor.isFocused ? "bg-green-500 animate-pulse" : "bg-gray-300"}`}
              />
              <span>{editor.isFocused ? "Editing" : "Saved"}</span>
            </div>
            <div className="flex items-center gap-4">
              <span>
                Characters: {editor.storage.characterCount.characters()}
              </span>
              <span>Words: {editor.storage.characterCount.words()}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span>v3.1 Patch</span>
            <div className="w-px h-3 bg-gray-200 dark:bg-gray-800" />
            <button className="hover:text-blue-500 transition-colors">
              Keyboard Shortcuts
            </button>
          </div>
        </div>
      </div>

      {/* Visual Math Formula Modal */}
      <MathFormulaModal
        isOpen={showMathModal}
        onClose={() => setShowMathModal(false)}
        onInsert={(latex) => {
          editor
            .chain()
            .focus()
            .insertContent({
              type: "inlineMath",
              attrs: { latex: latex, evaluate: "no", display: "no" },
            })
            .run();
        }}
      />
    </>
  );
};

export default RichTextEditor;
