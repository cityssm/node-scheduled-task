import { Sema } from 'async-sema'
import camelCase from 'camelcase'
import Debug from 'debug'
import exitHook from 'exit-hook'
import schedule from 'node-schedule'

import { DEBUG_NAMESPACE } from './debug.config.js'

type TaskFunction = () => void | Promise<void>

export interface ScheduledTaskOptions {
  schedule?: schedule.Spec
  lastRunMillis?: number
  minimumIntervalMillis?: number
}

export class ScheduledTask {
  readonly #taskName: string
  readonly #taskFunction: TaskFunction
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

  constructor(taskName: string, taskFunction: TaskFunction, options: ScheduledTaskOptions = {}) {
    this.#taskName = taskName
    this.#taskFunction = taskFunction

    this.#debug = Debug(`${DEBUG_NAMESPACE}:${camelCase(this.#taskName)}`)

    if (options.schedule !== undefined) {
      this.setSchedule(options.schedule)
    }

    this.setLastRunMillis(options.lastRunMillis ?? 0)
    this.setMinimumIntervalMillis(options.minimumIntervalMillis ?? 0)
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
      throw new Error('Task has already started.')
    }

    this.#minimumIntervalMillis = minimumIntervalMillis
  }

  setSchedule(schedule: schedule.Spec): void {
    if (this.#taskHasStarted) {
      throw new Error('Task has already started.')
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
   * Runs the task.
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
      throw new Error('Task has already started.')
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
        } catch (error) {
          this.#debug('Error cancelling job for task', error)
        }
      })
      this.#exitHookIsInitialized = true
    }
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
