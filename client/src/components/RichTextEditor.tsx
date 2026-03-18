import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Heading from "@tiptap/extension-heading";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Bold,
  Italic,
  UnderlineIcon,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Link2,
  RemoveFormatting,
} from "lucide-react";

const extensions = [
  StarterKit,
  Underline,
  Link.configure({
    openOnClick: false,
    HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" },
  }),
  Heading.configure({ levels: [1, 2, 3] }),
];

interface ToolbarButtonProps {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}

function ToolbarButton({ onClick, active, title, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      className={`p-1.5 rounded transition-colors text-sm ${
        active
          ? "bg-primary text-white"
          : "text-white/60 hover:text-white hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
}

export function RichTextEditor({ content, onChange }: RichTextEditorProps) {
  const [linkUrl, setLinkUrl] = useState("");
  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);

  const editor = useEditor({
    extensions,
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "prose-editor outline-none min-h-[300px] p-4 text-white/90 leading-relaxed",
      },
    },
  });

  const applyLink = useCallback(() => {
    if (!editor) return;
    if (!linkUrl.trim()) {
      editor.chain().focus().unsetLink().run();
    } else {
      editor.chain().focus().setLink({ href: linkUrl }).run();
    }
    setLinkUrl("");
    setLinkPopoverOpen(false);
  }, [editor, linkUrl]);

  if (!editor) return null;

  return (
    <div className="border border-white/10 rounded-xl overflow-hidden bg-black/40">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-3 py-2 border-b border-white/10 bg-white/[0.02]">
        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold">
          <Bold className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic">
          <Italic className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Underline">
          <UnderlineIcon className="w-4 h-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-white/10 mx-1" />

        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })} title="Heading 1">
          <Heading1 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="Heading 2">
          <Heading2 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="Heading 3">
          <Heading3 className="w-4 h-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-white/10 mx-1" />

        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Bullet List">
          <List className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Ordered List">
          <ListOrdered className="w-4 h-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-white/10 mx-1" />

        <Popover open={linkPopoverOpen} onOpenChange={setLinkPopoverOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              title="Insert Link"
              className={`p-1.5 rounded transition-colors text-sm ${
                editor.isActive("link")
                  ? "bg-primary text-white"
                  : "text-white/60 hover:text-white hover:bg-white/10"
              }`}
            >
              <Link2 className="w-4 h-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80 bg-secondary border-white/10 p-3" align="start">
            <p className="text-xs text-muted-foreground mb-2">Enter URL</p>
            <div className="flex gap-2">
              <Input
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://..."
                className="bg-black/40 border-white/10 h-9 text-sm"
                onKeyDown={(e) => e.key === "Enter" && applyLink()}
                autoFocus
              />
              <Button size="sm" onClick={applyLink} className="bg-primary hover:bg-primary/90 text-xs px-3">
                Apply
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        <ToolbarButton onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()} title="Clear Formatting">
          <RemoveFormatting className="w-4 h-4" />
        </ToolbarButton>
      </div>

      {/* Editor */}
      <EditorContent editor={editor} />
    </div>
  );
}

interface RichTextViewerProps {
  content: string;
}

export function RichTextViewer({ content }: RichTextViewerProps) {
  return (
    <div
      className="prose prose-invert prose-lg max-w-none prose-a:text-primary prose-headings:text-white prose-headings:font-bold"
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}
