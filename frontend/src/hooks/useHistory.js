// useHistory.js — localStorage persistence hook

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "cf_history";
const GOAL_KEY = "cf_goal";

export function useHistory() {
  const [history, setHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  });

  const [goal, setGoal] = useState(() => {
    try {
      return parseFloat(localStorage.getItem(GOAL_KEY)) || 4.0;
    } catch {
      return 4.0;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem(GOAL_KEY, goal.toString());
  }, [goal]);

  const addRecord = useCallback((record) => {
    setHistory((prev) => {
      const copy = prev.filter((r) => r.record_date !== record.record_date);
      return [...copy, record].sort((a, b) =>
        a.record_date.localeCompare(b.record_date),
      );
    });
  }, []);

  const clearAll = useCallback(() => setHistory([]), []);

  return { history, addRecord, clearAll, goal, setGoal };
}
