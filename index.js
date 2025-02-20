import { Sema } from 'async-sema';
import camelCase from 'camelcase';
import Debug from 'debug';
import exitHook from 'exit-hook';
import nodeSchedule from 'node-schedule';
import { DEBUG_NAMESPACE } from './debug.config.js';
import { alreadyStartedError } from './errors.js';
export class ScheduledTask {
    #taskName;
    #taskFunction;
    #debugNamespace;
    #debug;
    #semaphore = new Sema(1);
    #catchErrors;
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
    /**
     * Creates a new scheduled task.
     * @param taskName - The name of the task.
     * @param taskFunction - The function to run when the task is executed.
     * @param options - Options for the task.
     * @param options.schedule - The schedule for the task.
     * @param options.lastRunMillis - The last time the task was run.
     * @param options.minimumIntervalMillis - The minimum interval between task runs.
     * @param options.startTask - Whether to start the task on initialization.
     * @param options.catchErrors - Whether to catch errors thrown by the task.
     */
    constructor(taskName, taskFunction, options = {}) {
        this.#taskName = taskName;
        this.#taskFunction = taskFunction;
        this.#debugNamespace = `${DEBUG_NAMESPACE}:${camelCase(taskName)}`;
        this.#debug = Debug(this.#debugNamespace);
        if (options.schedule !== undefined) {
            this.setSchedule(options.schedule);
        }
        this.setLastRunMillis(options.lastRunMillis ?? 0);
        this.setMinimumIntervalMillis(options.minimumIntervalMillis ?? 0);
        this.#catchErrors = options.catchErrors ?? true;
        if (options.startTask ?? false) {
            this.startTask();
        }
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
    /**
     * Sets the minimum interval between task runs.
     * Can only be called before the task is started.
     * @param minimumIntervalMillis - The minimum interval between task runs.
     */
    setMinimumIntervalMillis(minimumIntervalMillis) {
        if (this.#taskHasStarted) {
            throw alreadyStartedError;
        }
        this.#minimumIntervalMillis = minimumIntervalMillis;
    }
    /**
     * Sets the schedule for the task.
     * Can only be called before the task is started.
     * @see https://www.npmjs.com/package/node-schedule#usage
     * @param schedule The schedule for the task.
     */
    setSchedule(schedule) {
        if (this.#taskHasStarted) {
            throw alreadyStartedError;
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
     * Runs the task once.
     */
    async runTask() {
        await this.#semaphore.acquire();
        let taskRun = false;
        try {
            if (Date.now() - this.#lastRunMillis >= this.#minimumIntervalMillis) {
                this.#debug('Running task');
                taskRun = true;
                await this.#taskFunction();
            }
        }
        catch (error) {
            this.#debug('Task errored:', error);
            if (!this.#catchErrors) {
                // eslint-disable-next-line @typescript-eslint/only-throw-error
                throw error;
            }
        }
        finally {
            this.#semaphore.release();
            if (taskRun) {
                this.setLastRunTime(new Date());
                this.#debug('Task run completed');
            }
            else {
                this.#debug('Task run skipped');
            }
        }
    }
    /**
     * Starts the task.
     */
    startTask() {
        if (this.#taskHasStarted) {
            throw alreadyStartedError;
        }
        this.#taskHasStarted = true;
        this.#job = nodeSchedule.scheduleJob(this.#taskName, this.#schedule, async () => {
            await this.runTask();
        });
        this.#debug(`Task started, first run at ${this.#job.nextInvocation().toString()}`);
        if (!this.#exitHookIsInitialized) {
            exitHook(() => {
                try {
                    this.#job?.cancel();
                }
                catch {
                    // Ignore errors
                }
            });
            this.#exitHookIsInitialized = true;
        }
    }
    /**
     * Whether the task has started or not.
     * @returns `true` if the task has started, `false` otherwise.
     */
    hasStarted() {
        return this.#taskHasStarted;
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
export * as nodeSchedule from 'node-schedule';
