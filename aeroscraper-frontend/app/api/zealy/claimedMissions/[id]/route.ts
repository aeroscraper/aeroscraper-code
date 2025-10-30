import { ZealyMission } from "@/components/MissionCard";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {

  const zealyId = req.nextUrl.searchParams.get("id") || "";

  const resultMissions = await fetch("https://api.zealy.io/communities/aeroscraper/quests", {
    headers: {
      "x-api-key": `${process.env.NEXT_PUBLIC_ZEALY_API_KEY}`
    },
    method: req.method,
    cache: "no-cache"
  });

  const missions = await resultMissions.json();

  const missionsIds = missions.map((item: any) => `&quest_id=${item.id}`).join('');

  const [resultClaimsIsDaily, resultClaimsIsOnce] = await Promise.all([
    fetch(`https://api-v1.zealy.io/communities/aeroscraper/claimed-quests?user_id=${zealyId}${missionsIds}&recurrence=once`, {
      headers: {
        "x-api-key": `${process.env.NEXT_PUBLIC_ZEALY_API_KEY}`
      },
      method: req.method,
      cache: "no-cache"
    }),
    fetch(`https://api-v1.zealy.io/communities/aeroscraper/claimed-quests?user_id=${zealyId}${missionsIds}&recurrence=daily&sortBy=updatedAt`, {
      headers: {
        "x-api-key": `${process.env.NEXT_PUBLIC_ZEALY_API_KEY}`
      },
      method: req.method,
      cache: "no-cache"
    })
  ]);
  
  const resultClaimsIsDailyJson = await resultClaimsIsDaily.json();
  const resultClaimsIsOnceJson = await resultClaimsIsOnce.json();
  
  const claimedMissions = [...resultClaimsIsDailyJson.data || [], ...resultClaimsIsOnceJson?.data || []];

  let tempMissionList = missions.reduce((acc: Record<string, ZealyMission>, mission: ZealyMission) => {
    return {
      ...acc,
      [mission.id]: {
        ...mission,
        currentXP: 0,
        status: null
      }
    };
  }, {});

  claimedMissions?.forEach((claim: any) => {
    const { questId, xp, status } = claim;

    if (tempMissionList[questId]) {
      tempMissionList[questId].currentXP = xp;
      tempMissionList[questId].status = status;
    }
  }); 

  if (resultMissions.status !== 200) {
    return NextResponse.json({
      status: resultMissions.status,
      msg: "There was a problem",
    });
  } else {
    return NextResponse.json(tempMissionList);
  }
}
