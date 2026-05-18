import { useEffect, useState } from "react";
import { useDatabase } from "@nozbe/watermelondb/react";
import { Q } from "@nozbe/watermelondb";
import { todayYmd } from "../utils/dateHelpers";

export function useOverdueFollowUpCount() {
  const database = useDatabase();
  const [count, setCount] = useState(0);

  useEffect(() => {
    const t = todayYmd();
    const q = database.collections
      .get("follow_ups")
      .query(Q.where("is_completed", false), Q.where("due_date", Q.lt(t)), Q.where("is_deleted", false));
    const sub = q.observe().subscribe((list) => setCount(list.length));
    return () => sub.unsubscribe();
  }, [database]);

  return count;
}
