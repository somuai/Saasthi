import { createSlice } from "@reduxjs/toolkit";

const surveySlice = createSlice({
  name: "survey",
  initialState: {
    responses: [],
  },
  reducers: {
    saveSurveyResponse(state, action) {
      state.responses.unshift(action.payload);
    },
  },
});

export const { saveSurveyResponse } = surveySlice.actions;
export default surveySlice.reducer;
