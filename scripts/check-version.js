
// require('dotenv').config({ path: '.env.local' });
// Mock fetch if needed or use node's native fetch (Node 18+)

async function checkVersion() {
    try {
        console.log("Fetching versions.json...");
        const res = await fetch("https://ddragon.leagueoflegends.com/api/versions.json", { next: { revalidate: 0 } }); // Force fresh
        if (!res.ok) {
            console.error("Fetch failed:", res.status);
            return;
        }
        const versions = await res.json();
        console.log("Top 5 Versions:", versions.slice(0, 5));
        console.log("Latest Version:", versions[0]);
    } catch (e) {
        console.error("Error:", e);
    }
}

checkVersion();
