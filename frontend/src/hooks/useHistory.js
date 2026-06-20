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

  const [pledges, setPledges] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("cf_pledges")) || [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem(GOAL_KEY, goal.toString());
  }, [goal]);

  useEffect(() => {
    localStorage.setItem("cf_pledges", JSON.stringify(pledges));
  }, [pledges]);

  const addRecord = useCallback((record) => {
    setHistory((prev) => {
      const copy = prev.filter((r) => r.record_date !== record.record_date);
      return [...copy, record].sort((a, b) =>
        a.record_date.localeCompare(b.record_date),
      );
    });
  }, []);

  const clearAll = useCallback(() => setHistory([]), []);

  const addPledge = useCallback((pledge) => {
    setPledges((prev) => prev.includes(pledge) ? prev : [...prev, pledge]);
  }, []);

  const removePledge = useCallback((pledge) => {
    setPledges((prev) => prev.filter((p) => p !== pledge));
  }, []);

  return { history, addRecord, clearAll, goal, setGoal, pledges, addPledge, removePledge };
}
