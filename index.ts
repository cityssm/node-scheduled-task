import { Sema } from 'async-sema'
import camelCase from 'camelcase'
import Debug from 'debug'
import exitHook from 'exit-hook'
import nodeSchedule from 'node-schedule'

import { DEBUG_NAMESPACE } from './debug.config.js'
import { alreadyStartedError } from './errors.js'

type TaskFunction = () => Promise<void> | void

export interface ScheduledTaskOptions {
  schedule?: nodeSchedule.Spec
  lastRunMillis?: number
  minimumIntervalMillis?: number
  startTask?: boolean
  catchErrors?: boolean
}

export class ScheduledTask {
  readonly #taskFunction: TaskFunction
  readonly #taskName: string

  readonly #debug: Debug.Debugger
  readonly #debugNamespace: string

  readonly #semaphore = new Sema(1)

  readonly #catchErrors: boolean

  #lastRunMillis: number
  #minimumIntervalMillis: number

  #taskHasStarted = false

  #job: nodeSchedule.Job | null | undefined
  #schedule: nodeSchedule.Spec = {
    second: 0,
    minute: 0,
    hour: 0,
    dayOfWeek: '*',
    month: '*',
    year: '*'
  }

  #exitHookIsInitialized = false

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
  constructor(
    taskName: string,
    taskFunction: TaskFunction,
    options: ScheduledTaskOptions = {}
  ) {
    this.#taskName = taskName
    this.#taskFunction = taskFunction

    this.#debugNamespace = `${DEBUG_NAMESPACE}:${camelCase(taskName)}`
    this.#debug = Debug(this.#debugNamespace)

    if (options.schedule !== undefined) {
      this.setSchedule(options.schedule)
    }

    this.setLastRunMillis(options.lastRunMillis ?? 0)
    this.setMinimumIntervalMillis(options.minimumIntervalMillis ?? 0)

    this.#catchErrors = options.catchErrors ?? true

    if (options.startTask ?? false) {
      this.startTask()
    }
  }

  setLastRunMillis(lastRunMillis: number): void {
    this.#lastRunMillis = lastRunMillis
  }

  setLastRunTime(lastRun: Date): void {
    this.setLastRunMillis(lastRun.getTime())
  }

  getLastRunMillis(): number {
    return this.#lastRunMillis
  }

  /**
   * Sets the minimum interval between task runs.
   * Can only be called before the task is started.
   * @param minimumIntervalMillis - The minimum interval between task runs.
   */
  setMinimumIntervalMillis(minimumIntervalMillis: number): void {
    if (this.#taskHasStarted) {
      throw alreadyStartedError
    }

    this.#minimumIntervalMillis = minimumIntervalMillis
  }

  /**
   * Sets the schedule for the task.
   * Can only be called before the task is started.
   * @see https://www.npmjs.com/package/node-schedule#usage
   * @param schedule The schedule for the task.
   * @returns `this` for chaining.
   * @throws If the task has already started.
   */
  setSchedule(schedule: nodeSchedule.Spec): this {
    if (this.#taskHasStarted) {
      throw alreadyStartedError
    }

    this.#schedule = schedule

    return this
  }

  /**
   * Checks if the task can run.
   * The task can run if there are no other tasks waiting and the minimum interval has passed.
   * @returns `true` if the task can run, `false` otherwise.
   */
  canRunTask(): boolean {
    return (
      this.#semaphore.nrWaiting() === 0 &&
      Date.now() - this.#lastRunMillis >= this.#minimumIntervalMillis
    )
  }

  /**
   * Runs the task once.
   */
  async runTask(): Promise<void> {
    await this.#semaphore.acquire()

    let taskRun = false

    try {
      if (Date.now() - this.#lastRunMillis >= this.#minimumIntervalMillis) {
        this.#debug('Running task')
        taskRun = true

        await this.#taskFunction()
      }
    } catch (error) {
      this.#debug('Task errored:', error)

      if (!this.#catchErrors) {
        throw error
      }
    } finally {
      this.#semaphore.release()

      if (taskRun) {
        this.setLastRunTime(new Date())
        this.#debug('Task run completed')
      } else {
        this.#debug('Task run skipped')
      }
    }
  }

  /**
   * Starts the task.
   * @returns `this` for chaining.
   * @throws If the task has already started.
   */
  startTask(): this {
    if (this.#taskHasStarted) {
      throw alreadyStartedError
    }

    this.#taskHasStarted = true

    this.#job = nodeSchedule.scheduleJob(
      this.#taskName,
      this.#schedule,
      async () => {
        await this.runTask()
      }
    ) as nodeSchedule.Job | null

    if (this.#job === null) {
      throw new Error(
        `Failed to schedule task "${this.#taskName}" with schedule: ${JSON.stringify(this.#schedule)}`
      )
    }

    const nextInvocation = this.#job.nextInvocation()

    if (nextInvocation === null) {
      throw new Error(
        `Failed to get next invocation for task "${this.#taskName}" with schedule: ${JSON.stringify(this.#schedule)}`
      )
    }

    this.#debug(
      `Task started, first run at ${nextInvocation.toString()}`
    )

    if (!this.#exitHookIsInitialized) {
      exitHook(() => {
        try {
          this.#job?.cancel()
        } catch {
          // Ignore errors
        }
      })
      this.#exitHookIsInitialized = true
    }

    return this
  }

  /**
   * Whether the task has started or not.
   * @returns `true` if the task has started, `false` otherwise.
   */
  hasStarted(): boolean {
    return this.#taskHasStarted
  }

  /**
   * Stops the task.
   * @returns `this` for chaining.
   * @throws If the task has not started.
   */
  stopTask(): this {
    if (!this.#taskHasStarted) {
      throw new Error('Task has not started.')
    }

    this.#debug('Stopping task')
    this.#job?.cancel()
    this.#taskHasStarted = false

    return this
  }
}

export * as nodeSchedule from 'node-schedule'
