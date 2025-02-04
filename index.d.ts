import schedule from 'node-schedule';
type TaskFunction = () => void | Promise<void>;
export interface ScheduledTaskOptions {
    schedule?: schedule.Spec;
    lastRunMillis?: number;
    minimumIntervalMillis?: number;
}
export declare class ScheduledTask {
    #private;
    constructor(taskName: string, taskFunction: TaskFunction, options?: ScheduledTaskOptions);
    setLastRunMillis(lastRunMillis: number): void;
    setLastRunTime(lastRun: Date): void;
    getLastRunMillis(): number;
    setMinimumIntervalMillis(minimumIntervalMillis: number): void;
    setSchedule(schedule: schedule.Spec): void;
    /**
     * Checks if the task can run.
     * The task can run if there are no other tasks waiting and the minimum interval has passed.
     * @returns `true` if the task can run, `false` otherwise.
     */
    canRunTask(): boolean;
    /**
     * Runs the task.
     */
    runTask(): Promise<void>;
    /**
     * Starts the task.
     */
    startTask(): void;
    /**
     * Stops the task.
     */
    stopTask(): void;
}
export {};
