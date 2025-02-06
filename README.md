# Scheduled Task

[![NPM Version](https://img.shields.io/npm/v/%40cityssm%2Fscheduled-task)](https://www.npmjs.com/package/@cityssm/scheduled-task)
[![Maintainability](https://api.codeclimate.com/v1/badges/92e5f4d577e60efb424f/maintainability)](https://codeclimate.com/github/cityssm/node-scheduled-task/maintainability)
[![codecov](https://codecov.io/gh/cityssm/node-scheduled-task/graph/badge.svg?token=FX2XI74PJQ)](https://codecov.io/gh/cityssm/node-scheduled-task)
[![DeepSource](https://app.deepsource.com/gh/cityssm/node-scheduled-task.svg/?label=active+issues&show_trend=true&token=iTE12ATmd36uvQAtYrrH7q_B)](https://app.deepsource.com/gh/cityssm/node-scheduled-task/)

Schedules recurring tasks while managing on-demand executions and limiting simultaneous executions.
Helpful for managing process-heavy tasks running in child processes.

## Installation

```sh
npm install @cityssm/scheduled-task
```

## Usage

### Child Process

```javascript
// childProcess.js

import { ScheduledTask } from '@cityssm/scheduled-task'

// Initialize task
const task = new ScheduledTask(
  childProcessTaskName,
  () => {
    /*
     * Process-heavy code running in the child process.
     */
  },
  {
    schedule: {
      second: 0,
      minute: 0,
      hour: 0,
      dayOfWeek: '*',
      month: '*',
      year: '*'
    },
    minimumIntervalMillis: 10 * 60 * 1000,
    startTask: true
  }
)

// Listen for message to run the task on demand.
process.on('message', (_message) => {
  void task.runTask()
})
```

#### Options

| Option                  | Description                                                                                                                          | Default  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| `schedule`              | The frequency the task should run. See [node-schedule](https://www.npmjs.com/package/node-schedule) for acceptable schedule formats. | Midnight |
| `lastRunMillis`         | The last time the task was executed. Helpful to avoid rerunning a task too soon after a restart.                                     | `0`      |
| `minimumIntervalMillis` | The minimum amount of time between executions. Helpful if the task can be run on demand.                                             | `0`      |
| `startTask`             | Whether the task should be started immediately after initialization.                                                                 | `false`  |

### Application

```javascript
// app.js

import { fork } from 'node:child_process'

const childProcess = fork('childProcess.js')

childProcess.send('Run the task on demand.')
```

## Real World Example

This package was made for the City's
[FASTER Web Helper](https://github.com/cityssm/faster-web-helper) application.
The application does a lot of background syncing work in child processes.
