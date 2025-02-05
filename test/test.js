import assert from 'node:assert';
import { describe, it } from 'node:test';
import Debug from 'debug';
import { DEBUG_ENABLE_NAMESPACES } from '../debug.config.js';
import { ScheduledTask } from '../index.js';
const delay = async (delayInMs) => 
// eslint-disable-next-line promise/avoid-new, @typescript-eslint/return-await
new Promise((resolve) => setTimeout(resolve, delayInMs));
Debug.enable(DEBUG_ENABLE_NAMESPACES);
await describe('scheduled-task', async () => {
    await it('should run', async () => {
        const taskMillis = 1000;
        const minimumIntervalMillis = taskMillis * 5;
        let executionCount = 0;
        const task = new ScheduledTask(`${taskMillis} ms test task`, async () => {
            await delay(taskMillis);
            executionCount += 1;
        }, {
            minimumIntervalMillis,
            schedule: '* * * * * *'
        });
        // Ensure the task can run.
        assert(task.canRunTask());
        // Run the task, then ensure it can't run again.
        task.setMinimumIntervalMillis(minimumIntervalMillis);
        const millisBefore = task.getLastRunMillis();
        await task.runTask();
        assert(executionCount === 1);
        assert(task.getLastRunMillis() > millisBefore);
        assert(!task.canRunTask());
        // Ensure the task can't be stopped before it's started.
        try {
            task.stopTask();
            assert(false);
        }
        catch { }
        // Start the task
        task.startTask();
        // Ensure the task can't be started again.
        try {
            task.startTask();
            assert(false);
        }
        catch { }
        // Ensure the minimum interval can't be changed after the task has started.
        try {
            task.setMinimumIntervalMillis(0);
            assert(false);
        }
        catch { }
        // Ensure the schedule can't be changed after the task has started.
        try {
            task.setSchedule('* * * * * *');
            assert(false);
        }
        catch { }
        // Wait half the minimum interval, then ensure the task can't run.
        await delay(minimumIntervalMillis / 2);
        assert(executionCount === 1); // eslint-disable-line @typescript-eslint/no-unnecessary-condition
        assert(!task.canRunTask());
        // Wait the other half of the minimum interval, then check the number of executions.
        await delay(minimumIntervalMillis / 2 + taskMillis + 1000);
        assert(executionCount === 2); // eslint-disable-line @typescript-eslint/no-unnecessary-condition
        // Stop the task
        task.stopTask();
        // Ensure the task can't be stopped again.
        try {
            task.stopTask();
            assert(false);
        }
        catch { }
        // Wait the minimum interval, then ensure the task can run again.
        await delay(minimumIntervalMillis + 1000);
        assert(task.canRunTask());
    });
});
