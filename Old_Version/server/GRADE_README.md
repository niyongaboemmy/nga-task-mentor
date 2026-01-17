# Submission Grading Implementation

## Overview
Added support for grading submissions via the new PATCH `/api/submissions/:id/grade` endpoint.

## Changes Made

### 1. Controller (`src/controllers/submission.controller.ts`)
- Added `gradeSubmission` function that:
  - Validates user permissions (instructors/admins only)
  - Validates grade data (score, maxScore)
  - Creates grade string in format "score/maxScore"
  - Updates submission status to 'graded'
  - Stores feedback separately

### 2. Routes (`src/routes/submissions.ts`)
- Added PATCH route: `/:id/grade`
- Restricted to instructors and admins only
- Maps to `gradeSubmission` controller

### 3. Model (`src/models/Submission.model.ts`)
- Updated grade column from JSON to TEXT
- Modified validation to handle string format
- Removed unused IGrade interface
- Updated ISubmissionAttributes interface

## API Usage

### Endpoint
```
PATCH /api/submissions/:id/grade
```

### Authentication
- Requires authentication
- Only instructors and admins can grade submissions

### Request Body
```json
{
  "score": 85,
  "maxScore": 100,  // Optional - will be retrieved from assignment if not provided
  "feedback": "Great work! Well structured and comprehensive."
}
```

### Response
```json
{
  "success": true,
  "message": "Submission graded successfully",
  "data": {
    "id": 1,
    "grade": "85/100",
    "status": "graded",
    "feedback": "Great work! Well structured and comprehensive.",
    // ... other submission fields
  }
}
```

## Frontend Compatibility
- Grade stored as string in format expected by frontend
- Display format: "score/maxScore points"
- Status updated to "graded" for proper UI state management
- **After grading**: marks are displayed and grading interface is disabled

## Testing
Run the test script:
```bash
node test-grading-endpoint.js
```

Make sure the server is running first:
```bash
npm run dev
```
