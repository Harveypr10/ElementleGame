import { db } from "../server/db";
import { DatabaseStorage } from "../server/storage";
import { sql } from "drizzle-orm";

async function recalculateAllStats() {
  console.log("Starting bulk stats recalculation...");
  
  const storage = new DatabaseStorage();
  
  // Get all unique user IDs from both game modes
  const regionUsersResult = await db.execute(sql`
    SELECT DISTINCT user_id FROM user_stats_region WHERE user_id IS NOT NULL
  `);
  const userModeUsersResult = await db.execute(sql`
    SELECT DISTINCT user_id FROM user_stats_user WHERE user_id IS NOT NULL
  `);
  
  const regionRows = Array.isArray(regionUsersResult) ? regionUsersResult : (regionUsersResult as any).rows || [];
  const userRows = Array.isArray(userModeUsersResult) ? userModeUsersResult : (userModeUsersResult as any).rows || [];
  
  // Combine unique user IDs from both tables
  const allUserIds = new Set<string>();
  for (const row of regionRows) {
    if (row.user_id) allUserIds.add(row.user_id);
  }
  for (const row of userRows) {
    if (row.user_id) allUserIds.add(row.user_id);
  }
  
  const userIdArray = Array.from(allUserIds);
  console.log(`Found ${userIdArray.length} unique users to recalculate`);
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const userId of userIdArray) {
    try {
      console.log(`Processing user: ${userId}`);
      
      // Recalculate Region mode stats
      try {
        const regionStats = await storage.recalculateUserStatsRegion(userId);
        console.log(`  Region - currentStreak: ${regionStats.currentStreak}, maxStreak: ${regionStats.maxStreak}`);
      } catch (e: any) {
        console.log(`  Region - skipped (${e.message})`);
      }
      
      // Recalculate User mode stats
      try {
        const userStats = await storage.recalculateUserStatsUser(userId);
        console.log(`  User - currentStreak: ${userStats.currentStreak}, maxStreak: ${userStats.maxStreak}`);
      } catch (e: any) {
        console.log(`  User - skipped (${e.message})`);
      }
      
      successCount++;
    } catch (error: any) {
      console.error(`  Error: ${error.message}`);
      errorCount++;
    }
  }
  
  console.log(`\nCompleted! Processed ${successCount} users successfully, ${errorCount} errors.`);
  process.exit(0);
}

recalculateAllStats().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
