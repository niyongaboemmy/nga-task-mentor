import { Request, Response } from "express";
import {
  downloadImage,
  EditorImageError,
  storeEditorImage,
} from "../services/editorImages";
import { sendControllerError } from "../utils/controllerErrors";

function fail(res: Response, error: any, context: string) {
  if (error instanceof EditorImageError) {
    return res.status(error.statusCode).json({ success: false, message: error.message });
  }
  return sendControllerError(res, error, context);
}

/** POST /api/media/editor-images — multipart field "image" (a pasted/dropped/picked file). */
export const uploadEditorImage = async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, message: "No image was sent." });
    }
    const stored = await storeEditorImage(file.buffer, file.originalname);
    return res.status(201).json({ success: true, data: stored });
  } catch (error) {
    return fail(res, error, "uploading the image");
  }
};

/** POST /api/media/editor-images/import { url } — re-host an image pasted from another site. */
export const importEditorImage = async (req: Request, res: Response) => {
  try {
    const { buffer, name } = await downloadImage(req.body.url);
    const stored = await storeEditorImage(buffer, name);
    return res.status(201).json({ success: true, data: stored });
  } catch (error: any) {
    // Network failures reaching the other site are the user's to retry, not ours.
    if (error?.code && /^(ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|EAI_AGAIN|CERT_|ERR_TLS)/.test(error.code)) {
      return res.status(502).json({ success: false, message: "The image could not be downloaded from that site." });
    }
    return fail(res, error, "importing the image");
  }
};
