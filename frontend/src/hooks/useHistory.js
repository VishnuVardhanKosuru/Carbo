// useHistory.js — localStorage persistence hook

import { useState, useEffect } from "react";

const KEY = "cf_history_v2";

export function useHistory() {
  const [history, setHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(KEY) || "[]");
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(history));
  }, [history]);

  const addRecord = (record) => {
    setHistory((prev) => {
      const filtered = prev.filter((r) => r.record_date !== record.record_date);
      return [...filtered, record].sort((a, b) =>
        a.record_date.localeCompare(b.record_date),
      );
    });
  };

  const clearAll = () => {
    setHistory([]);
    localStorage.removeItem(KEY);
  };

  return { history, addRecord, clearAll };
}
