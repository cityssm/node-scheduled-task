import { Sema } from 'async-sema'
import camelCase from 'camelcase'
import Debug from 'debug'
import exitHook from 'exit-hook'
import schedule from 'node-schedule'

import { DEBUG_NAMESPACE } from './debug.config.js'
import { alreadyStartedError } from './errors.js'

type TaskFunction = () => void | Promise<void>

export interface ScheduledTaskOptions {
  schedule?: schedule.Spec
  lastRunMillis?: number
  minimumIntervalMillis?: number
  runTask?: boolean
  startTask?: boolean
}

export class ScheduledTask {
  readonly #taskName: string
  readonly #taskFunction: TaskFunction

  readonly #debugNamespace: string
  readonly #debug: Debug.Debugger

  readonly #semaphore = new Sema(1)

  #lastRunMillis: number
  #minimumIntervalMillis: number

  #taskHasStarted = false

  #job: schedule.Job | undefined
  #schedule: schedule.Spec = {
    second: 0,
    minute: 0,
    hour: 0,
    dayOfWeek: '*',
    month: '*',
    year: '*'
  }

  #exitHookIsInitialized = false

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

    if (options.runTask ?? false) {
      this.runTask()
    }

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
   */
  setSchedule(schedule: schedule.Spec): void {
    if (this.#taskHasStarted) {
      throw alreadyStartedError
    }

    this.#schedule = schedule
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

    try {
      if (Date.now() - this.#lastRunMillis >= this.#minimumIntervalMillis) {
        this.#debug('Running task')

        await this.#taskFunction()

        this.setLastRunTime(new Date())
      } else {
        this.#debug('Skipping task')
      }
    } finally {
      this.#semaphore.release()
    }
  }

  /**
   * Starts the task.
   */
  startTask(): void {
    if (this.#taskHasStarted) {
      throw alreadyStartedError
    }

    this.#taskHasStarted = true

    this.#job = schedule.scheduleJob(
      this.#taskName,
      this.#schedule,
      async () => {
        await this.runTask()
      }
    )

    this.#debug(
      `Task started, first run at ${this.#job.nextInvocation().toString()}`
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
  }

  hasStarted(): boolean {
    return this.#taskHasStarted
  }

  /**
   * Stops the task.
   */
  stopTask(): void {
    if (!this.#taskHasStarted) {
      throw new Error('Task has not started.')
    }

    this.#debug('Stopping task')
    this.#job?.cancel()
    this.#taskHasStarted = false
  }
}
