import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Heading from "@tiptap/extension-heading";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { useState, useCallback, useRef, useEffect } from "react";
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
  Image as ImageIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Quote,
  Code2,
  Minus,
  Undo2,
  Redo2,
  Palette,
  Loader2,
  Code,
} from "lucide-react";

const extensions = [
  StarterKit,
  Underline,
  Link.configure({
    openOnClick: false,
    HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" },
  }),
  Heading.configure({ levels: [1, 2, 3] }),
  Image.configure({
    HTMLAttributes: { class: "rounded-lg max-w-full h-auto my-4" },
  }),
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  TextStyle,
  Color,
];

const COLOR_PALETTE = [
  { name: "Default", value: "" },
  { name: "Purple", value: "#8B2FC9" },
  { name: "Pink", value: "#EC4899" },
  { name: "Red", value: "#EF4444" },
  { name: "Orange", value: "#F97316" },
  { name: "Yellow", value: "#EAB308" },
  { name: "Green", value: "#22C55E" },
  { name: "Blue", value: "#3B82F6" },
  { name: "Gray", value: "#9CA3AF" },
];

interface ToolbarButtonProps {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}

function ToolbarButton({ onClick, active, disabled, title, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onMouseDown={(e) => { e.preventDefault(); if (!disabled) onClick(); }}
      title={title}
      className={`p-1.5 rounded transition-colors text-sm ${
        disabled
          ? "text-white/20 cursor-not-allowed"
          : active
          ? "bg-primary text-white"
          : "text-white/60 hover:text-white hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}

// Clean HTML pasted from Word, Outlook, Google Docs, etc.
// Strips Microsoft Office cruft and Google Docs' fake-bold wrapper while
// preserving structural markup and useful inline styles (color, alignment).
function cleanPastedHtml(html: string): string {
  // Strip Microsoft Office conditional comments and XML namespaces.
  let cleaned = html
    .replace(/<!--\[if[\s\S]*?<!\[endif\]-->/g, "")
    .replace(/<\/?(?:o|w|m|v|st1):[^>]*>/g, "")
    .replace(/<!\[if[\s\S]*?\]>/g, "")
    .replace(/<!\[endif\]>/g, "");

  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(cleaned, "text/html");
  } catch {
    return cleaned;
  }

  // Google Docs wraps content in <b style="font-weight:normal">; unwrap it.
  doc.querySelectorAll('b[style*="font-weight:normal"], b[style*="font-weight: normal"]').forEach((el) => {
    const parent = el.parentNode;
    if (!parent) return;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    el.remove();
  });

  const ALLOWED_STYLE_PROPS = ["color", "background-color", "text-align", "font-weight", "font-style", "text-decoration"];

  doc.querySelectorAll("*").forEach((el) => {
    el.removeAttribute("class");
    el.removeAttribute("id");
    el.removeAttribute("lang");
    el.removeAttribute("dir");

    const style = el.getAttribute("style");
    if (style) {
      const filtered = style
        .split(";")
        .map((s) => s.trim())
        .filter((s) => {
          if (!s) return false;
          const prop = s.split(":")[0]?.trim().toLowerCase();
          return prop && ALLOWED_STYLE_PROPS.includes(prop) && !s.toLowerCase().includes("mso-");
        })
        .join("; ");
      if (filtered) el.setAttribute("style", filtered);
      else el.removeAttribute("style");
    }
  });

  // Unwrap empty spans (Google Docs / Word produce many).
  doc.querySelectorAll("span").forEach((el) => {
    if (el.attributes.length === 0) {
      const parent = el.parentNode;
      if (!parent) return;
      while (el.firstChild) parent.insertBefore(el.firstChild, el);
      el.remove();
    }
  });

  return doc.body.innerHTML;
}

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
}

export function RichTextEditor({ content, onChange }: RichTextEditorProps) {
  const [linkUrl, setLinkUrl] = useState("");
  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [showSource, setShowSource] = useState(false);
  const [sourceValue, setSourceValue] = useState(content);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      transformPastedHTML: cleanPastedHtml,
    },
  });

  useEffect(() => {
    if (showSource && editor) setSourceValue(editor.getHTML());
  }, [showSource, editor]);

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

  const handleImageUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !editor) return;
      setUploading(true);
      setUploadError("");
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
          credentials: "include",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Upload failed");
        editor.chain().focus().setImage({ src: data.url }).run();
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
        e.target.value = "";
      }
    },
    [editor]
  );

  const applySourceHtml = useCallback(() => {
    if (!editor) return;
    editor.commands.setContent(sourceValue, { emitUpdate: true });
    setShowSource(false);
  }, [editor, sourceValue]);

  if (!editor) return null;

  return (
    <div className="border border-white/10 rounded-xl overflow-hidden bg-black/40">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-3 py-2 border-b border-white/10 bg-white/[0.02]">
        {/* Inline marks */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold">
          <Bold className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic">
          <Italic className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Underline">
          <UnderlineIcon className="w-4 h-4" />
        </ToolbarButton>

        {/* Color */}
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" title="Text color" className="p-1.5 rounded text-white/60 hover:text-white hover:bg-white/10">
              <Palette className="w-4 h-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto bg-secondary border-white/10 p-2" align="start">
            <div className="grid grid-cols-9 gap-1">
              {COLOR_PALETTE.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  title={c.name}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (c.value) editor.chain().focus().setColor(c.value).run();
                    else editor.chain().focus().unsetColor().run();
                  }}
                  className="w-6 h-6 rounded border border-white/20 hover:scale-110 transition-transform"
                  style={{ background: c.value || "transparent" }}
                >
                  {!c.value && <span className="text-[10px] text-white/60">×</span>}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <div className="w-px h-5 bg-white/10 mx-1" />

        {/* Headings */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })} title="Heading 1">
          <Heading1 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="Heading 2">
          <Heading2 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="Heading 3">
          <Heading3 className="w-4 h-4" />
        </ToolbarButton>

        {/* Block types */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="Quote">
          <Quote className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive("codeBlock")} title="Code block">
          <Code2 className="w-4 h-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-white/10 mx-1" />

        {/* Lists */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Bullet list">
          <List className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Numbered list">
          <ListOrdered className="w-4 h-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-white/10 mx-1" />

        {/* Alignment */}
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })} title="Align left">
          <AlignLeft className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })} title="Align center">
          <AlignCenter className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("right").run()} active={editor.isActive({ textAlign: "right" })} title="Align right">
          <AlignRight className="w-4 h-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-white/10 mx-1" />

        {/* Insert: Link */}
        <Popover open={linkPopoverOpen} onOpenChange={setLinkPopoverOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              title="Insert link"
              className={`p-1.5 rounded transition-colors text-sm ${
                editor.isActive("link") ? "bg-primary text-white" : "text-white/60 hover:text-white hover:bg-white/10"
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

        {/* Insert: Image */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={handleImageUpload}
        />
        <ToolbarButton onClick={() => fileInputRef.current?.click()} disabled={uploading} title={uploading ? "Uploading…" : "Insert image"}>
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
        </ToolbarButton>

        {/* Insert: Horizontal rule */}
        <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal rule">
          <Minus className="w-4 h-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-white/10 mx-1" />

        {/* Utilities */}
        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo">
          <Undo2 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo">
          <Redo2 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()} title="Clear formatting">
          <RemoveFormatting className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => setShowSource((v) => !v)} active={showSource} title="View / edit HTML source">
          <Code className="w-4 h-4" />
        </ToolbarButton>
      </div>

      {uploadError && (
        <div className="px-3 py-1.5 bg-red-500/10 border-b border-red-500/20 text-xs text-red-400">
          {uploadError}
        </div>
      )}

      {/* Editor or HTML source */}
      {showSource ? (
        <div className="p-3 space-y-2">
          <textarea
            value={sourceValue}
            onChange={(e) => setSourceValue(e.target.value)}
            className="w-full min-h-[300px] bg-black/40 border border-white/10 rounded-lg p-3 text-white/90 font-mono text-xs leading-relaxed outline-none focus:border-primary/50"
            spellCheck={false}
          />
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" size="sm" onClick={() => setShowSource(false)} className="border-white/20 text-white/70 text-xs h-8">
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={applySourceHtml} className="bg-primary hover:bg-primary/90 text-xs h-8">
              Apply HTML
            </Button>
          </div>
        </div>
      ) : (
        <EditorContent editor={editor} />
      )}
    </div>
  );
}

interface RichTextViewerProps {
  content: string;
}

export function RichTextViewer({ content }: RichTextViewerProps) {
  return (
    <div
      className="prose prose-invert prose-lg max-w-none prose-a:text-primary prose-headings:text-white prose-headings:font-bold prose-img:rounded-lg"
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}
