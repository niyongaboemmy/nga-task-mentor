import multer from 'multer';
import { Request } from 'express';

// In-memory buffer, uploaded to the shared file-server by the controller
// (which is also where the filename is now generated, since memoryStorage
// has no per-file destination/filename callback the way diskStorage did).
const storage = multer.memoryStorage();

// File filter for images only
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'));
  }
};

// Configure multer
export const uploadProfilePicture = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    // Matches NGA MIS's own avatar limit -- MIS resizes and compresses it.
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// Middleware to handle multer errors
export const handleMulterError = (error: any, req: Request, res: any, next: any) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 10MB.',
      });
    }
  }
  if (error.message === 'Only image files are allowed!') {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
  next(error);
};

export default uploadProfilePicture;
