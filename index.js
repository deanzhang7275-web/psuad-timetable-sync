import fs from "fs";
import fetch from "node-fetch";
import ics from "ics";

const url = "https://reg.psuad.ac.ae/PSUADPortal/Timetable/GetTimeTable";

async function fetchSchedule() {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    },
    body: "r=0", // PSUAD的API要求POST参数r=0
  });
  const data = await res.json();
  return data.GetScheduleEventsList || [];
}

function makeICS(events) {
  const icsEvents = events.map(e => {
    // 解析日期时间
    const startParts = e.EVEN_START.split(/[- :]/).map(Number);
    const endParts = e.EVENT_END.split(/[- :]/).map(Number);
    return {
      title: `${e.COURSE_TITLE.trim()} (${e.COURSE_CODE})`,
      start: [startParts[0], startParts[1], startParts[2], startParts[3], startParts[4]],
      end: [endParts[0], endParts[1], endParts[2], endParts[3], endParts[4]],
      location: e.ROOM_CODE,
      description: `Teacher: ${e.TEACHER_NAME}`,
    };
  });

  const { error, value } = ics.createEvents(icsEvents);
  if (error) throw error;
  fs.writeFileSync("schedule.ics", value);
}

(async () => {
  try {
    const events = await fetchSchedule();
    makeICS(events);
    console.log(`✅ Schedule updated with ${events.length} events`);
  } catch (err) {
    console.error("❌ Error:", err);
  }
})();
