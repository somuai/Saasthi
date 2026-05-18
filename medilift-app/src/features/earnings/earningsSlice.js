import { createSlice } from "@reduxjs/toolkit";

const seedTasks = [
  { id: "task_anc", label: "Verified ANC update", labelHi: "सत्यापित एएनसी अपडेट", amount: 30, completed: true },
  { id: "task_immunization", label: "Immunization record update", labelHi: "टीकाकरण रिकॉर्ड अपडेट", amount: 25, completed: false },
  { id: "task_followup", label: "Completed follow-up", labelHi: "पूरा फॉलोअप", amount: 20, completed: true },
];

const earningsSlice = createSlice({
  name: "earnings",
  initialState: {
    tasks: seedTasks,
  },
  reducers: {
    markTaskCompleted(state, action) {
      const task = state.tasks.find((item) => item.id === action.payload);
      if (task) task.completed = true;
    },
  },
});

export const { markTaskCompleted } = earningsSlice.actions;
export default earningsSlice.reducer;
