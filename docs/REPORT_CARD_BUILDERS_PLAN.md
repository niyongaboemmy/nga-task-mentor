# Report card builders: Normal and TVET

Status: implemented on `feat/rtb-camis-report-card` (PR #126), 2026-11-20.

## 1. Analysis

### What exists
- **Mapping.** A teacher maps quizzes, assignments and manual assessments of a
  subject into categories (`report_card_assessments.category`,
  `subject_assessment_mappings.category`): CW 15, HW 10, MD 25, EOT 50. The
  per-card builder is `ReportCardBuilder` (drag and drop, opened from
  `/grades/subjects/:id`). The quick picker is `AssessmentMappingControl` on
  the Grades page.
- **Grading.** `calculateSubjectGrade` gives each category the average percentage of its
  mapped marks, scaled to the category weight. The subject total is points ÷ weight covered.
- **Rendering.** `buildCardDocuments` produces a `ReportCardDocument` (stored as the
  snapshot on approval). The screen card is `ReportCardDocumentView` and the PDF is
  `reportCardDocumentPdf`.
- **Scheme.** The school's settings are a JSON `app_settings` row (`report_card.scheme`),
  edited on `/report-cards/settings` (REPORT_CARDS_APPROVE).

### The gap
- PR #126 replaced the only card format with the CAMIS layout. A school
  following the national general-education card lost its format.
- TVET marks were still mapped into CW/HW/MD/EOT and reinterpreted as FA and CA.
  Teachers never saw the TVET structure while mapping.
- The sample TVET card (an issued Level 3 card, 2025/2026) differs from #126 in several places:
  - Every component is shown **out of the module weight**: FA /W, CA /W, IA /W.
    TO is out of 2W, or 3W with IA. In the sample, weight 30 gives FA 22.5 + CA 27.5 = TO 50.
  - AT is the **sum** of the term TOs. The annual % is AT ÷ the sum of the term maxima
    (SPEWI302: 477.9 / 560 = 85.3 %).
  - The totals row carries the annual maximum in the weight column
    (7 830 = Σ module annual maxima). Term % = Σ TO ÷ Σ term maxima, weighted by
    learning hours. The position is ranked on that.
  - Header layout:
    - Left: school block (REPUBLIC OF RWANDA, MINISTRY OF EDUCATION, DISTRICT, SCHOOL NAME,
      SCHOOL EMAIL, TEL).
    - Right: learner block (ACADEMIC YEAR, CLASS, LEARNER'S NAME, SDMS ID).
    - Below: QUALIFICATION TITLE / TRADE / RQF LEVEL / SECTOR.
  - Table structure:
    - A behaviour row with MAX 40 and the mark for each term.
    - Groups: COMPLEMENTARY MODULES, then a CORE MODULES band split into GENERAL and SPECIFIC.
    - Rows for TOTALS, PERCENTAGE, POSITION and Conduct.
    - Class Trainer's Comments & signature, one cell per term.
  - Footer has four panels:
    - Deliberation conditions.
    - Decision.
    - Abbreviations.
    - Headmaster's names and signature, with the stamp.

### Decisions
- Two builder structures share one data model. The tenant picks the builder in
  `scheme.builder`; the default is `normal`, so nothing changes until a school switches.
- Category sets:

  | Builder | Categories | Weights |
  |---|---|---|
  | Normal | CW, HW, MD, EOT | Sum to 100 (as before) |
  | TVET | FA, CA, IA | Equal, each scored out of the module weight |

  New enum values: FA and CA. IA already exists.
- No destructive conversion. A mapping made under the other builder is read through
  `effectiveCategory`:
  - TVET reads CW/HW/MD → FA and EOT → CA.
  - Normal reads FA → MD and CA → EOT. IA is not counted.

  The builder UI shows such mappings in the active builder's categories. A save
  stores them in the new categories.
- **Percent-space grading.** TVET grades each category as a percentage, all three
  weighted equally. The module weight W is applied only when rendering
  (component = % × W). This keeps `computeCardGrades` free of MIS lookups. The term %
  and positions for TVET are weighted by learning hours inside `buildCardDocuments`.
- **Module weight.** W is the MIS `learning_hours` (credits × 10). It can be
  overridden per module in the template settings, and falls back to a default
  (100) when MIS has none.
- **Snapshot format.** The document records `builder`. A frozen card keeps the
  format it was approved in, even if the school later switches. Old snapshots
  (no `builder`) render as Normal.
- **Two self-contained templates per surface**, behind one dispatcher:

  | Surface | Templates |
  |---|---|
  | Screen | `templates/NormalTemplate.tsx`, `templates/TvetTemplate.tsx` |
  | PDF | `reportCardPdfNormal.ts`, `reportCardPdfTvet.ts` |

  Shared helpers live in `reportCardPdfCommon.ts`.

## 2. Phases

### Phase 1: Data and grading (server)
1. Migration `20261120-rtb-camis-report-card.sql`:
   - Both category enums become `('CW','HW','MD','EOT','IA','FA','CA')`.
   - `report_cards.behaviour_mark`.
2. Builder structure:
   - `services/reportCardBuilders.ts`: `BUILDERS` (key, label, categories with
     label, short label, weight, group), `effectiveCategory`, `gradingOf(scheme)`.
   - `reportCardGrader.service.ts`: `AssessmentCategory` gains FA and CA.
3. Scheme:
   - `builder`.
   - `tvet` options: district, sector, headmaster name, qualification title,
     default module weight, per-module weights, show attendance, show attributes.
   - Validated in `normalizeScheme`.
4. Grading: `computeCardGrades(card, grading?)` remaps categories through the
   builder. All callers pass `gradingOf(scheme)`. The provisional preview
   remaps too.
5. Validation of mapping categories: the zod enums and model `VALID_CATEGORIES` accept FA and CA.

### Phase 2: Documents (server)
1. `buildCardDocuments`:
   - Stamps `builder`.
   - Normal documents: as on main (no annual block).
   - TVET documents get a `tvet` block:
     - Term columns; each module's weight and its source.
     - Per term: FA/IA/CA/TO and the maximum.
     - Annual AT, % and C/NYC.
     - Per-term totals, %, positions, conduct and comments.
     - Annual totals.
     - Deliberation conditions and the automatic decision:
       - Promoted when every module is competent; Graduated at Level 5.
       - Otherwise Re-assessment required.
     - School and qualification fields.
   - Term % and positions are weighted by learning hours.
2. Endpoints:
   - `GET /report-cards/structure` (any signed-in staff): the active builder and its categories.
   - `GET /report-cards/templates/modules`: MIS modules with learning hours, for the weight editor.

### Phase 3: PDF templates (server)
- `reportCardPdfCommon.ts`: colours, fonts, logo, QR art, collect, `exact`.
- `reportCardPdfNormal.ts`: the main-branch card, unchanged in look.
- `reportCardPdfTvet.ts`: the sample layout on A4 portrait.
  - Termly cards show one term group; Term 3 shows all three terms plus the annual columns.
  - Bordered table with grey group bands.
  - Totals, Percentage, Position and Conduct rows; trainer comment cells.
  - The four-panel footer, the QR and the PROVISIONAL watermark.
- `reportCardDocumentPdf.ts`: dispatches on `doc.builder` for single cards and class packs.

### Phase 4: Screen templates and template management (client)
1. `templates/NormalTemplate.tsx`: the main-branch view, with mapping guidance.
2. `templates/TvetTemplate.tsx`: the sample layout. Staff mapping guidance works as in Normal: chips on modules, click to expand.
3. `templates/sampleDocuments.ts`: realistic sample documents for previews.
4. `ReportCardDocumentView`: the dispatcher.
5. `/report-cards/templates`, the template management page (REPORT_CARDS_APPROVE):
   - Two template cards with live scaled thumbnails, rendered from the real templates.
   - One action to choose the builder, with a confirmation that explains:
     - what changes in mapping;
     - that frozen cards keep their format.
   - A full-size preview with Termly / Term 3 toggles and a zoom control.
   - TVET options:
     - School block fields.
     - Headmaster.
     - Qualification and sector.
     - Module weights editor (MIS hours, override, reset, search).
     - Show attendance and attributes.
   - Normal options: links to the existing settings (weights, display toggles).
   - Unsaved-changes bar and a toast for every save.
6. Builder-aware mapping:
   - A `useReportCardStructure` hook, cached per session.
   - `ReportCardBuilder`:
     - Drop zones, weight summary and quick-assign come from the active builder.
     - A builder chip with "View template" for teachers (read-only preview modal).
     - A banner for remapped legacy mappings.
   - `AssessmentMappingControl` and the Grades page offer the active categories.
   - The settings page shows the CW/HW/MD/EOT weights only for Normal, and links to Templates.

### Phase 5: Tests and verification
- **Server unit tests:**
  - `effectiveCategory` and `gradingOf`.
  - Scheme normalisation.
  - TVET document maths, checked against the sample's numbers (weights 30/80, SPEWI302 annual 85.3 %).
  - PDF render smoke tests for both builders, termly and annual.
- **Server integration test:** a Term 3 TVET cohort, with frozen earlier snapshots.
- **Client tests:**
  - The dispatcher picks the right template.
  - TVET template rows and totals.
  - The templates page: choose a builder, confirm, save; module weight override.
  - Builder categories follow the structure.
- Visual check of both templates, screen and PDF, termly and annual.

### Phase 6: Deploy
1. Apply the SQL on production (TM DB) before merging.
2. Merge PR #126; the GitHub Actions deploy runs.
3. Verify the live chunks and `GET /api/report-cards/structure`.
