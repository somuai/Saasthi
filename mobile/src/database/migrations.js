import { addColumns, createTable, schemaMigrations } from "@nozbe/watermelondb/Schema/migrations";

export default schemaMigrations({
  migrations: [
    {
      toVersion: 2,
      steps: [
        addColumns({
          table: "follow_ups",
          columns: [
            { name: "visit_lat", type: "number", isOptional: true },
            { name: "visit_lng", type: "number", isOptional: true },
            { name: "visit_accuracy_m", type: "number", isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 3,
      steps: [
        addColumns({
          table: "follow_ups",
          columns: [{ name: "visit_gps_timestamp", type: "string", isOptional: true }],
        }),
      ],
    },
    {
      toVersion: 4,
      steps: [
        addColumns({
          table: "follow_ups",
          columns: [
            { name: "distance_from_household_m", type: "number", isOptional: true },
            { name: "gps_verification_status", type: "string", isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 5,
      steps: [
        addColumns({
          table: "mother_records",
          columns: [
            { name: "pnc_day14_json", type: "string", isOptional: true },
            { name: "pnc_day21_json", type: "string", isOptional: true },
            { name: "pnc_day28_json", type: "string", isOptional: true },
            { name: "pnc_day42_json", type: "string", isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 6,
      steps: [
        createTable({
          name: "location_logs",
          columns: [
            { name: "server_id", type: "string", isOptional: true },
            { name: "is_synced", type: "boolean" },
            { name: "created_at", type: "number" },
            { name: "updated_at", type: "number" },
            { name: "is_deleted", type: "boolean" },
            { name: "is_mock", type: "boolean" },
            { name: "latitude", type: "number" },
            { name: "longitude", type: "number" },
            { name: "accuracy_m", type: "number", isOptional: true },
            { name: "altitude_m", type: "number", isOptional: true },
            { name: "speed_mps", type: "number", isOptional: true },
            { name: "battery_pct", type: "number", isOptional: true },
            { name: "recorded_at", type: "string" },
            { name: "is_during_visit", type: "boolean", isOptional: true },
            { name: "visit_id", type: "string", isOptional: true },
          ],
        }),
      ],
    },
  ],
});
