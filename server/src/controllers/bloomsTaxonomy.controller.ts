import { Request, Response } from "express";
import { BloomsTaxonomyLevel } from "../models";

// @desc    Get all Bloom's Taxonomy levels
// @route   GET /api/quizzes/blooms-levels
// @access  Private (all authenticated users)
export const getBloomsTaxonomyLevels = async (req: Request, res: Response) => {
  try {
    const levels = await BloomsTaxonomyLevel.findAll({
      order: [["level_order", "ASC"]],
    });

    res.status(200).json({
      success: true,
      count: levels.length,
      data: levels,
    });
  } catch (error) {
    console.error("Get Blooms Taxonomy levels error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Get single Bloom's Taxonomy level
// @route   GET /api/quizzes/blooms-levels/:id
// @access  Private (all authenticated users)
export const getBloomsTaxonomyLevel = async (req: Request, res: Response) => {
  try {
    const level = await BloomsTaxonomyLevel.findByPk(req.params.id);

    if (!level) {
      return res.status(404).json({
        success: false,
        message: "Bloom's Taxonomy level not found",
      });
    }

    res.status(200).json({ success: true, data: level });
  } catch (error) {
    console.error("Get Blooms Taxonomy level error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Create a Bloom's Taxonomy level
// @route   POST /api/quizzes/blooms-levels
// @access  Private/Admin
export const createBloomsTaxonomyLevel = async (
  req: Request,
  res: Response,
) => {
  try {
    const { name, description, level_order } = req.body;

    if (!name) {
      return res
        .status(400)
        .json({ success: false, message: "Level name is required" });
    }

    const level = await BloomsTaxonomyLevel.create({
      name,
      description: description ?? null,
      level_order: level_order ?? 0,
    });

    res.status(201).json({ success: true, data: level });
  } catch (error) {
    console.error("Create Blooms Taxonomy level error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Update a Bloom's Taxonomy level
// @route   PUT /api/quizzes/blooms-levels/:id
// @access  Private/Admin
export const updateBloomsTaxonomyLevel = async (
  req: Request,
  res: Response,
) => {
  try {
    const level = await BloomsTaxonomyLevel.findByPk(req.params.id);

    if (!level) {
      return res.status(404).json({
        success: false,
        message: "Bloom's Taxonomy level not found",
      });
    }

    const { name, description, level_order } = req.body;

    await level.update({
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(level_order !== undefined && { level_order }),
    });

    res.status(200).json({ success: true, data: level });
  } catch (error) {
    console.error("Update Blooms Taxonomy level error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Delete a Bloom's Taxonomy level
// @route   DELETE /api/quizzes/blooms-levels/:id
// @access  Private/Admin
export const deleteBloomsTaxonomyLevel = async (
  req: Request,
  res: Response,
) => {
  try {
    const level = await BloomsTaxonomyLevel.findByPk(req.params.id);

    if (!level) {
      return res.status(404).json({
        success: false,
        message: "Bloom's Taxonomy level not found",
      });
    }

    await level.destroy();

    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    console.error("Delete Blooms Taxonomy level error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
