import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  phone: "",
  accessToken: null,
  refreshToken: null,
  user: null,
  workerData: null,
  otpRequested: false,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    requestOtp(state, action) {
      state.phone = action.payload;
      state.otpRequested = true;
    },
    setTokens(state, action) {
      state.accessToken = action.payload.access;
      state.refreshToken = action.payload.refresh ?? state.refreshToken;
    },
    setUser(state, action) {
      state.user = action.payload;
    },
    setWorkerData(state, action) {
      state.workerData = action.payload;
    },
    updateAccessToken(state, action) {
      state.accessToken = action.payload;
    },
    verifyOtp(state, action) {
      state.user = action.payload?.user ?? {
        id: "asha-pilot-user",
        name: "Pilot ASHA",
        phone: state.phone,
        language: action.payload?.language || "hi",
      };
      if (action.payload?.worker) {
        state.workerData = action.payload.worker;
      }
    },
    signOut() {
      return { ...initialState };
    },
  },
});

export const {
  requestOtp,
  verifyOtp,
  signOut,
  setUser,
  setWorkerData,
  setTokens,
  updateAccessToken,
} = authSlice.actions;
export default authSlice.reducer;
