import fs from "fs";
import fetch from "node-fetch";
import ics from "ics";

const url = "https://reg.psuad.ac.ae/PSUADPortal/Timetable/GetTimeTable";

// 从 PSUAD 接口抓取数据
async function fetchSchedule() {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    },
    body: "r=0", // 按你的截图示例
  });
  const data = await res.json();
  return data.GetScheduleEventsList || [];
}

// 转换为 .ics 文件
function makeICS(events) {
  const icsEvents = events.map(e => ({
    title: `${e.COURSE_TITLE} (${e.COURSE_CODE})`,
    start: e.EVEN_START.split(/[- :]/).map(Number),
    end: e.EVENT_END.split(/[- :]/).map(Number),
    location: e.ROOM_CODE,
    description: `Teacher: ${e.TEACHER_NAME}`,
  }));

  const { error, value } = ics.createEvents(icsEvents);
  if (error) throw error;
  fs.writeFileSync("schedule.ics", value);
}

(async () => {
  const events = await fetchSchedule();
  makeICS(events);
  console.log("✅ schedule.ics updated");
})();
