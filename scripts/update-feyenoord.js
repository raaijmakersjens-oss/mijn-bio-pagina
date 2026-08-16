// Haalt de eerstvolgende wedstrijd en de laatste uitslag van Feyenoord op
// via football-data.org (v4) en schrijft die naar feyenoord.json.
// Wordt uitgevoerd door .github/workflows/update-feyenoord.yml.

const FEYENOORD_TEAM_ID = 675;
const token = process.env.FOOTBALL_DATA_TOKEN;

if (!token) {
  console.error("FOOTBALL_DATA_TOKEN ontbreekt.");
  process.exit(1);
}

function simplifyMatch(match) {
  return {
    utcDate: match.utcDate,
    competition: match.competition.name,
    homeTeam: match.homeTeam.name,
    awayTeam: match.awayTeam.name,
    homeTeamId: match.homeTeam.id,
    ...(match.status === "FINISHED"
      ? {
          homeScore: match.score.fullTime.home,
          awayScore: match.score.fullTime.away,
        }
      : {}),
  };
}

async function fetchMatches(status) {
  const response = await fetch(
    `https://api.football-data.org/v4/teams/${FEYENOORD_TEAM_ID}/matches?status=${status}&limit=10`,
    { headers: { "X-Auth-Token": token } }
  );

  if (!response.ok) {
    throw new Error(`API-fout: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  return data.matches || [];
}

async function main() {
  // Losse calls i.p.v. status=SCHEDULED,FINISHED in één call: de API laat bij
  // een gecombineerde statusfilter soms de eerstvolgende (TIMED) wedstrijd weg.
  const [scheduled, finished] = await Promise.all([
    fetchMatches("SCHEDULED"),
    fetchMatches("FINISHED"),
  ]);

  const upcoming = scheduled.sort(
    (a, b) => new Date(a.utcDate) - new Date(b.utcDate)
  )[0];

  const lastResult = finished.sort(
    (a, b) => new Date(b.utcDate) - new Date(a.utcDate)
  )[0];

  const output = {
    updatedAt: new Date().toISOString(),
    teamId: FEYENOORD_TEAM_ID,
    upcoming: upcoming ? simplifyMatch(upcoming) : null,
    lastResult: lastResult ? simplifyMatch(lastResult) : null,
  };

  const fs = await import("node:fs/promises");
  await fs.writeFile("feyenoord.json", JSON.stringify(output, null, 2) + "\n");
  console.log("feyenoord.json bijgewerkt.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
