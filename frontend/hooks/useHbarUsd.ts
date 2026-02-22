"use client";

import { useState, useEffect } from "react";
import { fetchHbarUsd } from "../lib/hbarUsd";

export function useHbarUsd(): number | null {
  const [rate, setRate] = useState<number | null>(null);
  useEffect(() => {
    fetchHbarUsd().then(setRate);
  }, []);
  return rate;
}
