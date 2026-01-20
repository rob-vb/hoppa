import { v } from "convex/values";
import { query } from "./_generated/server";

// Dashboard statistics for a date range with comparison to previous period
export const getDashboardStats = query({
  args: {
    userId: v.id("users"),
    startDate: v.number(),
    endDate: v.number(),
  },
  handler: async (ctx, args) => {
    const { userId, startDate, endDate } = args;

    // Calculate previous period range (same duration, immediately before)
    const periodDuration = endDate - startDate;
    const prevStartDate = startDate - periodDuration;
    const prevEndDate = startDate;

    // Get all completed sessions for the user
    const allSessions = await ctx.db
      .query("workoutSessions")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", userId).eq("status", "completed")
      )
      .collect();

    // Filter sessions by date range
    const currentSessions = allSessions.filter(
      (s) => s.completedAt && s.completedAt >= startDate && s.completedAt <= endDate
    );
    const prevSessions = allSessions.filter(
      (s) => s.completedAt && s.completedAt >= prevStartDate && s.completedAt < prevEndDate
    );

    // Get exercise logs for current period sessions
    const currentSessionIds = new Set(currentSessions.map((s) => s._id));
    const prevSessionIds = new Set(prevSessions.map((s) => s._id));

    // Get all exercise logs for these sessions
    const allExerciseLogs = await Promise.all(
      [...currentSessionIds, ...prevSessionIds].map(async (sessionId) => {
        const logs = await ctx.db
          .query("exerciseLogs")
          .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
          .collect();
        return { sessionId, logs };
      })
    );

    // Organize logs by session
    const logsBySession = new Map(
      allExerciseLogs.map(({ sessionId, logs }) => [sessionId, logs])
    );

    // Count progressions for current period
    let currentProgressionCount = 0;
    for (const sessionId of currentSessionIds) {
      const logs = logsBySession.get(sessionId) || [];
      currentProgressionCount += logs.filter((l) => l.progressionEarned).length;
    }

    // Count progressions for previous period
    let prevProgressionCount = 0;
    for (const sessionId of prevSessionIds) {
      const logs = logsBySession.get(sessionId) || [];
      prevProgressionCount += logs.filter((l) => l.progressionEarned).length;
    }

    // Get set logs for volume/reps calculation
    const currentExerciseLogIds: string[] = [];
    const prevExerciseLogIds: string[] = [];

    for (const sessionId of currentSessionIds) {
      const logs = logsBySession.get(sessionId) || [];
      currentExerciseLogIds.push(...logs.map((l) => l._id));
    }
    for (const sessionId of prevSessionIds) {
      const logs = logsBySession.get(sessionId) || [];
      prevExerciseLogIds.push(...logs.map((l) => l._id));
    }

    // Fetch set logs in batches
    const fetchSetLogs = async (exerciseLogIds: string[]) => {
      const results = await Promise.all(
        exerciseLogIds.map(async (exerciseLogId) => {
          const setLogs = await ctx.db
            .query("setLogs")
            .withIndex("by_exercise_log", (q) =>
              q.eq("exerciseLogId", exerciseLogId as any)
            )
            .collect();
          // Get the exercise log for weight info
          const exerciseLog = [...logsBySession.values()]
            .flat()
            .find((l) => l._id === exerciseLogId);
          return { setLogs, totalWeight: exerciseLog?.totalWeight || 0 };
        })
      );
      return results;
    };

    const currentSetLogData = await fetchSetLogs(currentExerciseLogIds);
    const prevSetLogData = await fetchSetLogs(prevExerciseLogIds);

    // Calculate volume and reps for current period
    let currentTotalVolume = 0;
    let currentTotalReps = 0;
    for (const { setLogs, totalWeight } of currentSetLogData) {
      for (const setLog of setLogs) {
        if (setLog.completedReps !== undefined) {
          currentTotalReps += setLog.completedReps;
          currentTotalVolume += setLog.completedReps * totalWeight;
        }
      }
    }

    // Calculate volume and reps for previous period
    let prevTotalVolume = 0;
    let prevTotalReps = 0;
    for (const { setLogs, totalWeight } of prevSetLogData) {
      for (const setLog of setLogs) {
        if (setLog.completedReps !== undefined) {
          prevTotalReps += setLog.completedReps;
          prevTotalVolume += setLog.completedReps * totalWeight;
        }
      }
    }

    return {
      workoutCount: currentSessions.length,
      progressionCount: currentProgressionCount,
      totalVolume: Math.round(currentTotalVolume),
      totalReps: currentTotalReps,
      workoutCountDiff: currentSessions.length - prevSessions.length,
      progressionCountDiff: currentProgressionCount - prevProgressionCount,
      totalVolumeDiff: Math.round(currentTotalVolume - prevTotalVolume),
      totalRepsDiff: currentTotalReps - prevTotalReps,
    };
  },
});

