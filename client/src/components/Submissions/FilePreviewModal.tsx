import React, { useEffect } from "react";
import DocViewer, { DocViewerRenderers } from "@cyntler/react-doc-viewer";
import Modal from "../ui/Modal";

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
  const docs = [{ uri: fileUrl, fileName }];

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
    if (isOpen && !isSupported) {
      // Auto-download for unsupported types
      const link = document.createElement("a");
      link.href = fileUrl;
      link.setAttribute("download", fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Optionally close the modal after download trigger
      onClose();
    }
  }, [isOpen, isSupported, fileUrl, fileName, onClose]);

  if (!isOpen || !isSupported) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Preview: ${fileName}`}
      size="xxl"
      className="!max-w-6xl"
    >
      <div className="h-[75vh] flex flex-col -m-4 overflow-hidden rounded-b-2xl">
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
      </div>
    </Modal>
  );
};

export default FilePreviewModal;
