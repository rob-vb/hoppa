// Mock for convex/_generated/api
module.exports = {
  api: {
    schemas: {
      create: 'schemas:create',
      update: 'schemas:update',
      remove: 'schemas:remove',
      list: 'schemas:list',
    },
    workoutDays: {
      create: 'workoutDays:create',
      update: 'workoutDays:update',
      remove: 'workoutDays:remove',
      listBySchema: 'workoutDays:listBySchema',
    },
    exercises: {
      create: 'exercises:create',
      update: 'exercises:update',
      remove: 'exercises:remove',
      listByDay: 'exercises:listByDay',
    },
    workoutSessions: {
      createDirect: 'workoutSessions:createDirect',
      complete: 'workoutSessions:complete',
      abandon: 'workoutSessions:abandon',
    },
    exerciseLogs: {
      createDirect: 'exerciseLogs:createDirect',
      complete: 'exerciseLogs:complete',
      skip: 'exerciseLogs:skip',
    },
    setLogs: {
      createDirect: 'setLogs:createDirect',
      logReps: 'setLogs:logReps',
      clearReps: 'setLogs:clearReps',
    },
  },
};
