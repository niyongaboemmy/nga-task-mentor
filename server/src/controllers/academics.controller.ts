import { Request, Response } from "express";
import axios from "axios";
import { getMisToken, handleMisError } from "../utils/misUtils";

// @desc    List all academic years (for the academic period switcher)
// @route   GET /api/academics/years
// @access  Private
export const getAcademicYears = async (req: Request, res: Response) => {
  try {
    const token = getMisToken(req);
    if (!token) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication required" });
    }

    const response = await axios.get(
      `${process.env.NGA_MIS_BASE_URL}/academics/years`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    res.status(200).json(response.data);
  } catch (error: any) {
    return handleMisError(error, res, "Error fetching academic years");
  }
};

// @desc    List academic terms, optionally scoped to one academic year
// @route   GET /api/academics/terms?academic_year_id=
// @access  Private
export const getAcademicTerms = async (req: Request, res: Response) => {
  try {
    const token = getMisToken(req);
    if (!token) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication required" });
    }

    const { academic_year_id } = req.query;

    const response = await axios.get(
      `${process.env.NGA_MIS_BASE_URL}/academics/terms`,
      {
        headers: { Authorization: `Bearer ${token}` },
        params: academic_year_id ? { academic_year_id } : {},
      },
    );

    res.status(200).json(response.data);
  } catch (error: any) {
    return handleMisError(error, res, "Error fetching academic terms");
  }
};
