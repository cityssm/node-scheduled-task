import nodeSchedule from 'node-schedule';
type TaskFunction = () => void | Promise<void>;
export interface ScheduledTaskOptions {
    schedule?: nodeSchedule.Spec;
    lastRunMillis?: number;
    minimumIntervalMillis?: number;
    startTask?: boolean;
    catchErrors?: boolean;
}
export declare class ScheduledTask {
    #private;
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
    constructor(taskName: string, taskFunction: TaskFunction, options?: ScheduledTaskOptions);
    setLastRunMillis(lastRunMillis: number): void;
    setLastRunTime(lastRun: Date): void;
    getLastRunMillis(): number;
    /**
     * Sets the minimum interval between task runs.
     * Can only be called before the task is started.
     * @param minimumIntervalMillis - The minimum interval between task runs.
     */
    setMinimumIntervalMillis(minimumIntervalMillis: number): void;
    /**
     * Sets the schedule for the task.
     * Can only be called before the task is started.
     * @see https://www.npmjs.com/package/node-schedule#usage
     * @param schedule The schedule for the task.
     */
    setSchedule(schedule: nodeSchedule.Spec): void;
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
    /**
     * Whether the task has started or not.
     * @returns `true` if the task has started, `false` otherwise.
     */
    hasStarted(): boolean;
    /**
     * Stops the task.
     */
    stopTask(): void;
}
export * as nodeSchedule from 'node-schedule';
