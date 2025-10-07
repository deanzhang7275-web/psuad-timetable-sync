/**
 * PSUAD Timetable Auto Sync Script
 * ---------------------------------
 * 每天自动抓取 PSUAD Portal 的课表数据，生成 schedule.ics
 * 可用于 iPhone / Google / Outlook 日历订阅
 *
 * 作者: ChatGPT 2025
 */

import fs from "fs";
import fetch from "node-fetch";
import ics from "ics";

// PSUAD 接口
const url = "https://reg.psuad.ac.ae/PSUADPortal/Timetable/GetTimeTable";

// 从 GitHub Secrets 读取 cookie（你在 Settings → Secrets → Actions 添加的）
const COOKIE_ASPXAUTH = process.env.COOKIE_ASPXAUTH;
const COOKIE_SESSION = process.env.COOKIE_SESSION;

// 辅助函数：安全打印日志
function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

// 主函数：抓取课表数据
async function fetchSchedule() {
  log("Fetching schedule data...");

  if (!COOKIE_ASPXAUTH || !COOKIE_SESSION) {
    throw new Error("❌ 缺少 Cookie，请在 GitHub Secrets 中设置 COOKIE_ASPXAUTH 和 COOKIE_SESSION。");
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "Cookie": `.ASPXAUTH=${COOKIE_ASPXAUTH}`,
    },
    body: "r=0",
  });

  const text = await res.text();

  // 检查是否返回 HTML 登录页
  if (text.trim().startsWith("<!DOCTYPE")) {
    throw new Error("❌ 登录失效，请更新 COOKIE_ASPXAUTH 与 COOKIE_SESSION。");
  }

  // 尝试解析 JSON
  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    throw new Error("❌ 返回内容不是 JSON，可能是登录页或被防火墙拦截。");
  }

  if (!json.GetScheduleEventsList) {
    throw new Error("❌ 未找到 GetScheduleEventsList，接口返回异常。");
  }

  log(`✅ 获取到 ${json.GetScheduleEventsList.length} 条课程记录。`);
  return json.GetScheduleEventsList;
}

// 生成 ICS 文件
function makeICS(events) {
  log("Generating ICS file...");

  const icsEvents = events.map(e => {
    const startParts = e.EVEN_START.split(/[- :]/).map(Number);
    const endParts = e.EVENT_END.split(/[- :]/).map(Number);
    const start = [startParts[0], startParts[1], startParts[2], startParts[3], startParts[4]];
    const end = [endParts[0], endParts[1], endParts[2], endParts[3], endParts[4]];

    return {
      title: `${e.COURSE_TITLE.trim()} (${e.COURSE_CODE})`,
      start,
      end,
      location: e.ROOM_CODE,
      description: `Teacher: ${e.TEACHER_NAME}\nTerm: ${e.TERM_DESC}\nCRN: ${e.COURSE_CRN}`,
    };
  });

  const { error, value } = ics.createEvents(icsEvents);
  if (error) throw error;

  fs.writeFileSync("schedule.ics", value);
  log("📅 schedule.ics 文件已生成。");
}

// 主执行函数
(async () => {
  try {
    const events = await fetchSchedule();
    await makeICS(events);
    log("🎉 Timetable updated successfully!");
  } catch (err) {
    console.error("🚨 ERROR:", err.message);
  }
})();
