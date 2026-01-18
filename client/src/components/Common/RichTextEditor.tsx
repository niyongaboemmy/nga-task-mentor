import React, { useCallback, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { BubbleMenu, FloatingMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import { Color } from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import { Underline } from "@tiptap/extension-underline";
import { Highlight } from "@tiptap/extension-highlight";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { Image } from "@tiptap/extension-image";
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
import { motion, AnimatePresence } from "framer-motion";
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
  Type,
  Baseline,
  Highlighter,
  ChevronDown,
  Trash2,
  Columns,
  Rows,
  Quote,
  Code2,
  Maximize2,
} from "lucide-react";

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  minHeight?: string;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  content,
  onChange,
  placeholder = "Start typing your document...",
  minHeight = "400px",
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        horizontalRule: false,
      }),
      Underline,
      TextStyle,
      Color,
      FontFamily,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class:
            "text-blue-600 dark:text-blue-400 underline decoration-blue-500/30 hover:decoration-blue-500 transition-all cursor-pointer",
        },
      }),
      Image.configure({
        allowBase64: true,
        HTMLAttributes: {
          class:
            "rounded-2xl border-4 border-white/10 shadow-2xl max-w-full my-8 mx-auto block hover:scale-[1.01] transition-transform duration-500",
        },
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class:
            "border-collapse table-fixed w-full my-6 bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm",
        },
      }),
      TableRow,
      TableHeader.configure({
        HTMLAttributes: {
          class: "bg-gray-50 dark:bg-gray-700/50 font-bold",
        },
      }),
      TableCell.configure({
        HTMLAttributes: {
          class: "border border-gray-200 dark:border-gray-700 p-3",
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
      Placeholder.configure({
        placeholder,
      }),
      CharacterCount,
      Typography,
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: `prose prose-sm sm:prose lg:prose-lg xl:prose-xl focus:outline-none max-w-full p-5 min-h-[${minHeight}] dark:prose-invert leading-relaxed`,
      },
    },
  });

  const addImage = useCallback(() => {
    const url = window.prompt("Enter image URL");
    if (url) {
      editor?.chain().focus().setImage({ src: url }).run();
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

  const MenuButton = ({
    onClick,
    isActive = false,
    children,
    title,
    disabled = false,
  }: {
    onClick: () => void;
    isActive?: boolean;
    children: React.ReactNode;
    title: string;
    disabled?: boolean;
  }) => (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
      title={title}
      disabled={disabled}
      className={`p-1.5 rounded-md transition-all duration-200 flex items-center justify-center
        ${
          isActive
            ? "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 shadow-sm"
            : "text-gray-500 dark:text-gray-400 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-white"
        } ${disabled ? "opacity-30 cursor-not-allowed" : ""}`}
    >
      {children}
    </button>
  );

  return (
    <div
      className={`flex flex-col border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden bg-gray-50 dark:bg-gray-950 transition-all duration-500 shadow-2xl ${isExpanded ? "fixed left-0 top-0 bottom-0 right-0 inset-4 z-[100]" : "h-full"}`}
    >
      {/* Google Docs Styled Toolbar */}
      <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 p-1.5 flex flex-wrap gap-0.5 items-center sticky top-0 z-50">
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

        <div className="w-px h-6 bg-gray-200 dark:bg-gray-800 mx-2" />

        {/* Font Family Dropdown */}
        <div className="relative group">
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
            <span>Inter</span>
            <ChevronDown className="w-3 h-3 opacity-50" />
          </button>
        </div>

        <div className="w-px h-6 bg-gray-200 dark:bg-gray-800 mx-2" />

        {/* Text Styles */}
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

        <div className="w-px h-6 bg-gray-200 dark:bg-gray-800 mx-2" />

        {/* Colors */}
        <div className="flex items-center gap-1 px-1">
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
        </div>

        <div className="w-px h-6 bg-gray-200 dark:bg-gray-800 mx-2" />

        {/* Alignment */}
        <MenuButton
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          isActive={editor.isActive({ textAlign: "left" })}
          title="Align Left"
        >
          <AlignLeft className="w-4 h-4" />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
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

        <div className="w-px h-6 bg-gray-200 dark:bg-gray-800 mx-2" />

        {/* Lists */}
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

        <div className="w-px h-6 bg-gray-200 dark:bg-gray-800 mx-2" />

        {/* Insert Elements */}
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

        {/* Table Management */}
        <div className="relative group">
          <MenuButton
            onClick={() =>
              editor
                .chain()
                .focus()
                .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                .run()
            }
            title="Table"
          >
            <TableIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </MenuButton>

          <AnimatePresence>
            {editor.isActive("table") && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute top-10 left-0 bg-white dark:bg-gray-800 shadow-2xl rounded-xl border border-gray-200 dark:border-gray-700 p-1.5 flex items-center gap-1 z-[100]"
              >
                <MenuButton
                  onClick={() => editor.chain().focus().addColumnBefore().run()}
                  title="Add Column Before"
                >
                  <Columns className="w-3 h-3 text-green-500" />
                </MenuButton>
                <MenuButton
                  onClick={() => editor.chain().focus().addRowBefore().run()}
                  title="Add Row Before"
                >
                  <Rows className="w-3 h-3 text-green-500" />
                </MenuButton>
                <div className="w-px h-4 bg-gray-200 mx-1" />
                <MenuButton
                  onClick={() => editor.chain().focus().deleteTable().run()}
                  title="Delete Table"
                >
                  <Trash2 className="w-3 h-3 text-red-500" />
                </MenuButton>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="w-px h-6 bg-gray-200 dark:bg-gray-800 mx-2" />

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

        <div className="ml-auto flex items-center gap-2 pr-2">
          <MenuButton
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? "Collapse" : "Full Screen"}
          >
            <Maximize2 className={`w-4 h-4 ${isExpanded ? "rotate-45" : ""}`} />
          </MenuButton>
        </div>
      </div>

      {/* Main Document Content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide py-12 px-4 sm:px-12 flex justify-center">
        <div className="w-full max-w-[850px]">
          {/* Document Shadow Container */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-900 shadow-[0_20px_50px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)] min-h-[1100px] rounded-sm relative ring-1 ring-gray-200/50 dark:ring-gray-700/50"
          >
            {/* Bubble Menu for quick formatting */}
            {editor && (
              <BubbleMenu editor={editor}>
                <div className="flex bg-gray-900/95 dark:bg-gray-800/95 backdrop-blur-md shadow-2xl rounded-xl border border-white/10 p-1.5 space-x-1 animate-in fade-in zoom-in-95 duration-300">
                  <MenuButton
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    isActive={editor.isActive("bold")}
                    title="Bold"
                  >
                    <Bold className="w-4 h-4 text-white" />
                  </MenuButton>
                  <MenuButton
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    isActive={editor.isActive("italic")}
                    title="Italic"
                  >
                    <Italic className="w-4 h-4 text-white" />
                  </MenuButton>
                  <div className="w-px h-4 bg-white/20 mx-1" />
                  <MenuButton
                    onClick={setLink}
                    isActive={editor.isActive("link")}
                    title="Link"
                  >
                    <LinkIcon className="w-4 h-4 text-white" />
                  </MenuButton>
                </div>
              </BubbleMenu>
            )}

            {/* Floating Menu for inserting blocks */}
            {editor && (
              <FloatingMenu editor={editor}>
                <div className="flex items-center gap-1 bg-white dark:bg-gray-800 shadow-xl rounded-full border border-gray-200 dark:border-gray-700 p-1 pl-3 translate-x-[-110%]">
                  <span className="text-[10px] uppercase tracking-widest font-black text-gray-400 mr-2">
                    Quick Insert
                  </span>
                  <MenuButton
                    onClick={() =>
                      editor.chain().focus().toggleHeading({ level: 1 }).run()
                    }
                    title="H1"
                  >
                    <Type className="w-4 h-4" />
                  </MenuButton>
                  <MenuButton
                    onClick={() =>
                      editor.chain().focus().toggleBulletList().run()
                    }
                    title="Bullet List"
                  >
                    <List className="w-4 h-4" />
                  </MenuButton>
                  <MenuButton onClick={addImage} title="Image">
                    <ImageIcon className="w-4 h-4" />
                  </MenuButton>
                </div>
              </FloatingMenu>
            )}

            <EditorContent editor={editor} />
          </motion.div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 px-6 py-2 flex items-center justify-between text-[10px] font-black uppercase tracking-tighter text-gray-400 dark:text-gray-500">
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
          <span>v2.1 Stable</span>
          <div className="w-px h-3 bg-gray-200 dark:bg-gray-800" />
          <button className="hover:text-blue-500 transition-colors">
            Help & Shortcuts
          </button>
        </div>
      </div>
    </div>
  );
};

export default RichTextEditor;
