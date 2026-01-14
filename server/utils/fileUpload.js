const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const ErrorResponse = require('./errorResponse');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Create user-specific directory if it doesn't exist
    const userDir = path.join(uploadsDir, req.user.id.toString());
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    cb(null, userDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

// File filter
const fileFilter = (req, file, cb) => {
  // Allowed file types
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'image/jpeg',
    'image/png',
    'application/zip',
    'application/x-rar-compressed',
    'application/x-7z-compressed',
  ];

  // Check file type
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new ErrorResponse(
        `Invalid file type. Only PDF, DOC, DOCX, TXT, JPG, PNG, ZIP, RAR, and 7Z files are allowed.`,
        400
      ),
      false
    );
  }
};

// Initialize upload
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
});

// Middleware for handling multiple file uploads
const uploadFiles = (fieldName, maxCount = 5) => {
  return (req, res, next) => {
    const uploadHandler = upload.array(fieldName, maxCount);
    uploadHandler(req, res, function (err) {
      if (err instanceof multer.MulterError) {
        // A Multer error occurred when uploading
        return next(
          new ErrorResponse(
            err.code === 'LIMIT_FILE_SIZE'
              ? 'File size too large. Maximum size is 10MB.'
              : 'Error uploading file',
            400
          )
        );
      } else if (err) {
        // An unknown error occurred
        return next(err);
      }
      next();
    });
  };
};

// Middleware for handling single file upload
const uploadFile = (fieldName) => {
  return (req, res, next) => {
    const uploadHandler = upload.single(fieldName);
    uploadHandler(req, res, function (err) {
      if (err instanceof multer.MulterError) {
        return next(
          new ErrorResponse(
            err.code === 'LIMIT_FILE_SIZE'
              ? 'File size too large. Maximum size is 10MB.'
              : 'Error uploading file',
            400
          )
        );
      } else if (err) {
        return next(err);
      }
      next();
    });
  };
};

// Function to delete a file
const deleteFile = (filePath) => {
  const fullPath = path.join(uploadsDir, filePath);
  if (fs.existsSync(fullPath)) {
    fs.unlink(fullPath, (err) => {
      if (err) {
        console.error(`Error deleting file ${filePath}:`, err);
        return false;
      }
      return true;
    });
  }
  return false;
};

// Function to clean up old files
const cleanUpFiles = async (filePaths) => {
  if (!Array.isArray(filePaths)) {
    filePaths = [filePaths];
  }

  const results = await Promise.all(
    filePaths.map(async (filePath) => {
      return deleteFile(filePath);
    })
  );

  return results.every((result) => result === true);
};

module.exports = {
  upload,
  uploadFiles,
  uploadFile,
  deleteFile,
  cleanUpFiles,
  UPLOAD_DIR: uploadsDir,
};
