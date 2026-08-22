#!/usr/bin/env node

import { runRecorderCli } from './runRecorderCli/index.ts'

process.exitCode = await runRecorderCli({ argv: process.argv.slice(2) })
