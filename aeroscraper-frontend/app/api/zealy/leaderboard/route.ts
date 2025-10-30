import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";
export async function GET(req: NextRequest) {

  const result = await fetch("https://db.aeroscraper.io/api/collections/leaderboard/records?page=1&perPage=500&sort=-xp", {
    headers: {
      "x-api-key": `${process.env.NEXT_PUBLIC_ZEALY_API_KEY}`
    },
    method: req.method,
    cache: "no-cache"
  });

  const data = await result.json()

  if (result.status !== 200) {
    return NextResponse.json({
      status: result.status,
      msg: "There was a problem",
    });
  } else {
    return NextResponse.json(data);
  }
}
