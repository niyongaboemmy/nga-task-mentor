import React, { useEffect, useState } from "react";
import DocViewer, { DocViewerRenderers } from "@cyntler/react-doc-viewer";
import Modal from "../ui/Modal";
import { signedUploadUrl, uploadSubpath } from "../../utils/uploadUrls";

interface FilePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileUrl: string;
  fileName: string;
}

const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  isOpen,
  onClose,
  fileUrl,
  fileName,
}) => {
  // Our own stored files need a signed URL: iframes and the document viewer
  // can't send the session header (TM-8). Other URLs are used as they are.
  const needsSigning = !!uploadSubpath(fileUrl);
  const [signed, setSigned] = useState<{ from: string; url: string } | null>(null);
  useEffect(() => {
    if (!isOpen || !needsSigning) return;
    let live = true;
    signedUploadUrl(fileUrl).then((url) => live && setSigned({ from: fileUrl, url }));
    return () => {
      live = false;
    };
  }, [isOpen, needsSigning, fileUrl]);
  const ready = !needsSigning || signed?.from === fileUrl;
  const src = needsSigning ? (signed?.from === fileUrl ? signed.url : "") : fileUrl;
  const docs = [{ uri: src, fileName }];

  // List of extensions that DocViewer supports well
  const supportedExtensions = [
    "pdf",
    "doc",
    "docx",
    "xls",
    "xlsx",
    "ppt",
    "pptx",
    "jpg",
    "jpeg",
    "png",
    "bmp",
    "gif",
    "txt",
    "csv",
    "mp4",
    "webm",
  ];

  const extension = fileName.split(".").pop()?.toLowerCase() || "";
  const isSupported = supportedExtensions.includes(extension);

  useEffect(() => {
    if (isOpen && !isSupported && ready) {
      // Auto-download for unsupported types
      const link = document.createElement("a");
      link.href = src;
      link.setAttribute("download", fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Optionally close the modal after download trigger
      onClose();
    }
  }, [isOpen, isSupported, ready, src, fileName, onClose]);

  if (!isOpen || !isSupported) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Preview: ${fileName}`}
      size="xxl"
      className="!max-w-6xl"
    >
      <div className="h-[75vh] flex flex-col -m-4 overflow-hidden overflow-y-auto rounded-b-2xl">
        {!ready ? (
          <div className="flex-1 flex items-center justify-center text-sm text-slate-500">Opening…</div>
        ) : extension === "pdf" ? (
          <iframe
            src={src}
            className="w-full h-full"
            title={fileName}
            // allow-scripts is often needed for PDF viewers' internal JS
            sandbox="allow-scripts allow-same-origin allow-forms"
          />
        ) : (
          <DocViewer
            documents={docs}
            pluginRenderers={DocViewerRenderers}
            style={{ height: "100%" }}
            config={{
              header: {
                disableHeader: true,
                disableFileName: true,
                retainURLParams: false,
              },
            }}
            theme={{
              primary: "#3b82f6",
              secondary: "#ffffff",
              tertiary: "#f3f4f6",
              textPrimary: "#111827",
              textSecondary: "#4b5563",
              textTertiary: "#9ca3af",
              disableThemeScrollbar: false,
            }}
          />
        )}
      </div>
    </Modal>
  );
};

export default FilePreviewModal;
