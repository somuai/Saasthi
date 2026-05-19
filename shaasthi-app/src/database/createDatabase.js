import { Database } from "@nozbe/watermelondb";
import SQLiteAdapter from "@nozbe/watermelondb/adapters/sqlite";
import schema from "./schema";
import migrations from "./migrations";
import { modelClasses } from "./models";

export function createDatabase() {
  const adapter = new SQLiteAdapter({
    schema,
    migrations,
    jsi: false,
    onSetUpError(error) {
      console.warn("[WatermelonDB] setup error", error);
    },
  });

  return new Database({
    adapter,
    modelClasses,
  });
}

export { schema, migrations };
