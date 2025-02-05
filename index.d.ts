import schedule from 'node-schedule';
type TaskFunction = () => void | Promise<void>;
export interface ScheduledTaskOptions {
    schedule?: schedule.Spec;
    lastRunMillis?: number;
    minimumIntervalMillis?: number;
    runTask?: boolean;
    startTask?: boolean;
}
export declare class ScheduledTask {
    #private;
    constructor(taskName: string, taskFunction: TaskFunction, options?: ScheduledTaskOptions);
    setLastRunMillis(lastRunMillis: number): void;
    setLastRunTime(lastRun: Date): void;
    getLastRunMillis(): number;
    setMinimumIntervalMillis(minimumIntervalMillis: number): void;
    /**
     * Sets the schedule for the task.
     * Can only be called before the task is started.
     * @see https://www.npmjs.com/package/node-schedule#usage
     * @param schedule The schedule for the task.
     */
    setSchedule(schedule: schedule.Spec): void;
    /**
     * Checks if the task can run.
     * The task can run if there are no other tasks waiting and the minimum interval has passed.
     * @returns `true` if the task can run, `false` otherwise.
     */
    canRunTask(): boolean;
    /**
     * Runs the task once.
     */
    runTask(): Promise<void>;
    /**
     * Starts the task.
     */
    startTask(): void;
    hasStarted(): boolean;
    /**
     * Stops the task.
     */
    stopTask(): void;
}
export * as nodeSchedule from 'node-schedule';
