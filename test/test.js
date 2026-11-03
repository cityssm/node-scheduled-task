/* eslint-disable @typescript-eslint/no-unsafe-type-assertion */
/* eslint-disable @typescript-eslint/no-magic-numbers */
/* eslint-disable node-test/no-async-describe */
import assert from 'node:assert';
import { describe, it } from 'node:test';
import { promisify } from 'node:util';
import { alreadyStartedErrorMessage, notStartedErrorMessage } from '../errors.js';
import { ScheduledTask } from '../index.js';
// eslint-disable-next-line @typescript-eslint/strict-void-return
const delay = promisify(setTimeout);
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
        assert.ok(task.canRunTask());
        // Run the task, then ensure it can't run again.
        task.setMinimumIntervalMillis(minimumIntervalMillis);
        const millisBefore = task.getLastRunMillis();
        await task.runTask();
        assert.strictEqual(executionCount, 1);
        assert.ok(task.getLastRunMillis() > millisBefore);
        assert.ok(!task.canRunTask());
        // Ensure the task can't be stopped before it's started.
        assert.throws(() => {
            task.stopTask();
        }, (error) => error.message === notStartedErrorMessage);
        // Start the task
        task.startTask();
        // Ensure the task can't be started again.
        assert.throws(() => {
            task.startTask();
        }, (error) => error.message === alreadyStartedErrorMessage);
        // Ensure the minimum interval can't be changed after the task has started.
        assert.throws(() => {
            task.setMinimumIntervalMillis(0);
        }, (error) => error.message === alreadyStartedErrorMessage);
        // Ensure the schedule can't be changed after the task has started.
        assert.throws(() => {
            task.setSchedule('* * * * * *');
        }, (error) => error.message === alreadyStartedErrorMessage);
        // Wait half the minimum interval, then ensure the task can't run.
        await delay(minimumIntervalMillis / 2);
        assert.strictEqual(executionCount, 1);
        assert.ok(!task.canRunTask());
        // Wait the other half of the minimum interval, then check the number of executions.
        await delay(minimumIntervalMillis / 2 + taskMillis + 1000);
        assert.strictEqual(executionCount, 2);
        // Stop the task
        task.stopTask();
        // Ensure the task can't be stopped again.
        assert.throws(() => {
            task.stopTask();
        }, (error) => error.message === notStartedErrorMessage);
        // Wait the minimum interval, then ensure the task can run again.
        await delay(minimumIntervalMillis + 1000);
        assert.ok(task.canRunTask());
    });
});
