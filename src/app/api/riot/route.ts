export async function GET() {
  try {
        return Response.json({
            summonerName: "s4kuran4gi",
            matchId: "JP1_1234567890",
            role: "Top",
            match: {
                info: {
                    gameDuration: 1800,
                    participants: [
                        {
                            summonerName: "s4kuran4gi",
                            championName: "Aatrox",
                            kills: 10,
                            deaths:4,
                            assists: 6,
                            win: true
                        },
                        {
                            summonerName: "EnemyTop",
                            championName: "Teemo",
                            kills: 5,
                            deaths: 3,
                            assists: 2,
                            win: false
                        }
                    ]
                }
            }
        })
    } catch (err) {
        console.log("🔥 Riot API error detail:", err);
        return new Response(JSON.stringify({ error: "Internal Server Error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
}
