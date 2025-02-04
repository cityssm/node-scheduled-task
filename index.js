import { Sema } from 'async-sema';
import camelCase from 'camelcase';
import Debug from 'debug';
import exitHook from 'exit-hook';
import schedule from 'node-schedule';
import { DEBUG_NAMESPACE } from './debug.config.js';
export class ScheduledTask {
    #taskName;
    #taskFunction;
    #debug;
    #semaphore = new Sema(1);
    #lastRunMillis;
    #minimumIntervalMillis;
    #taskHasStarted = false;
    #job;
    #schedule = {
        second: 0,
        minute: 0,
        hour: 0,
        dayOfWeek: '*',
        month: '*',
        year: '*'
    };
    #exitHookIsInitialized = false;
    constructor(taskName, taskFunction, options = {}) {
        this.#taskName = taskName;
        this.#taskFunction = taskFunction;
        this.#debug = Debug(`${DEBUG_NAMESPACE}:${camelCase(this.#taskName)}`);
        if (options.schedule !== undefined) {
            this.setSchedule(options.schedule);
        }
        this.setLastRunMillis(options.lastRunMillis ?? 0);
        this.setMinimumIntervalMillis(options.minimumIntervalMillis ?? 0);
    }
    setLastRunMillis(lastRunMillis) {
        this.#lastRunMillis = lastRunMillis;
    }
    setLastRunTime(lastRun) {
        this.setLastRunMillis(lastRun.getTime());
    }
    getLastRunMillis() {
        return this.#lastRunMillis;
    }
    setMinimumIntervalMillis(minimumIntervalMillis) {
        if (this.#taskHasStarted) {
            throw new Error('Task has already started.');
        }
        this.#minimumIntervalMillis = minimumIntervalMillis;
    }
    setSchedule(schedule) {
        if (this.#taskHasStarted) {
            throw new Error('Task has already started.');
        }
        this.#schedule = schedule;
    }
    /**
     * Checks if the task can run.
     * The task can run if there are no other tasks waiting and the minimum interval has passed.
     * @returns `true` if the task can run, `false` otherwise.
     */
    canRunTask() {
        return (this.#semaphore.nrWaiting() === 0 &&
            Date.now() - this.#lastRunMillis >= this.#minimumIntervalMillis);
    }
    /**
     * Runs the task.
     */
    async runTask() {
        await this.#semaphore.acquire();
        try {
            if (Date.now() - this.#lastRunMillis >= this.#minimumIntervalMillis) {
                this.#debug('Running task');
                await this.#taskFunction();
                this.setLastRunTime(new Date());
            }
            else {
                this.#debug('Skipping task');
            }
        }
        finally {
            this.#semaphore.release();
        }
    }
    /**
     * Starts the task.
     */
    startTask() {
        if (this.#taskHasStarted) {
            throw new Error('Task has already started.');
        }
        this.#taskHasStarted = true;
        this.#job = schedule.scheduleJob(this.#taskName, this.#schedule, async () => {
            await this.runTask();
        });
        this.#debug(`Task started, first run at ${this.#job.nextInvocation().toString()}`);
        if (!this.#exitHookIsInitialized) {
            exitHook(() => {
                try {
                    this.#job?.cancel();
                }
                catch (error) {
                    this.#debug('Error cancelling job for task', error);
                }
            });
            this.#exitHookIsInitialized = true;
        }
    }
    /**
     * Stops the task.
     */
    stopTask() {
        if (!this.#taskHasStarted) {
            throw new Error('Task has not started.');
        }
        this.#debug('Stopping task');
        this.#job?.cancel();
        this.#taskHasStarted = false;
    }
}
