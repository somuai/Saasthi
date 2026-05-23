import { addColumns, schemaMigrations } from "@nozbe/watermelondb/Schema/migrations";

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
  ],
});
