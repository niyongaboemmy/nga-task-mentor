import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface AuthState {
  isAuthenticated: boolean;
  user: any | null;
  currentAcademicYear: any | null;
  currentAcademicTerm: any | null;
  loading: boolean;
}

const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  currentAcademicYear: null,
  currentAcademicTerm: null,
  loading: false,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    loginStart: (state) => {
      state.loading = true;
    },
    loginSuccess: (state, action: PayloadAction<any>) => {
      state.loading = false;
      state.isAuthenticated = true;
      state.user = action.payload;
      // Also store academic info if present in payload (it might be nested or direct)
      // Based on our plan, we'll likely pass the whole data object or attach it.
      // Let's assume the payload might contain it, or we handle it in the context before dispatching.
      // Actually, looking at the context, we dispatch `loginSuccess(userData)` or `loginSuccess(response.data.data)`.
      // We should update the payload structure or handle it here.
      // Let's update the state from the payload if it exists.
      if (action.payload.currentAcademicYear) {
        state.currentAcademicYear = action.payload.currentAcademicYear;
      }
      if (action.payload.currentAcademicTerm) {
        state.currentAcademicTerm = action.payload.currentAcademicTerm;
      }
    },
    loginFailure: (state) => {
      state.loading = false;
      state.isAuthenticated = false;
      state.user = null;
    },
    logout: (state) => {
      state.isAuthenticated = false;
      state.user = null;
      state.currentAcademicYear = null;
      state.currentAcademicTerm = null;
    },
  },
});

export const { loginStart, loginSuccess, loginFailure, logout } =
  authSlice.actions;
export default authSlice.reducer;
