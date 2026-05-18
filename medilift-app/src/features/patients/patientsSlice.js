import { createSlice } from "@reduxjs/toolkit";

export const seedPatients = [
  {
    localId: "patient_asha_001",
    name: "Sita Devi",
    phone: "9000000001",
    village: "Rampur",
    dob: "1999-04-12",
    lmpDate: "2025-10-01",
    gravida: 2,
    consent: { accepted: true, version: "pilot-v1", language: "hi" },
  },
  {
    localId: "patient_asha_002",
    name: "Meena Kumari",
    phone: "9000000002",
    village: "Basantpur",
    dob: "2007-08-30",
    lmpDate: "2025-12-18",
    gravida: 1,
    consent: { accepted: true, version: "pilot-v1", language: "hi" },
  },
];

const patientsSlice = createSlice({
  name: "patients",
  initialState: {
    items: seedPatients,
    selectedPatientId: seedPatients[0].localId,
  },
  reducers: {
    addPatient(state, action) {
      state.items.unshift(action.payload);
      state.selectedPatientId = action.payload.localId;
    },
    updatePatient(state, action) {
      const index = state.items.findIndex((item) => item.localId === action.payload.localId);
      if (index >= 0) state.items[index] = { ...state.items[index], ...action.payload };
    },
    selectPatient(state, action) {
      state.selectedPatientId = action.payload;
    },
  },
});

export const { addPatient, updatePatient, selectPatient } = patientsSlice.actions;
export default patientsSlice.reducer;
