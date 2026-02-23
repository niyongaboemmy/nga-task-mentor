import React, { useCallback, useState } from "react";
import { useEditor, EditorContent, Extension } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
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
import { Strike } from "@tiptap/extension-strike";
import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";
import { motion } from "framer-motion";
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
} from "lucide-react";

// Custom Font Size Extension
const FontSize = Extension.create({
  name: "fontSize",
  addOptions() {
    return {
      types: ["textStyle", "listItem"],
    };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) =>
              element.style.fontSize?.replace(/['\"]+/g, ""),
            renderHTML: (attributes) => {
              if (!attributes.fontSize) {
                return {};
              }
              return {
                style: `font-size: ${attributes.fontSize}`,
              };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize:
        (fontSize: string) =>
        ({ chain, state, commands }) => {
          // Apply to textStyle mark
          const markCommand = chain().setMark("textStyle", { fontSize });

          // Also apply to listItem nodes if we're in a list
          const { $from } = state.selection;
          let listItemDepth = -1;

          for (let i = $from.depth; i > 0; i--) {
            if ($from.node(i).type.name === "listItem") {
              listItemDepth = i;
              break;
            }
          }

          if (listItemDepth > -1) {
            // We're in a list, update the listItem node
            return (
              commands.updateAttributes("listItem", { fontSize }) &&
              markCommand.run()
            );
          }

          return markCommand.run();
        },
      unsetFontSize:
        () =>
        ({ chain, commands }) => {
          return (
            chain()
              .setMark("textStyle", { fontSize: null })
              .removeEmptyTextStyle()
              .run() &&
            commands.updateAttributes("listItem", { fontSize: null })
          );
        },
    };
  },
});

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
  const [currentFontSize, setCurrentFontSize] = useState("14px");
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
      Image.configure({
        allowBase64: true,
        HTMLAttributes: {
          class:
            "rounded-lg border border-gray-200 dark:border-gray-800 shadow-lg max-w-full my-4 mx-auto block transition-all duration-300",
        },
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class:
            "border-collapse table-fixed w-full my-6 bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-sm",
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
            "rounded-lg p-4 bg-gray-900 text-gray-100 font-mono text-sm my-4",
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
        class: `prose prose-sm sm:prose lg:prose-lg xl:prose-xl focus:outline-none max-w-full p-5 min-h-[${minHeight}] dark:prose-invert leading-[1.1] text-[14px] dark:text-white`,
      },
    },
    onSelectionUpdate: ({ editor }) => {
      // Update current font size based on selection
      const fontSize = editor.getAttributes("textStyle").fontSize || "14px";
      setCurrentFontSize(fontSize);

      // Update current line height
      const lineHeight =
        editor.getAttributes("paragraph").lineHeight ||
        editor.getAttributes("heading").lineHeight ||
        "1.15";
      setCurrentLineHeight(lineHeight);
    },
  });

  // Sync content from props to editor
  React.useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  const addImage = useCallback(() => {
    const url = window.prompt("Enter image URL");
    if (url) {
      editor?.chain().focus().setImage({ src: url, alt: "image" }).run();
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
    "12px",
    "14px",
    "16px",
    "18px",
    "20px",
    "24px",
    "32px",
    "48px",
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
      className={`p-1.5 rounded-md transition-all duration-200 flex items-center justify-center
        ${
          isActive
            ? "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 shadow-sm"
            : "text-gray-500 dark:text-gray-400 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-white"
        } ${disabled ? "opacity-30 cursor-not-allowed" : ""} ${className}`}
    >
      {children}
    </button>
  );

  return (
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
      <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 p-1.5 flex flex-wrap gap-0.5 items-center sticky top-0 z-50">
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
          <div className="relative group mx-1">
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
              className="bg-transparent text-[11px] font-bold text-gray-700 dark:text-gray-300 outline-none cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 px-2 py-1 rounded"
            >
              <option value="0">Normal Text</option>
              <option value="1">Heading 1</option>
              <option value="2">Heading 2</option>
              <option value="3">Heading 3</option>
            </select>
          </div>

          <div className="w-px h-6 bg-gray-200 dark:bg-gray-800 mx-1" />

          {/* Font Size Dropdown */}
          <select
            onChange={(e) =>
              (editor.chain().focus() as any).setFontSize(e.target.value).run()
            }
            value={currentFontSize}
            className="bg-transparent text-[11px] font-bold text-gray-700 dark:text-gray-300 outline-none cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 px-2 py-1 rounded"
          >
            <option value="">Size</option>
            {fontSizes.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>

          <div className="w-px h-6 bg-gray-200 dark:bg-gray-800 mx-1" />

          {/* Line Height Dropdown */}
          <select
            onChange={(e) =>
              (editor.chain().focus() as any)
                .setLineHeight(e.target.value)
                .run()
            }
            value={currentLineHeight}
            className="bg-transparent text-[11px] font-bold text-gray-700 dark:text-gray-300 outline-none cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 px-2 py-1 rounded"
          >
            <option value="">Line Height</option>
            <option value="1">Single</option>
            <option value="1.15">1.15</option>
            <option value="1.5">1.5</option>
            <option value="2">Double</option>
          </select>
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
          <div className="relative">
            <MenuButton
              onClick={() => setShowTableMenu(!showTableMenu)}
              isActive={editor.isActive("table") || showTableMenu}
              title="Table Controls"
            >
              <TableIcon className="w-4 h-4" />
            </MenuButton>

            {showTableMenu && (
              <div className="absolute top-10 left-0 bg-white dark:bg-gray-800 shadow-2xl rounded-xl border border-gray-200 dark:border-gray-700 p-2 grid grid-cols-4 gap-1 z-[100] min-w-[180px]">
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
                  <TableIcon className="w-4 h-4 text-blue-500" />
                </MenuButton>
                <MenuButton
                  onClick={() => editor.chain().focus().addColumnAfter().run()}
                  title="Add Col After"
                  disabled={!editor.isActive("table")}
                >
                  <BetweenVerticalEnd className="w-4 h-4 text-green-500" />
                </MenuButton>
                <MenuButton
                  onClick={() => editor.chain().focus().addRowAfter().run()}
                  title="Add Row After"
                  disabled={!editor.isActive("table")}
                >
                  <BetweenHorizontalEnd className="w-4 h-4 text-green-500" />
                </MenuButton>
                <MenuButton
                  onClick={() => editor.chain().focus().deleteTable().run()}
                  title="Delete Table"
                  disabled={!editor.isActive("table")}
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </MenuButton>
                <MenuButton
                  onClick={() => editor.chain().focus().mergeCells().run()}
                  title="Merge Cells"
                  disabled={!editor.isActive("table")}
                >
                  <TableCellsMerge className="w-4 h-4" />
                </MenuButton>
                <MenuButton
                  onClick={() => editor.chain().focus().splitCell().run()}
                  title="Split Cells"
                  disabled={!editor.isActive("table")}
                >
                  <TableCellsSplit className="w-4 h-4" />
                </MenuButton>
                <label
                  className="cursor-pointer p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center justify-center"
                  title="Cell Background"
                >
                  <Palette className="w-4 h-4 text-purple-500" />
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
                    className="sr-only"
                  />
                </label>
                <MenuButton
                  onClick={() => editor.chain().focus().deleteColumn().run()}
                  title="Delete Col"
                  disabled={!editor.isActive("table")}
                >
                  <ColumnsIcon className="w-4 h-4 text-red-400" />
                </MenuButton>
              </div>
            )}
          </div>

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
        </div>

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
      <div className="flex-1 overflow-y-auto scrollbar-hide py-8 px-4 sm:px-12 flex justify-center bg-gray-100/50 dark:bg-gray-900/20">
        <div className="w-full max-w-[850px]">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-900 shadow-xl min-h-[1100px] rounded-sm relative ring-1 ring-gray-200/50 dark:ring-gray-700/50 p-[0.3in]"
          >
            {/* Bubble Menu */}
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

            <EditorContent editor={editor} />
          </motion.div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 px-6 py-1.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-tight text-gray-400 dark:text-gray-500">
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
          <span>v3.0 Pro</span>
          <div className="w-px h-3 bg-gray-200 dark:bg-gray-800" />
          <button className="hover:text-blue-500 transition-colors">
            Keyboard Shortcuts
          </button>
        </div>
      </div>
    </div>
  );
};

export default RichTextEditor;
