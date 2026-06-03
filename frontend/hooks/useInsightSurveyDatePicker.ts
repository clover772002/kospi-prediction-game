"use client";

import { useMemo, useEffect, useState } from "react";
import { getToday, getDashboard, type DashboardData, type TodaySurvey } from "@/lib/api";
import { peekDashboardSnapshot, peekSurveyTodaySnapshot } from "@/lib/tab-session-cache";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function uniqueSortedDesc(dates: string[]): string[] {
  return [...new Set(dates)].sort((a, b) => b.localeCompare(a));
}

/** 상점·대시보드 인사이트: 열람 기준 거래일 목록 (히스토리·공개 이력·오늘 설문) */
export function useInsightSurveyDatePicker(accessToken: string | null) {
  const [recentResultDates, setRecentResultDates] = useState<string[]>([]);
  const [dash, setDash] = useState<DashboardData | null>(null);
  const [today, setToday] = useState<TodaySurvey | null>(null);

  useEffect(() => {
    let alive = true;
    void fetch("/api/public/history", { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { history?: Array<{ date?: string }> }) => {
        const dates = (j.history ?? [])
          .map((row) => row.date)
          .filter((d): d is string => typeof d === "string" && DATE_RE.test(d));
        if (alive) setRecentResultDates(dates);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const snap = peekSurveyTodaySnapshot();
    if (snap?.today) {
      setToday(snap.today);
      return () => {
        alive = false;
      };
    }
    void getToday()
      .then((t) => {
        if (alive) setToday(t);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!accessToken) return;
    let alive = true;
    const snap = peekDashboardSnapshot();
    if (snap?.dash?.history?.length) {
      setDash(snap.dash);
      return () => {
        alive = false;
      };
    }
    void getDashboard(accessToken)
      .then((d) => {
        if (alive) setDash(d);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [accessToken]);

  const isWeekendKST = useMemo(() => {
    const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
    const day = kst.getDay();
    return day === 0 || day === 6;
  }, []);

  const canIncludeTodaySurvey = !!(
    today &&
    !isWeekendKST &&
    (today.status === "open" || today.status === "closed" || today.status === "result") &&
    today.survey_date
  );

  const dateOptions = useMemo(() => {
    const fromHistory = (dash?.history ?? []).map((h) => h.date).filter(Boolean);
    const extras: string[] = [];
    if (canIncludeTodaySurvey && today?.survey_date) extras.push(today.survey_date);
    return uniqueSortedDesc([...recentResultDates, ...fromHistory, ...extras]);
  }, [dash?.history, recentResultDates, canIncludeTodaySurvey, today?.survey_date]);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    if (dateOptions.length === 0) {
      setSelectedDate(null);
      return;
    }
    setSelectedDate((prev) => {
      if (prev && dateOptions.includes(prev)) return prev;
      return dateOptions[0];
    });
  }, [dateOptions]);

  return { dateOptions, selectedDate, setSelectedDate };
}
