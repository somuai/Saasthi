import { configureStore } from "@reduxjs/toolkit";
import authReducer from "../features/auth/authSlice";
import earningsReducer from "../features/earnings/earningsSlice";
import patientsReducer from "../features/patients/patientsSlice";
import surveyReducer from "../features/survey/surveySlice";
import syncReducer from "../features/sync/syncSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    patients: patientsReducer,
    survey: surveyReducer,
    sync: syncReducer,
    earnings: earningsReducer,
  },
});
