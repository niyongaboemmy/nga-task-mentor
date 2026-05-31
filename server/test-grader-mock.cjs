'use strict';
/**
 * Module mock loaded via --require before the test file.
 * Intercepts Sequelize models, database, AI, and Judge0 imports so the
 * grader can be unit-tested without a running database or external APIs.
 *
 * Usage:
 *   ts-node --require ./test-grader-mock.cjs src/utils/quizGrader.test.ts
 */

const Module = require('module');
const originalLoad = Module._load;

// Patterns that should be intercepted (matched against the raw request string)
const MODEL_PATTERNS = [
  '/models/index',
  '/models\\index',
  'src/models',
  'dist/models',
];
const DB_PATTERNS = [
  '/config/database',
  'config/database',
];
const AI_PATTERNS = [
  '/services/ai/aiService',
  'services/ai/aiService',
  '/providers/geminiProvider',
  '/providers/openaiProvider',
  '/providers/mockProvider',
];
const JUDGE0_PATTERNS = [
  '/services/Judge0Service',
  'services/Judge0Service',
  '/utils/codeExecutor',
  'utils/codeExecutor',
];

function matches(request, patterns) {
  const norm = request.replace(/\\/g, '/');
  return patterns.some(p => norm.includes(p.replace(/\\/g, '/')));
}

// ── Mock implementations ──────────────────────────────────────────────────────

class MockModel {
  static findAll() { return Promise.resolve([]); }
  static findByPk() { return Promise.resolve(null); }
}

const MOCK_MODELS = {
  QuizQuestion: MockModel,
  QuizAttempt:  MockModel,
  QuestionBank: MockModel,
  Quiz:         MockModel,
  User:         MockModel,
};

const MOCK_AI_SERVICE = {
  aiService: {
    // Throw so gradeShortAnswer falls back to keyword-based grading in tests
    gradeShortAnswer: async () => {
      throw new Error('[MOCK] AI unavailable — keyword fallback should activate');
    },
    gradeCoding: async () => ({
      is_correct: false,
      points_earned: 0,
      feedback: '[MOCK] AI coding grading not active in unit tests',
    }),
  },
};

const MOCK_JUDGE0 = {
  Judge0Service: {
    getLanguageId: () => 63,
    submit: async () => 'mock-token',
    waitAndGetResult: async () => ({
      status: { id: 3, description: 'Accepted' },
      stdout: 'expected\n',
      stderr: null,
      time: '0.05',
      memory: 512,
    }),
  },
};

const MOCK_CODE_EXECUTOR = {
  CodeExecutor: class MockCodeExecutor {},
  TestCase: {},
};

// ── Patched loader ────────────────────────────────────────────────────────────

Module._load = function(request, parent, isMain) {
  if (matches(request, MODEL_PATTERNS)) return MOCK_MODELS;
  if (matches(request, DB_PATTERNS))    return {};
  if (matches(request, AI_PATTERNS))    return MOCK_AI_SERVICE;
  if (matches(request, JUDGE0_PATTERNS)) {
    if (request.includes('codeExecutor')) return MOCK_CODE_EXECUTOR;
    return MOCK_JUDGE0;
  }
  return originalLoad.call(this, request, parent, isMain);
};