// Get all exercises with their progress data
export const getExercisesWithProgress = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    // Get all schemas for this user
    const schemas = await ctx.db
      .query("schemas")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const result: Array<{
      exerciseId: string;
      name: string;
      dayName: string;
      schemaName: string;
      currentWeight: number;
      startingWeight: number;
      progressionCount: number;
      progressionDates: number[];
      weightHistory: Array<{ date: number; weight: number }>;
    }> = [];

    // Process each schema
    for (const schema of schemas) {
      // Get days for this schema
      const days = await ctx.db
        .query("workoutDays")
        .withIndex("by_schema", (q) => q.eq("schemaId", schema._id))
        .collect();

      // Sort days by orderIndex
      days.sort((a, b) => a.orderIndex - b.orderIndex);

      for (const day of days) {
        // Get exercises for this day
        const exercises = await ctx.db
          .query("exercises")
          .withIndex("by_day", (q) => q.eq("dayId", day._id))
          .collect();

        // Sort exercises by orderIndex
        exercises.sort((a, b) => a.orderIndex - b.orderIndex);

        for (const exercise of exercises) {
          // Get all exercise logs for this exercise
          const exerciseLogs = await ctx.db
            .query("exerciseLogs")
            .withIndex("by_exercise", (q) => q.eq("exerciseId", exercise._id))
            .collect();

          // Get completed sessions to filter and order logs
          const sessionMap = new Map<
            string,
            { completedAt: number | undefined; status: string }
          >();
          for (const log of exerciseLogs) {
            const sessionKey = log.sessionId as string;
            if (!sessionMap.has(sessionKey)) {
              const session = await ctx.db.get(log.sessionId);
              if (session) {
                sessionMap.set(sessionKey, {
                  completedAt: session.completedAt,
                  status: session.status,
                });
              }
            }
          }

          // Filter to completed sessions and completed exercise logs
          const completedLogs = exerciseLogs.filter((log) => {
            const session = sessionMap.get(log.sessionId as string);
            return session?.status === "completed" && log.status === "completed";
          });

          // Sort by completed date
          completedLogs.sort((a, b) => {
            const sessionA = sessionMap.get(a.sessionId as string);
            const sessionB = sessionMap.get(b.sessionId as string);
            return (sessionA?.completedAt || 0) - (sessionB?.completedAt || 0);
          });

          // Build weight history
          const weightHistory = completedLogs.map((log) => {
            const session = sessionMap.get(log.sessionId as string);
            return {
              date: session?.completedAt || 0,
              weight: log.totalWeight,
            };
          });

          // Get progression dates
          const progressionDates = completedLogs
            .filter((log) => log.progressionEarned)
            .map((log) => {
              const session = sessionMap.get(log.sessionId as string);
              return session?.completedAt || 0;
            });

          const startingWeight =
            weightHistory.length > 0 ? weightHistory[0].weight : exercise.currentWeight;

          result.push({
            exerciseId: exercise._id,
            name: exercise.name,
            dayName: day.name,
            schemaName: schema.name,
            currentWeight: exercise.currentWeight,
            startingWeight,
            progressionCount: progressionDates.length,
            progressionDates,
            weightHistory,
          });
        }
      }
    }

    return result;
  },
});

// Get workout calendar data for a month
export const getWorkoutCalendar = query({
  args: {
    userId: v.id("users"),
    year: v.number(),
    month: v.number(), // 1-12
  },
  handler: async (ctx, args) => {
    const { userId, year, month } = args;

    // Calculate month boundaries
    const startOfMonth = new Date(year, month - 1, 1).getTime();
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999).getTime();

    // Get all sessions for this user
    const sessions = await ctx.db
      .query("workoutSessions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Filter to sessions within the month
    const monthSessions = sessions.filter(
      (s) => s.startedAt >= startOfMonth && s.startedAt <= endOfMonth
    );

    // Group by day
    const dayMap = new Map<
      string,
      { hasWorkout: boolean; isCompleted: boolean; count: number }
    >();

    for (const session of monthSessions) {
      const date = new Date(session.startedAt);
      const dayKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

      const existing = dayMap.get(dayKey) || {
        hasWorkout: false,
        isCompleted: false,
        count: 0,
      };
      existing.hasWorkout = true;
      existing.count++;
      if (session.status === "completed") {
        existing.isCompleted = true;
      }
      dayMap.set(dayKey, existing);
    }

    // Generate all days of the month
    const daysInMonth = new Date(year, month, 0).getDate();
    const result: Array<{
      date: number;
      hasWorkout: boolean;
      isCompleted: boolean;
      workoutCount: number;
    }> = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day);
      const dayKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      const data = dayMap.get(dayKey);

      result.push({
        date: date.getTime(),
        hasWorkout: data?.hasWorkout ?? false,
        isCompleted: data?.isCompleted ?? false,
        workoutCount: data?.count ?? 0,
      });
    }

    return result;
  },
});
