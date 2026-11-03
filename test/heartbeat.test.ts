import assert from 'node:assert'
import { describe, it } from 'node:test'

import { Range } from 'node-schedule'

import { ScheduledTask } from '../index.js'

await describe('scheduled-task/heartbeat', async () => {
  await it('should run', () => {
    const task = new ScheduledTask(
      'Hour Heartbeat',
      () => {
        // eslint-disable-next-line no-console
        console.log('heartbeat:', new Date().toISOString())
      },
      {
        schedule: {
          second: 0,
          minute: 0,
          hour: new Range(0, 23), // Every hour
        }
      }
    )

    task.startTask()

    // Ensure the task has started
    assert.ok(task.hasStarted())

    task.stopTask()

    // Ensure the task has stopped
    assert.ok(!task.hasStarted())
  })
})
