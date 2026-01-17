import axios from "../utils/axiosConfig";

// Proctoring API Service
export class ProctoringApiService {
  // Log proctoring event
  static async logEvent(data: {
    session_token: string;
    event_type: string;
    severity?: "low" | "medium" | "high" | "critical";
    description: string;
    metadata?: any;
    screenshot_url?: string;
    video_timestamp?: number;
  }): Promise<{ success: boolean; data: any }> {
    const response = await axios.post("/api/proctoring/events", data);
    return response.data;
  }

  // Get proctoring settings for a quiz
  static async getProctoringSettings(
    quizId: number
  ): Promise<{ success: boolean; data: any }> {
    const response = await axios.get(
      `/api/proctoring/quizzes/${quizId}/proctoring-settings`
    );
    return response.data;
  }

  // Update proctoring settings for a quiz
  static async updateProctoringSettings(
    quizId: number,
    settings: any
  ): Promise<{ success: boolean; data: any }> {
    const response = await axios.post(
      `/api/proctoring/quizzes/${quizId}/proctoring-settings`,
      settings
    );
    return response.data;
  }

  // Start proctoring session
  static async startProctoringSession(
    quizId: number,
    data: {
      browser_info: any;
      system_info: any;
      ip_address: string;
      location_data?: any;
    }
  ): Promise<{ success: boolean; data: any }> {
    const response = await axios.post(
      `/api/quizzes/${quizId}/proctoring/start`,
      data
    );
    return response.data;
  }

  // Update proctoring session
  static async updateProctoringSession(
    sessionId: number,
    data: {
      status?: string;
      identity_verified?: boolean;
      environment_verified?: boolean;
      end_time?: string;
    }
  ): Promise<{ success: boolean; data: any }> {
    const response = await axios.patch(
      `/api/proctoring/sessions/${sessionId}`,
      data
    );
    return response.data;
  }

  // Get proctoring sessions for a quiz
  static async getProctoringSessions(
    quizId: number,
    filters?: { status?: string; student_id?: number }
  ): Promise<{ success: boolean; count: number; data: any[] }> {
    const response = await axios.get(
      `/api/quizzes/${quizId}/proctoring/sessions`,
      { params: filters }
    );
    return response.data;
  }

  // Get proctoring session details
  static async getProctoringSession(
    sessionId: number
  ): Promise<{ success: boolean; data: any }> {
    const response = await axios.get(`/api/proctoring/sessions/${sessionId}`);
    return response.data;
  }

  // Get student's proctoring sessions
  static async getMyProctoringSessions(): Promise<{
    success: boolean;
    count: number;
    data: any[];
  }> {
    const response = await axios.get("/api/proctoring/my-sessions");
    return response.data;
  }

  // Join live proctoring stream
  static async joinLiveStream(
    sessionToken: string,
    socketId: string
  ): Promise<{ success: boolean; message: string; session: any }> {
    const response = await axios.post(
      `/api/proctoring/sessions/${sessionToken}/join-stream`,
      { socketId }
    );
    return response.data;
  }

  // Leave live proctoring stream
  static async leaveLiveStream(
    sessionToken: string
  ): Promise<{ success: boolean; message: string }> {
    const response = await axios.post(
      `/api/proctoring/sessions/${sessionToken}/leave-stream`
    );
    return response.data;
  }

  // Get active proctoring streams
  static async getActiveStreams(): Promise<{
    success: boolean;
    count: number;
    data: any[];
  }> {
    const response = await axios.get("/api/proctoring/live-streams");
    return response.data;
  }

  // End proctoring session with reason
  static async endProctoringSession(
    sessionId: number,
    reason: string
  ): Promise<{ success: boolean; data: any }> {
    const response = await axios.patch(
      `/api/proctoring/sessions/${sessionId}/end`,
      { reason }
    );
    return response.data;
  }
}

// Error handling utility for proctoring API
export class ProctoringApiError extends Error {
  public statusCode: number;
  public errors?: any[];

  constructor(message: string, statusCode: number, errors?: any[]) {
    super(message);
    this.name = "ProctoringApiError";
    this.statusCode = statusCode;
    this.errors = errors;
  }
}

// API response wrapper with error handling for proctoring
export async function handleProctoringApiCall<T>(
  apiCall: () => Promise<{
    success: boolean;
    data: T;
    message?: string;
    errors?: any[];
  }>
): Promise<T> {
  try {
    const response = await apiCall();

    if (!response.success) {
      throw new ProctoringApiError(
        response.message || "API call failed",
        400,
        response.errors
      );
    }

    return response.data;
  } catch (error: any) {
    if (error.response) {
      // Server responded with error status
      throw new ProctoringApiError(
        error.response.data.message || "Server error",
        error.response.status,
        error.response.data.errors
      );
    } else if (error.request) {
      // Network error
      throw new ProctoringApiError(
        "Network error - please check your connection",
        0
      );
    } else {
      // Other error
      throw new ProctoringApiError(
        error.message || "Unknown error occurred",
        0
      );
    }
  }
}
