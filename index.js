/**
 * PSUAD Timetable Auto Sync Script
 * 每天抓取 PSUAD 课表，输出 schedule.ics
 */

import fs from "fs";
import fetch from "node-fetch";
import ics from "ics";

const url = "https://reg.psuad.ac.ae/PSUADPortal/Timetable/GetTimeTable";

const COOKIE_ASPXAUTH = process.env.COOKIE_ASPXAUTH || "";
const COOKIE_SESSION  = process.env.COOKIE_SESSION || ""; // 你没有也不影响

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

async function fetchSchedule() {
  log("Fetching schedule data...");

  if (!COOKIE_ASPXAUTH) {
    throw new Error("缺少 COOKIE_ASPXAUTH（请到 GitHub Secrets 设置该值）");
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      // 模拟浏览器常见头
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "Accept": "application/json, text/javascript, */*; q=0.01",
      "X-Requested-With": "XMLHttpRequest",
      "Origin": "https://reg.psuad.ac.ae",
      "Referer": "https://reg.psuad.ac.ae/PSUADPortal/Timetable",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari",
      // 只要 ASPXAUTH 就够；SESSION 没有也可以
      "Cookie": `.ASPXAUTH=${COOKIE_ASPXAUTH}` + (COOKIE_SESSION ? `; ASP.NET_SessionId=${COOKIE_SESSION}` : "")
    },
    body: "r=0"
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }
  if (text.trim().startsWith("<!DOCTYPE")) {
    throw new Error("返回的是登录页（HTML）。Cookie 过期或无效，请重新从浏览器复制 .ASPXAUTH 并更新 Secrets。");
  }

  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    throw new Error("返回内容不是 JSON，可能被网关或防火墙拦截。");
  }

  if (!json.GetScheduleEventsList) {
    throw new Error("JSON 中没有 GetScheduleEventsList 字段。接口可能变更。");
  }

  const events = json.GetScheduleEventsList;
  log(`✅ 获取到 ${events.length} 条课程记录`);
  return events;
}

function makeICS(events) {
  log("Generating ICS...");

  const icsEvents = events.map(e => {
    const start = e.EVEN_START.split(/[- :]/).map(Number); // [Y,M,D,H,m]
    const end   = e.EVENT_END.split(/[- :]/).map(Number);

    return {
      title: `${(e.COURSE_TITLE || "").trim()} (${e.COURSE_CODE || ""})`,
      start: [start[0], start[1], start[2], start[3], start[4]],
      end:   [end[0],   end[1],   end[2],   end[3],   end[4]],
      location: e.ROOM_CODE || "",
      description: `Teacher: ${e.TEACHER_NAME || ""}\nTerm: ${e.TERM_DESC || ""}\nCRN: ${e.COURSE_CRN || ""}`
      // 如需固定时区，可加：timezone: "Asia/Dubai"
    };
  });

  const { error, value } = ics.createEvents(icsEvents);
  if (error) throw error;

  fs.writeFileSync("schedule.ics", value, "utf-8");
  log("📅 schedule.ics 已生成");
}

(async () => {
  try {
    const events = await fetchSchedule();
    makeICS(events);
    log("🎉 Timetable updated successfully");
  } catch (err) {
    console.error("🚨 ERROR:", err.message);
    // 让“Run npm start”这一步直接失败，便于你看到真实原因
    process.exit(1);
  }
})();
