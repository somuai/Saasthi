import { Database } from "@nozbe/watermelondb";
import SQLiteAdapter from "@nozbe/watermelondb/adapters/sqlite";
import schema from "./schema";
import migrations from "./migrations";
import { modelClasses } from "./models";

const adapter = new SQLiteAdapter({
  schema,
  migrations,
  jsi: false,
  onSetUpError(error) {
    console.warn("[WatermelonDB] setup error", error);
  },
});

export const database = new Database({
  adapter,
  modelClasses,
});

export { schema, migrations };
