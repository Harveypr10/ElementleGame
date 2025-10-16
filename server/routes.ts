// Server routes for Elementle app with Replit Auth integration
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup Replit Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Guest check endpoint (no auth required)
  app.get("/api/auth/check", async (req: any, res) => {
    if (req.isAuthenticated()) {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json({ isAuthenticated: true, user });
    } else {
      res.json({ isAuthenticated: false, user: null });
    }
  });

  // Puzzle routes
  app.get("/api/puzzles", async (req, res) => {
    try {
      const puzzles = await storage.getAllPuzzles();
      res.json(puzzles);
    } catch (error) {
      console.error("Error fetching puzzles:", error);
      res.status(500).json({ message: "Failed to fetch puzzles" });
    }
  });

  app.get("/api/puzzles/:date", async (req, res) => {
    try {
      const puzzle = await storage.getPuzzleByDate(req.params.date);
      if (!puzzle) {
        return res.status(404).json({ message: "Puzzle not found" });
      }
      res.json(puzzle);
    } catch (error) {
      console.error("Error fetching puzzle:", error);
      res.status(500).json({ message: "Failed to fetch puzzle" });
    }
  });

  // User settings routes
  app.get("/api/settings", async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const settings = await storage.getUserSettings(userId);
      res.json(settings || null);
    } catch (error) {
      console.error("Error fetching settings:", error);
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  app.post("/api/settings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const settings = await storage.upsertUserSettings({
        userId,
        ...req.body,
      });
      res.json(settings);
    } catch (error) {
      console.error("Error updating settings:", error);
      res.status(500).json({ message: "Failed to update settings" });
    }
  });

  // Game attempt routes
  app.post("/api/game-attempts", async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || null;
      const attempt = await storage.createGameAttempt({
        userId,
        ...req.body,
      });
      res.json(attempt);
    } catch (error) {
      console.error("Error creating game attempt:", error);
      res.status(500).json({ message: "Failed to create game attempt" });
    }
  });

  app.get("/api/game-attempts/user", async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const attempts = await storage.getGameAttemptsByUser(userId);
      res.json(attempts);
    } catch (error) {
      console.error("Error fetching game attempts:", error);
      res.status(500).json({ message: "Failed to fetch game attempts" });
    }
  });

  app.get("/api/game-attempts/puzzle/:puzzleId", async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || null;
      const puzzleId = parseInt(req.params.puzzleId);
      const attempt = await storage.getGameAttemptByUserAndPuzzle(userId, puzzleId);
      res.json(attempt || null);
    } catch (error) {
      console.error("Error fetching game attempt:", error);
      res.status(500).json({ message: "Failed to fetch game attempt" });
    }
  });

  // Guess routes
  app.post("/api/guesses", async (req, res) => {
    try {
      const guess = await storage.createGuess(req.body);
      res.json(guess);
    } catch (error) {
      console.error("Error creating guess:", error);
      res.status(500).json({ message: "Failed to create guess" });
    }
  });

  app.get("/api/guesses/attempt/:attemptId", async (req, res) => {
    try {
      const attemptId = parseInt(req.params.attemptId);
      const guesses = await storage.getGuessesByGameAttempt(attemptId);
      res.json(guesses);
    } catch (error) {
      console.error("Error fetching guesses:", error);
      res.status(500).json({ message: "Failed to fetch guesses" });
    }
  });

  // User stats routes
  app.get("/api/stats", async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const stats = await storage.getUserStats(userId);
      res.json(stats || null);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  app.post("/api/stats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const stats = await storage.upsertUserStats({
        userId,
        ...req.body,
      });
      res.json(stats);
    } catch (error) {
      console.error("Error updating stats:", error);
      res.status(500).json({ message: "Failed to update stats" });
    }
  });

  // Admin export route
  app.get("/api/admin/export", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Forbidden: Admin access required" });
      }

      const format = req.query.format || 'json';
      const data = await storage.getAllGameAttemptsForExport();

      if (format === 'csv') {
        const csv = convertToCSV(data);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=elementle-export-${new Date().toISOString().split('T')[0]}.csv`);
        res.send(csv);
      } else {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=elementle-export-${new Date().toISOString().split('T')[0]}.json`);
        res.json(data);
      }
    } catch (error) {
      console.error("Error exporting data:", error);
      res.status(500).json({ message: "Failed to export data" });
    }
  });

  function convertToCSV(data: any[]): string {
    if (!data || data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];
    
    for (const row of data) {
      const values = headers.map(header => {
        const value = row[header];
        const escaped = ('' + value).replace(/"/g, '""');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(','));
    }
    
    return csvRows.join('\n');
  }

  const httpServer = createServer(app);
  return httpServer;
}
